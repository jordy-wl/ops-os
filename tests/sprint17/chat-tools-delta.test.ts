/**
 * tests/sprint17/chat-tools-delta.test.ts
 *
 * Unit tests for the calculate_delta tool integration in chat-tools.ts.
 * Verifies the tool definition exists in CHAT_TOOLS, is in readOnlyTools,
 * and that executeChatTool dispatches correctly to the delta engine.
 *
 * All external dependencies are mocked: Supabase, delta-engine, logger,
 * and supporting modules.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Mutable mock state ----------------------------------------------------

const mockDb = vi.hoisted(() => ({
  instanceData: null as Record<string, unknown> | null,
  instanceError: null as { code: string; message: string } | null,
  templateData: null as Record<string, unknown> | null,
  templateError: null as { code: string; message: string } | null,
  eventsData: [] as Array<Record<string, unknown>>,
}))

// ---- Mocks -----------------------------------------------------------------

vi.mock('@/lib/supabase/server', () => {
  const createChain = () => {
    let callIndex = 0

    const chain: Record<string, unknown> = {}
    chain.from = vi.fn(() => {
      callIndex++
      return chain
    })
    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    chain.order = vi.fn(() => chain)
    chain.limit = vi.fn(() => {
      // The events query uses .limit() without .single()
      // Return events data directly
      return Promise.resolve({ data: mockDb.eventsData, error: null })
    })
    chain.ilike = vi.fn(() => chain)
    chain.single = vi.fn(() => {
      // First .single() = instance, second = template
      if (callIndex <= 1) {
        return Promise.resolve({
          data: mockDb.instanceData,
          error: mockDb.instanceError,
        })
      }
      return Promise.resolve({
        data: mockDb.templateData,
        error: mockDb.templateError,
      })
    })

    return chain
  }

  return {
    createServerClient: vi.fn(() => createChain()),
  }
})

vi.mock('@/lib/ai/delta-engine', () => ({
  calculateDelta: vi.fn().mockReturnValue({
    health_score: { score: 85, label: 'healthy' },
    gap_analysis: { overdue_steps: [], skipped_steps: [], out_of_order: [] },
    step_deltas: [],
    insights: ['All steps on track'],
  }),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock the supporting modules that chat-tools.ts imports at the top level
vi.mock('@/lib/ai/research-tools', () => ({
  checkForDuplicates: vi.fn().mockResolvedValue({ hasDuplicates: false, matches: [] }),
}))

vi.mock('@/lib/ai/entity-creation', () => ({
  validateFieldsAgainstSchema: vi.fn().mockReturnValue({ validFields: {}, errors: [] }),
  getBlockTypeSchemas: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/ai/field-suggestion', () => ({
  suggestFields: vi.fn().mockResolvedValue({ fields: [] }),
}))

vi.mock('@/lib/block-types/field-types', () => ({
  FIELD_TYPE_DEFINITIONS: {},
  isValidFieldType: vi.fn().mockReturnValue(true),
  getFieldGroups: vi.fn().mockReturnValue([]),
}))

// ---- Import after mocks ----------------------------------------------------

import { CHAT_TOOLS, executeChatTool } from '@/lib/ai/chat-tools'

// ---- Tests -----------------------------------------------------------------

describe('calculate_delta tool definition', () => {
  it('should exist in the CHAT_TOOLS array', () => {
    const deltaTool = CHAT_TOOLS.find((t) => t.name === 'calculate_delta')
    expect(deltaTool).toBeDefined()
    expect(deltaTool!.name).toBe('calculate_delta')
  })

  it('should have correct input schema with required instance_id', () => {
    const deltaTool = CHAT_TOOLS.find((t) => t.name === 'calculate_delta')
    expect(deltaTool).toBeDefined()

    const schema = deltaTool!.input_schema
    expect(schema.type).toBe('object')
    expect(schema.properties).toHaveProperty('instance_id')
    expect(schema.required).toContain('instance_id')
  })

  it('should have a description mentioning workflow health', () => {
    const deltaTool = CHAT_TOOLS.find((t) => t.name === 'calculate_delta')
    expect(deltaTool).toBeDefined()
    expect(deltaTool!.description.toLowerCase()).toContain('health')
  })
})

describe('calculate_delta in readOnlyTools (RBAC)', () => {
  it('should be accessible to non-admin roles (in readOnlyTools set)', async () => {
    // Set up valid instance + template data so the tool can actually execute
    mockDb.instanceData = {
      id: 'inst-1',
      name: 'Test Instance',
      type: 'workflow_instance',
      metadata: {
        template_id: 'tmpl-1',
        source_block_id: 'block-1',
        status: 'running',
        current_step_index: 0,
        step_results: [],
        started_at: new Date().toISOString(),
      },
    }
    mockDb.templateData = {
      metadata: { steps: [{ name: 'Step 1', type: 'human' }] },
    }
    mockDb.eventsData = []

    // ops-user (non-admin) should be able to call calculate_delta
    const result = await executeChatTool(
      'calculate_delta',
      { instance_id: 'inst-1' },
      'uuid-org-1',
      'ops-user' as const
    )

    // Should NOT get a permission denied error — error should be undefined on success
    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('should deny non-admin access to mutating tools', async () => {
    const result = await executeChatTool(
      'create_block',
      { name: 'Test', type: 'client' },
      'uuid-org-1',
      'ops-user' as const
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('Permission denied')
  })
})

describe('executeChatTool("calculate_delta", ...)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.instanceData = null
    mockDb.instanceError = null
    mockDb.templateData = null
    mockDb.templateError = null
    mockDb.eventsData = []
  })

  it('should return delta result on success', async () => {
    mockDb.instanceData = {
      id: 'inst-success',
      name: 'Onboarding - Acme',
      type: 'workflow_instance',
      metadata: {
        template_id: 'tmpl-abc',
        source_block_id: 'block-xyz',
        status: 'running',
        current_step_index: 1,
        step_results: [
          {
            step_name: 'KYC Check',
            step_type: 'human',
            status: 'completed',
            executed_at: '2026-03-10T10:00:00Z',
          },
        ],
        started_at: '2026-03-10T09:00:00Z',
      },
    }
    mockDb.templateData = {
      metadata: {
        steps: [
          { name: 'KYC Check', type: 'human', wait_seconds: 3600 },
          { name: 'Document Review', type: 'human' },
        ],
      },
    }
    mockDb.eventsData = [
      {
        id: 'evt-1',
        type: 'workflow.step.completed',
        payload: { step_name: 'KYC Check' },
        created_at: '2026-03-10T10:30:00Z',
      },
    ]

    const result = await executeChatTool(
      'calculate_delta',
      { instance_id: 'inst-success' },
      'uuid-org-1',
      'ops-admin'
    )

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()

    const data = result.data as Record<string, unknown>
    expect(data.instance_id).toBe('inst-success')
    expect(data.instance_name).toBe('Onboarding - Acme')
    expect(data.health_score).toEqual({ score: 85, label: 'healthy' })
    expect(data.insights).toEqual(['All steps on track'])
  })

  it('should return error when instance_id is missing', async () => {
    const result = await executeChatTool(
      'calculate_delta',
      {},
      'uuid-org-1',
      'ops-admin'
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('instance_id')
  })

  it('should return error when instance not found', async () => {
    mockDb.instanceData = null

    const result = await executeChatTool(
      'calculate_delta',
      { instance_id: 'non-existent' },
      'uuid-org-1',
      'ops-admin'
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('Workflow instance not found')
  })

  it('should return error when instance has no template_id', async () => {
    mockDb.instanceData = {
      id: 'inst-no-tmpl',
      name: 'Bad Instance',
      type: 'workflow_instance',
      metadata: {
        // No template_id
        source_block_id: 'block-1',
        status: 'running',
      },
    }

    const result = await executeChatTool(
      'calculate_delta',
      { instance_id: 'inst-no-tmpl' },
      'uuid-org-1',
      'ops-admin'
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('template_id')
  })

  it('should return error when template not found', async () => {
    mockDb.instanceData = {
      id: 'inst-missing-tmpl',
      name: 'Instance Missing Template',
      type: 'workflow_instance',
      metadata: {
        template_id: 'tmpl-deleted',
        source_block_id: 'block-1',
        status: 'running',
        current_step_index: 0,
        step_results: [],
        started_at: new Date().toISOString(),
      },
    }
    mockDb.templateData = null

    const result = await executeChatTool(
      'calculate_delta',
      { instance_id: 'inst-missing-tmpl' },
      'uuid-org-1',
      'ops-admin'
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('template not found')
  })

  it('should call calculateDelta with correct arguments when successful', async () => {
    mockDb.instanceData = {
      id: 'inst-args',
      name: 'Args Test',
      type: 'workflow_instance',
      metadata: {
        template_id: 'tmpl-args',
        source_block_id: 'block-args',
        status: 'running',
        current_step_index: 2,
        step_results: [
          {
            step_name: 'Init',
            step_type: 'auto',
            status: 'completed',
            executed_at: '2026-03-10T08:00:00Z',
          },
        ],
        started_at: '2026-03-10T07:00:00Z',
      },
    }
    mockDb.templateData = {
      metadata: {
        steps: [
          { name: 'Init', type: 'auto' },
          { name: 'Review', type: 'human', wait_seconds: 7200 },
          { name: 'Finalize', type: 'auto' },
        ],
      },
    }
    mockDb.eventsData = [
      {
        id: 'evt-a',
        type: 'workflow.step.completed',
        payload: { step_name: 'Init' },
        created_at: '2026-03-10T08:30:00Z',
      },
    ]

    const result = await executeChatTool(
      'calculate_delta',
      { instance_id: 'inst-args' },
      'uuid-org-1',
      'ops-admin'
    )

    expect(result.success).toBe(true)

    const { calculateDelta } = await import('@/lib/ai/delta-engine')
    expect(calculateDelta).toHaveBeenCalledTimes(1)

    const callArgs = vi.mocked(calculateDelta).mock.calls[0]
    // First arg: instanceId
    expect(callArgs[0]).toBe('inst-args')
    // Second arg: meta object
    expect(callArgs[1].template_id).toBe('tmpl-args')
    expect(callArgs[1].status).toBe('running')
    // Third arg: steps array
    expect(callArgs[2]).toHaveLength(3)
    expect(callArgs[2][1].wait_seconds).toBe(7200)
    // Fourth arg: events
    expect(callArgs[3]).toHaveLength(1)
  })

  it('should handle unknown tool name gracefully', async () => {
    const result = await executeChatTool(
      'nonexistent_tool',
      {},
      'uuid-org-1',
      'ops-admin'
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('Unknown tool')
  })
})
