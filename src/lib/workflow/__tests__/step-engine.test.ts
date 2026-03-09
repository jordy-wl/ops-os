import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { createServerClient } from '@/lib/supabase/server'
import { advanceWorkflowInstance, interpolateTemplate } from '@/lib/workflow/step-engine'

// ─── Mock DB helper ──────────────────────────────────────────────────────────
function makeDb(...responses: { data: unknown; error: unknown }[]) {
  const queue = [...responses]
  let i = 0

  const singleFn = vi.fn().mockImplementation(() =>
    Promise.resolve(queue[i++] ?? { data: null, error: null })
  )

  const chain: Record<string, unknown> = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: singleFn,
    then: (resolve: (v: unknown) => void, reject: (r: unknown) => void) =>
      Promise.resolve(queue[i++] ?? { data: [], error: null }).then(resolve, reject),
  }

  vi.mocked(createServerClient).mockReturnValue(chain as unknown as ReturnType<typeof createServerClient>)
  return { chain, singleFn }
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ORG_ID = 'uuid-org-1'
const INSTANCE_ID = 'uuid-instance-1'
const TEMPLATE_ID = 'uuid-template-1'
const SOURCE_BLOCK_ID = 'uuid-source-1'

function makeInstance(overrides: Record<string, unknown> = {}) {
  return {
    id: INSTANCE_ID,
    name: 'Test Instance',
    metadata: {
      template_id: TEMPLATE_ID,
      source_block_id: SOURCE_BLOCK_ID,
      applies_to_type: 'client',
      status: 'pending',
      current_step_index: 0,
      step_results: [],
      started_at: null,
      completed_at: null,
      ...overrides,
    },
  }
}

