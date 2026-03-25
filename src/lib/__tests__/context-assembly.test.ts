import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

import { createServerClient } from '@/lib/supabase/server'
import {
  assembleContext,
  contextToPromptString,
  MAX_CONTEXT_EVENTS,
  type ContextObject,
} from '@/lib/context-assembly'

// ─── Mock DB helper ────────────────────────────────────────────────────────────
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
    or: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: singleFn,
    then: (resolve: (v: unknown) => void, reject: (r: unknown) => void) =>
      Promise.resolve(queue[i++] ?? { data: [], error: null }).then(resolve, reject),
  }

  vi.mocked(createServerClient).mockReturnValue(chain as unknown as ReturnType<typeof createServerClient>)
  return chain
}

const ORG = { id: 'org-uuid', clerk_org_id: 'org_abc', name: 'Thornfield Capital', slug: 'thornfield', created_at: '2026-03-01T00:00:00Z' }
const BLOCK = { id: 'block-1', org_id: 'org-uuid', type: 'client', name: 'Acme Ltd', state: 'active', metadata: { jurisdiction: 'UK' }, owner_id: null, created_at: '2026-03-01T10:00:00Z', updated_at: '2026-03-02T10:00:00Z' }
const EVENTS = [
  { id: 'ev-2', org_id: 'org-uuid', block_id: 'block-1', type: 'block.updated', actor_id: 'user_111', actor_type: 'human', payload: { diff: { name: { before: 'Acme', after: 'Acme Ltd' } } }, occurred_at: '2026-03-02T10:00:00Z' },
  { id: 'ev-1', org_id: 'org-uuid', block_id: 'block-1', type: 'block.created', actor_id: 'user_111', actor_type: 'human', payload: { block_type: 'client', name: 'Acme' }, occurred_at: '2026-03-01T10:00:00Z' },
]

describe('assembleContext', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns block, events, neighbours, and org for a valid blockId', async () => {
    const edges = [
      { from_block_id: 'block-1', to_block_id: 'block-2' },
    ]
    const neighbour = { id: 'block-2', org_id: 'org-uuid', type: 'deal', name: 'Deal Alpha', state: 'active', metadata: {}, owner_id: null, created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z' }

    makeDb(
      { data: ORG, error: null },                    // single: org
      { data: { role: 'member' }, error: null },     // single: user_roles
      { data: [], error: null },                      // then: blocks (tasks)
      { data: [], error: null },                      // then: events (activity)
      { data: BLOCK, error: null },                   // single: block
      { data: EVENTS, error: null },                  // then: events
      { data: edges, error: null },                   // then: edges
      { data: [neighbour], error: null }              // then: neighbour blocks
    )

    const ctx = await assembleContext('block-1', 'org-uuid', 'user_111')

    expect(ctx.block?.id).toBe('block-1')
    expect(ctx.events).toHaveLength(2)
    expect(ctx.neighbours).toHaveLength(1)
    expect(ctx.neighbours[0].type).toBe('deal')
    expect(ctx.org?.name).toBe('Thornfield Capital')
    expect(ctx.userRole).toBe('member')
  })

  it('returns empty events array when block has no events', async () => {
    makeDb(
      { data: ORG, error: null },
      { data: { role: 'member' }, error: null },     // single: user_roles
      { data: [], error: null },                      // then: blocks (tasks)
      { data: [], error: null },                      // then: events (activity)
      { data: BLOCK, error: null },
      { data: [], error: null },   // empty events
      { data: [], error: null }    // empty edges
    )

    const ctx = await assembleContext('block-1', 'org-uuid', 'user_111')
    expect(ctx.events).toEqual([])
    expect(ctx.neighbours).toEqual([])
  })

  it('returns org-level context when blockId is null', async () => {
    const orgEvents = [
      { id: 'ev-1', block_id: 'block-1', type: 'block.created', actor_id: 'user_111', actor_type: 'human', payload: {}, occurred_at: '2026-03-02T10:00:00Z' },
    ]
    makeDb(
      { data: ORG, error: null },                              // single: org
      { data: { role: 'member' }, error: null },               // single: user_roles
      { data: [], error: null },                                // then: blocks (tasks)
      { data: [], error: null },                                // then: events (activity)
      { data: orgEvents, error: null },                        // then: org-level events
      { data: [{ type: 'client' }, { type: 'deal' }], error: null }, // then: blocks (type counts)
      { data: [], error: null },                               // then: workflow_jobs (active)
      { data: [{ id: 'e1' }], error: null },                  // then: events (24h count)
    )

    const ctx = await assembleContext(null, 'org-uuid', 'user_111')

    expect(ctx.block).toBeNull()
    expect(ctx.neighbours).toEqual([])
    expect(ctx.events).toHaveLength(1)
    expect(ctx.org?.id).toBe('org-uuid')
    expect(ctx.orgSummary).toContain('2 blocks total')
    expect(ctx.orgSummary).toContain('1 client')
    expect(ctx.orgSummary).toContain('0 active workflows')
    expect(ctx.orgSummary).toContain('1 events in the last 24 hours')
  })

  it('exports MAX_CONTEXT_EVENTS = 20', () => {
    expect(MAX_CONTEXT_EVENTS).toBe(20)
  })
})

