import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { StepResult } from '../../step-engine'

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { executeUpdateBlock } from '../update-block'
import type { createServerClient } from '@/lib/supabase/server'

// ─── Helpers ─────────────────────────────────────────────────────────────────

type MockDb = ReturnType<typeof createServerClient>

function makeMeta(overrides: Partial<{
  template_id: string
  source_block_id: string
  applies_to_type: string
  current_step_index: number
  step_results: StepResult[]
}> = {}) {
  return {
    template_id: 'tmpl-1',
    source_block_id: 'block-source',
    applies_to_type: 'client',
    current_step_index: 0,
    step_results: [] as StepResult[],
    ...overrides,
  }
}

/**
 * Creates a chainable Supabase mock that returns different responses
 * per `.from(table)` call, with support for sequential calls to the same table.
 */
function makeSupabase(
  tableResponses: Record<string, Array<{ data: unknown; error: unknown }>>
): MockDb {
  const tableCounters: Record<string, number> = {}

  const chain = {
    from: vi.fn().mockImplementation((table: string) => {
      tableCounters[table] = tableCounters[table] ?? 0
      const responses = tableResponses[table] ?? [{ data: null, error: null }]
      const idx = Math.min(tableCounters[table]++, responses.length - 1)
      const resp = responses[idx]

      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(resp),
              maybeSingle: vi.fn().mockResolvedValue(resp),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue(resp),
          }),
        }),
        insert: vi.fn().mockResolvedValue(resp),
      }
    }),
  }

  return chain as unknown as MockDb
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('executeUpdateBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('happy path — updates block metadata and emits event', async () => {
    const supabase = makeSupabase({
      blocks: [
        // 1st: fetch target block
        {
          data: { id: 'block-1', type: 'client', metadata: { status: 'pending' }, org_id: 'org-1' },
          error: null,
        },
      ],
      block_type_definitions: [
        { data: { field_schema: { properties: { status: {}, priority: {} } } }, error: null },
      ],
      events: [{ data: null, error: null }],
    })

    const result = await executeUpdateBlock(
      'update_status',
      { block_id: 'block-1', fields: { status: 'active' } },
      makeMeta(),
      'org-1',
      supabase
    )

    expect(result.status).toBe('completed')
    expect(result.step_type).toBe('update_block')
    expect(result.output?.block_id).toBe('block-1')
    expect(result.output?.updated_fields).toEqual(['status'])
  })

  it('fails when fields is empty', async () => {
    const supabase = makeSupabase({})

    const result = await executeUpdateBlock(
      'empty_fields',
      { block_id: 'block-1', fields: {} },
      makeMeta(),
      'org-1',
      supabase
    )

    expect(result.status).toBe('failed')
    expect(result.error).toMatch(/empty fields/i)
  })

  it('fails when target block not found', async () => {
    const supabase = makeSupabase({
      blocks: [{ data: null, error: { code: 'PGRST116', message: 'not found' } }],
    })

    const result = await executeUpdateBlock(
      'missing_block',
      { block_id: 'nonexistent', fields: { x: 1 } },
      makeMeta(),
      'org-1',
      supabase
    )

    expect(result.status).toBe('failed')
    expect(result.error).toMatch(/not found/i)
  })

  it('fails when field name is not in schema', async () => {
    const supabase = makeSupabase({
      blocks: [
        {
          data: { id: 'block-1', type: 'client', metadata: {}, org_id: 'org-1' },
          error: null,
        },
      ],
      block_type_definitions: [
        { data: { field_schema: { properties: { name: {}, status: {} } } }, error: null },
      ],
    })

    const result = await executeUpdateBlock(
      'bad_field',
      { block_id: 'block-1', fields: { nonexistent_field: 'val' } },
      makeMeta(),
      'org-1',
      supabase
    )

    expect(result.status).toBe('failed')
    expect(result.error).toMatch(/unknown fields/i)
    expect(result.error).toContain('nonexistent_field')
  })

  it('resolves {{context.source_block_id}} expression', async () => {
    const supabase = makeSupabase({
      blocks: [
        // 1st call: source block lookup for expression resolution
        {
          data: { id: 'block-source', name: 'Source', type: 'client', metadata: {} },
          error: null,
        },
        // 2nd call: target block fetch (same as source in this case)
        {
          data: { id: 'block-source', type: 'client', metadata: { x: 1 }, org_id: 'org-1' },
          error: null,
        },
      ],
      block_type_definitions: [
        { data: null, error: null }, // no schema — skip validation
      ],
      events: [{ data: null, error: null }],
    })

    const result = await executeUpdateBlock(
      'update_source',
      { block_id: '{{context.source_block_id}}', fields: { updated: true } },
      makeMeta({ source_block_id: 'block-source' }),
      'org-1',
      supabase
    )

    expect(result.status).toBe('completed')
    expect(result.output?.block_id).toBe('block-source')
  })

  it('fails on invalid expression namespace', async () => {
    const supabase = makeSupabase({
      blocks: [
        // source block fetch for expression resolution
        { data: { id: 'block-source', name: 'S', type: 'client', metadata: {} }, error: null },
      ],
    })

    const result = await executeUpdateBlock(
      'bad_expr',
      { block_id: '{{env.SECRET_KEY}}', fields: { x: 1 } },
      makeMeta(),
      'org-1',
      supabase
    )

    expect(result.status).toBe('failed')
    expect(result.error).toMatch(/resolve expression/i)
  })

  it('passes validation when no field_schema exists', async () => {
    const supabase = makeSupabase({
      blocks: [
        {
          data: { id: 'block-1', type: 'custom', metadata: {}, org_id: 'org-1' },
          error: null,
        },
      ],
      block_type_definitions: [
        { data: null, error: null }, // no type definition
      ],
      events: [{ data: null, error: null }],
    })

    const result = await executeUpdateBlock(
      'custom_update',
      { block_id: 'block-1', fields: { anything: 'goes' } },
      makeMeta(),
      'org-1',
      supabase
    )

    expect(result.status).toBe('completed')
  })

  it('fails when block_id is empty', async () => {
    const supabase = makeSupabase({})

    const result = await executeUpdateBlock(
      'no_block_id',
      { block_id: '', fields: { x: 1 } },
      makeMeta(),
      'org-1',
      supabase
    )

    expect(result.status).toBe('failed')
    expect(result.error).toMatch(/missing block_id/i)
  })
})