function makeTemplate(steps: Record<string, unknown>[]) {
  return {
    id: TEMPLATE_ID,
    metadata: {
      applies_to_type: 'client',
      trigger: { type: 'manual' },
      steps,
    },
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('advanceWorkflowInstance', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('instance validation', () => {
    it('throws when instance is not found', async () => {
      makeDb({ data: null, error: { code: 'PGRST116' } })

      await expect(advanceWorkflowInstance(INSTANCE_ID, ORG_ID))
        .rejects.toThrow('Instance not found')
    })

    it('throws when instance is already done', async () => {
      makeDb({ data: makeInstance({ status: 'done' }), error: null })

      await expect(advanceWorkflowInstance(INSTANCE_ID, ORG_ID))
        .rejects.toThrow('already done')
    })

    it('throws when instance is already failed', async () => {
      makeDb({ data: makeInstance({ status: 'failed' }), error: null })

      await expect(advanceWorkflowInstance(INSTANCE_ID, ORG_ID))
        .rejects.toThrow('already failed')
    })

    it('throws when template is not found', async () => {
      const instance = makeInstance()
      makeDb(
        { data: instance, error: null },       // instance lookup
        { data: null, error: { code: 'PGRST116' } }  // template lookup
      )

      await expect(advanceWorkflowInstance(INSTANCE_ID, ORG_ID))
        .rejects.toThrow('Template not found')
    })

    it('throws when step index is out of bounds', async () => {
      const instance = makeInstance({ current_step_index: 5 })
      const template = makeTemplate([{ name: 'step_one', type: 'emit_event', event_type: 'test' }])
      makeDb(
        { data: instance, error: null },
        { data: template, error: null }
      )

      await expect(advanceWorkflowInstance(INSTANCE_ID, ORG_ID))
        .rejects.toThrow('out of bounds')
    })
  })

  describe('emit_event step', () => {
    it('completes and returns event_type in output', async () => {
      const instance = makeInstance()
      const template = makeTemplate([
        { name: 'emit_start', type: 'emit_event', event_type: 'onboarding.started' },
      ])
      makeDb(
        { data: instance, error: null },     // instance
        { data: template, error: null },     // template
        { data: null, error: null },         // update pending → running
        { data: null, error: null },         // event insert (emit_event step)
        { data: null, error: null },         // update metadata
        { data: null, error: null },         // completion event
        { data: null, error: null },         // step event
      )

      const result = await advanceWorkflowInstance(INSTANCE_ID, ORG_ID)

      expect(result.status).toBe('completed')
      expect(result.step_result.step_name).toBe('emit_start')
      expect(result.step_result.status).toBe('completed')
      expect(result.step_result.output).toEqual({ event_type: 'onboarding.started' })
      expect(result.instance_status).toBe('done')
    })

    it('fails when event_type is missing', async () => {
      const instance = makeInstance()
      const template = makeTemplate([
        { name: 'bad_emit', type: 'emit_event' },
      ])
      makeDb(
        { data: instance, error: null },
        { data: template, error: null },
        { data: null, error: null },         // update pending → running
        { data: null, error: null },         // update metadata (failed)
        { data: null, error: null },         // step event
      )

      const result = await advanceWorkflowInstance(INSTANCE_ID, ORG_ID)

      expect(result.status).toBe('failed')
      expect(result.step_result.error).toBe('Missing event_type')
      expect(result.instance_status).toBe('failed')
    })
  })

  describe('run_action step', () => {
    it('completes and returns action_type in output', async () => {
      const instance = makeInstance()
      const template = makeTemplate([
        { name: 'do_action', type: 'run_action', action_type: 'send_notification' },
      ])
      makeDb(
        { data: instance, error: null },
        { data: template, error: null },
        { data: null, error: null },         // update pending → running
        { data: null, error: null },         // event insert (action.requested)
        { data: null, error: null },         // update metadata
        { data: null, error: null },         // completion event
        { data: null, error: null },         // step event
      )

      const result = await advanceWorkflowInstance(INSTANCE_ID, ORG_ID)

      expect(result.status).toBe('completed')
      expect(result.step_result.output).toEqual({ action_type: 'send_notification' })
    })

    it('fails when action_type is missing', async () => {
      const instance = makeInstance()
      const template = makeTemplate([
        { name: 'bad_action', type: 'run_action' },
      ])
      makeDb(
        { data: instance, error: null },
        { data: template, error: null },
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: null },
      )

      const result = await advanceWorkflowInstance(INSTANCE_ID, ORG_ID)

      expect(result.status).toBe('failed')
      expect(result.step_result.error).toBe('Missing action_type')
    })
  })

  describe('wait step', () => {
    it('returns waiting status and schedules workflow_job', async () => {
      const instance = makeInstance()
      const template = makeTemplate([
        { name: 'pause', type: 'wait', wait_seconds: 300 },
        { name: 'final_step', type: 'emit_event', event_type: 'done' },
      ])
      makeDb(
        { data: instance, error: null },
        { data: template, error: null },
        { data: null, error: null },         // update pending → running
        { data: null, error: null },         // workflow_jobs insert
        { data: null, error: null },         // update metadata
        { data: null, error: null },         // step event
      )

      const result = await advanceWorkflowInstance(INSTANCE_ID, ORG_ID)

      expect(result.status).toBe('waiting')
      expect(result.step_result.status).toBe('waiting')
      expect(result.step_result.output).toMatchObject({ wait_seconds: 300 })
      expect(result.instance_status).toBe('running')
    })

    it('fails when workflow_job insert errors', async () => {
      const instance = makeInstance()
      const template = makeTemplate([
        { name: 'pause', type: 'wait', wait_seconds: 60 },
      ])
      makeDb(
        { data: instance, error: null },
        { data: template, error: null },
        { data: null, error: null },         // update pending → running
        { data: null, error: { code: 'DB_ERR', message: 'insert failed' } },  // workflow_jobs insert error
        { data: null, error: null },         // update metadata
        { data: null, error: null },         // step event
      )

      const result = await advanceWorkflowInstance(INSTANCE_ID, ORG_ID)

      expect(result.status).toBe('failed')
      expect(result.step_result.error).toBe('insert failed')
    })
  })

  describe('condition step', () => {
    it('always completes (placeholder evaluator)', async () => {
      const instance = makeInstance()
      const template = makeTemplate([
        { name: 'check_status', type: 'condition', condition: 'block.state == "active"' },
      ])
      makeDb(
        { data: instance, error: null },
        { data: template, error: null },
        { data: null, error: null },         // update pending → running
        { data: null, error: null },         // update metadata
        { data: null, error: null },         // completion event
        { data: null, error: null },         // step event
      )

      const result = await advanceWorkflowInstance(INSTANCE_ID, ORG_ID)

      expect(result.status).toBe('completed')
      expect(result.step_result.output).toMatchObject({
        condition: 'block.state == "active"',
        result: true,
      })
    })
  })

  describe('multi-step advancement', () => {
    it('advances running instance from step 1 to completion', async () => {
      const instance = makeInstance({
        status: 'running',
        current_step_index: 1,
        step_results: [{ step_name: 'step_one', step_type: 'emit_event', status: 'completed', executed_at: '2026-01-01' }],
        started_at: '2026-01-01T00:00:00.000Z',
      })
      const template = makeTemplate([
        { name: 'step_one', type: 'emit_event', event_type: 'started' },
        { name: 'step_two', type: 'condition', condition: 'true' },
      ])
      makeDb(
        { data: instance, error: null },
        { data: template, error: null },
        // No pending→running update (already running)
        { data: null, error: null },         // update metadata
        { data: null, error: null },         // completion event
        { data: null, error: null },         // step event
      )

      const result = await advanceWorkflowInstance(INSTANCE_ID, ORG_ID)

      expect(result.status).toBe('completed')
      expect(result.instance_status).toBe('done')
    })

    it('returns advanced when more steps remain', async () => {
      const instance = makeInstance()
      const template = makeTemplate([
        { name: 'step_one', type: 'condition', condition: 'true' },
        { name: 'step_two', type: 'emit_event', event_type: 'done' },
      ])
      makeDb(
        { data: instance, error: null },
        { data: template, error: null },
        { data: null, error: null },         // update pending → running
        { data: null, error: null },         // update metadata
        { data: null, error: null },         // step event
      )

      const result = await advanceWorkflowInstance(INSTANCE_ID, ORG_ID)

      expect(result.status).toBe('advanced')
      expect(result.instance_status).toBe('running')
    })
  })

  describe('unknown step type', () => {
    it('fails instance on unknown step type', async () => {
      const instance = makeInstance()
      const template = makeTemplate([
        { name: 'mystery', type: 'teleport' },
      ])
      makeDb(
        { data: instance, error: null },
        { data: template, error: null },
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: null },
      )

      const result = await advanceWorkflowInstance(INSTANCE_ID, ORG_ID)

      expect(result.status).toBe('failed')
      expect(result.step_result.error).toContain('Unknown step type')
    })
  })

  describe('call_api step', () => {
    const CONNECTOR_ID = 'uuid-connector-1'

    const callApiStep = {
      name: 'call_crm',
      type: 'call_api',
      connector_id: CONNECTOR_ID,
      method: 'POST',
      path: '/api/v1/leads',
      body_template: '{"name": "{{block.name}}"}',
      timeout_ms: 5000,
    }

    const connectorRow = {
      id: CONNECTOR_ID,
      config: { base_url: 'https://crm.example.com' },
      credentials_ref: null,
      status: 'active',
    }

    const sourceBlockRow = {
      id: SOURCE_BLOCK_ID,
      name: 'Acme Corp',
      type: 'client',
      metadata: { industry: 'finance' },
    }

    beforeEach(() => {
      // Mock global fetch
      vi.stubGlobal('fetch', vi.fn())
    })

    it('completes on successful API call', async () => {
      const instance = makeInstance()
      const template = makeTemplate([callApiStep])
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('{"id": "lead-1"}'),
      } as Response)

      makeDb(
        { data: instance, error: null },      // instance lookup
        { data: template, error: null },       // template lookup
        { data: null, error: null },           // pending → running
        { data: connectorRow, error: null },   // connector lookup
        { data: sourceBlockRow, error: null }, // source block lookup
        { data: null, error: null },           // update metadata
        { data: null, error: null },           // completion event
        { data: null, error: null },           // step event
      )

      const result = await advanceWorkflowInstance(INSTANCE_ID, ORG_ID)

      expect(result.status).toBe('completed')
      expect(result.step_result.status).toBe('completed')
      expect(result.step_result.output).toMatchObject({ status: 200 })

      // Verify fetch was called with interpolated body
      expect(fetch).toHaveBeenCalledWith(
        'https://crm.example.com/api/v1/leads',
        expect.objectContaining({
          method: 'POST',
          body: '{"name": "Acme Corp"}',
        })
      )
    })

    it('fails when connector_id is missing', async () => {
      const instance = makeInstance()
      const template = makeTemplate([
        { name: 'bad_call', type: 'call_api', method: 'GET', path: '/test' },
      ])
      makeDb(
        { data: instance, error: null },
        { data: template, error: null },
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: null },
      )

      const result = await advanceWorkflowInstance(INSTANCE_ID, ORG_ID)

      expect(result.status).toBe('failed')
      expect(result.step_result.error).toBe('Missing connector_id')
    })

    it('fails when method is missing', async () => {
      const instance = makeInstance()
      const template = makeTemplate([
        { name: 'bad_call', type: 'call_api', connector_id: CONNECTOR_ID, path: '/test' },
      ])
      makeDb(
        { data: instance, error: null },
        { data: template, error: null },
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: null },
      )

      const result = await advanceWorkflowInstance(INSTANCE_ID, ORG_ID)

      expect(result.status).toBe('failed')
      expect(result.step_result.error).toBe('Missing method')
    })

    it('fails when connector is not found', async () => {
      const instance = makeInstance()
      const template = makeTemplate([callApiStep])
      makeDb(
        { data: instance, error: null },
        { data: template, error: null },
        { data: null, error: null },           // pending → running
        { data: null, error: { code: 'PGRST116' } }, // connector not found
        { data: null, error: null },
        { data: null, error: null },
      )

      const result = await advanceWorkflowInstance(INSTANCE_ID, ORG_ID)

      expect(result.status).toBe('failed')
      expect(result.step_result.error).toContain('Connector not found')
    })

    it('fails when connector is inactive', async () => {
      const instance = makeInstance()
      const template = makeTemplate([callApiStep])
      makeDb(
        { data: instance, error: null },
        { data: template, error: null },
        { data: null, error: null },
        { data: { ...connectorRow, status: 'paused' }, error: null },
        { data: null, error: null },
        { data: null, error: null },
      )

      const result = await advanceWorkflowInstance(INSTANCE_ID, ORG_ID)

      expect(result.status).toBe('failed')
      expect(result.step_result.error).toBe('Connector is paused')
    })

    it('fails when connector has no base_url', async () => {
      const instance = makeInstance()
      const template = makeTemplate([callApiStep])
      makeDb(
        { data: instance, error: null },
        { data: template, error: null },
        { data: null, error: null },
        { data: { ...connectorRow, config: {} }, error: null },
        { data: null, error: null },
        { data: null, error: null },
      )

      const result = await advanceWorkflowInstance(INSTANCE_ID, ORG_ID)

      expect(result.status).toBe('failed')
      expect(result.step_result.error).toBe('Connector has no base_url in config')
    })

    it('fails on HTTP error after retries exhausted', async () => {
      const instance = makeInstance()
      const template = makeTemplate([{
        ...callApiStep,
        max_retries: 1,
      }])
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      } as Response)

      makeDb(
        { data: instance, error: null },
        { data: template, error: null },
        { data: null, error: null },
        { data: connectorRow, error: null },
        { data: sourceBlockRow, error: null },
        { data: null, error: null },
        { data: null, error: null },
      )

      const result = await advanceWorkflowInstance(INSTANCE_ID, ORG_ID)

      expect(result.status).toBe('failed')
      expect(result.step_result.error).toBe('HTTP 500')
      expect(result.step_result.output).toMatchObject({ attempts: 2 })
      // Called twice: initial + 1 retry
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('retries on fetch error and succeeds', async () => {
      const instance = makeInstance()
      const template = makeTemplate([{
        ...callApiStep,
        max_retries: 2,
      }])
      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve('{}'),
        } as Response)

      makeDb(
        { data: instance, error: null },
        { data: template, error: null },
        { data: null, error: null },
        { data: connectorRow, error: null },
        { data: sourceBlockRow, error: null },
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: null },
      )

      const result = await advanceWorkflowInstance(INSTANCE_ID, ORG_ID)

      expect(result.status).toBe('completed')
      expect(result.step_result.output).toMatchObject({ status: 200, attempt: 1 })
    })

    it('uses credentials_ref from env for Authorization header', async () => {
      const instance = makeInstance()
      const template = makeTemplate([callApiStep])
      process.env.CRM_API_KEY = 'test-secret-key'
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('{}'),
      } as Response)

      makeDb(
        { data: instance, error: null },
        { data: template, error: null },
        { data: null, error: null },
        { data: { ...connectorRow, credentials_ref: 'CRM_API_KEY' }, error: null },
        { data: sourceBlockRow, error: null },
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: null },
      )

      const result = await advanceWorkflowInstance(INSTANCE_ID, ORG_ID)

      expect(result.status).toBe('completed')
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-secret-key',
          }),
        })
      )

      delete process.env.CRM_API_KEY
    })
  })
})