describe('contextToPromptString', () => {
  const baseCtx: ContextObject = {
    block: BLOCK,
    events: EVENTS,
    relevantEvents: [],
    neighbours: [],
    org: ORG,
    userRole: 'member',
  }

  it('starts with [CONTEXT] and ends with [END CONTEXT]', () => {
    const str = contextToPromptString(baseCtx)
    expect(str).toMatch(/^\[CONTEXT\]/)
    expect(str).toMatch(/\[END CONTEXT\]$/)
  })

  it('includes block name and type', () => {
    const str = contextToPromptString(baseCtx)
    expect(str).toContain('Acme Ltd')
    expect(str).toContain('type: client')
  })

  it('includes jurisdiction from metadata', () => {
    const str = contextToPromptString(baseCtx)
    expect(str).toContain('jurisdiction: UK')
  })

  it('includes org name and user role', () => {
    const str = contextToPromptString(baseCtx)
    expect(str).toContain('Thornfield Capital')
    expect(str).toContain('User role: member')
  })

  it('lists events newest-first with type and actor', () => {
    const str = contextToPromptString(baseCtx)
    expect(str).toContain('block.updated')
    expect(str).toContain('actor: human/user_111')
    // newer event appears before older in the string
    const updatedIdx = str.indexOf('block.updated')
    const createdIdx = str.indexOf('block.created')
    expect(updatedIdx).toBeLessThan(createdIdx)
  })

  it('shows "(none)" when no neighbours', () => {
    const str = contextToPromptString(baseCtx)
    expect(str).toContain('Connected to: (none)')
  })

  it('lists neighbour names and types', () => {
    const ctxWithNeighbours: ContextObject = {
      ...baseCtx,
      neighbours: [
        { id: 'b2', org_id: 'org-uuid', type: 'deal', name: 'Deal Alpha', state: 'active', metadata: {}, owner_id: null, created_at: '', updated_at: '' },
      ],
    }
    const str = contextToPromptString(ctxWithNeighbours)
    expect(str).toContain('"Deal Alpha" (deal)')
  })

  it('formats org-level context when block is null', () => {
    const ctxOrgLevel: ContextObject = {
      block: null,
      events: EVENTS,
      relevantEvents: [],
      neighbours: [],
      org: ORG,
      userRole: 'member',
    }
    const str = contextToPromptString(ctxOrgLevel)
    expect(str).toContain('Scope: org-level')
  })

  it('truncates context at ~8000 tokens (~32000 chars)', () => {
    // Neighbour names are not truncated — use many long-name neighbours to exceed limit.
    // 500 neighbours × ~120 chars each ≈ 60k chars → triggers 32k guard.
    const manyNeighbours = Array.from({ length: 500 }, (_, i) => ({
      id: `block-n-${i}`,
      org_id: 'org-uuid',
      type: 'deal',
      name: `Deal ${String(i).padStart(3, '0')} — ${'long-name-to-fill-context'.repeat(4)}`,
      state: 'active',
      metadata: {},
      owner_id: null,
      created_at: '',
      updated_at: '',
    }))
    const ctxLong: ContextObject = { ...baseCtx, neighbours: manyNeighbours }
    const str = contextToPromptString(ctxLong)

    expect(str.length).toBeLessThanOrEqual(32_040) // 32000 slice + 38-char truncation suffix
    expect(str).toContain('context truncated')
    expect(str).toMatch(/\[END CONTEXT\]$/)
  })
})