// ─── interpolateTemplate unit tests ─────────────────────────────────────────

describe('interpolateTemplate', () => {
  it('replaces block and context variables', () => {
    const result = interpolateTemplate(
      '{"name": "{{block.name}}", "type": "{{context.applies_to_type}}"}',
      {
        block: { name: 'Acme Corp', id: 'b-1' },
        context: { applies_to_type: 'client' },
      }
    )
    expect(result).toBe('{"name": "Acme Corp", "type": "client"}')
  })

  it('replaces missing variables with empty string', () => {
    const result = interpolateTemplate(
      '{{block.name}} / {{block.missing}}',
      { block: { name: 'Test' } }
    )
    expect(result).toBe('Test / ')
  })

  it('replaces unknown namespace with empty string', () => {
    const result = interpolateTemplate(
      '{{unknown.field}}',
      { block: { name: 'Test' } }
    )
    expect(result).toBe('')
  })

  it('stringifies object values as JSON', () => {
    const result = interpolateTemplate(
      '{{block.metadata}}',
      { block: { metadata: { key: 'val' } } }
    )
    expect(result).toBe('{"key":"val"}')
  })

  it('handles null and undefined values', () => {
    const result = interpolateTemplate(
      '{{block.a}} / {{block.b}}',
      { block: { a: null, b: undefined } }
    )
    expect(result).toBe(' / ')
  })
})
