import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import { getOrgOverview } from '../overview'

// ─── Mock Supabase Builder ───────────────────────────────────────────────────

/**
 * Creates a mock Supabase client that returns configured responses
 * for .from() queries and .rpc() calls, tracked by call order per table.
 */
function createMockSupabase(config: {
  orgs?: { data: unknown; error: unknown }
  rpc?: { data: unknown; error: unknown }
  rpcBlockHierarchy?: { data: unknown; error: unknown }
  blocks?: { data: unknown; error: unknown }[]
  events?: { data: unknown; error: unknown }
}) {
  const blockCallIndex = { current: 0 }

  function buildChain(response: { data: unknown; error: unknown }) {
    const terminal = vi.fn().mockResolvedValue(response)
    const chain: Record<string, ReturnType<typeof vi.fn>> = {}

    // Each method returns the chain, terminal methods return the response
    chain.select = vi.fn().mockReturnValue(chain)
    chain.eq = vi.fn().mockReturnValue(chain)
    chain.in = vi.fn().mockReturnValue(chain)
    chain.order = vi.fn().mockReturnValue(chain)
    chain.limit = vi.fn().mockReturnValue(chain)
    chain.single = terminal
    // For non-.single() queries, make the chain itself thenable
    chain.then = vi.fn().mockImplementation((resolve, reject) =>
      Promise.resolve(response).then(resolve, reject)
    )
    return chain
  }

  const fromFn = vi.fn().mockImplementation((table: string) => {
    if (table === 'orgs') {
      return buildChain(config.orgs ?? { data: null, error: null })
    }
    if (table === 'blocks') {
      const responses = config.blocks ?? []
      const idx = blockCallIndex.current++
      return buildChain(responses[idx] ?? { data: [], error: null })
    }
    if (table === 'events') {
      return buildChain(config.events ?? { data: [], error: null })
    }
    return buildChain({ data: null, error: null })
  })

  const rpcFn = vi.fn().mockImplementation((fnName: string) => {
    if (fnName === 'get_block_hierarchy') {
      return Promise.resolve(config.rpcBlockHierarchy ?? { data: [], error: null })
    }
    return Promise.resolve(config.rpc ?? { data: [], error: null })
  })

  return { from: fromFn, rpc: rpcFn } as unknown as SupabaseClient
}

// ─── Test Data ───────────────────────────────────────────────────────────────

const ORG_ID = '00000000-0000-0000-0000-000000000001'
const SUB_ID = '00000000-0000-0000-0000-000000000002'

const ORG_DETAILS = {
  id: ORG_ID,
  name: 'Thornfield Capital',
  slug: 'thornfield-capital',
  org_level: 'org',
  created_at: '2026-01-01T00:00:00Z',
}

const HIERARCHY_ROWS = [
  { id: ORG_ID, name: 'Thornfield Capital', org_level: 'org', parent_org_id: null },
  { id: SUB_ID, name: 'APAC Division', org_level: 'suborg', parent_org_id: ORG_ID },
]

const TEAM_MEMBERS = [
  { id: 'tm-1', name: 'Alice Smith', data: { role: 'ops-admin' } },
  { id: 'tm-2', name: 'Bob Jones', data: { role: 'ops-user' } },
  { id: 'tm-3', name: 'Carol White', data: { role: 'ops-user' } },
  { id: 'tm-4', name: 'Dave Brown', data: { role: 'compliance-approver' } },
  { id: 'tm-5', name: 'Eve Green', data: { role: 'ops-user' } },
  { id: 'tm-6', name: 'Frank Black', data: { role: 'ops-admin' } },
]

const ALL_BLOCKS = [
  { type: 'client' },
  { type: 'client' },
  { type: 'client' },
  { type: 'deal' },
  { type: 'deal' },
  { type: 'project' },
  { type: 'contact' },
  { type: 'contact' },
  { type: 'contact' },
  { type: 'contact' },
  { type: 'solution' },
  { type: 'product' },
  // These should be excluded from the count
  { type: 'workflow_template' },
  { type: 'workflow_instance' },
  { type: 'task_queue_item' },
  { type: 'team_member' },
  { type: 'document_template' },
  { type: 'policy' },
]

const WORKFLOW_INSTANCES = [
  { data: { status: 'running' } },
  { data: { status: 'running' } },
  { data: { status: 'completed' } },
  { data: { status: 'completed' } },
  { data: { status: 'completed' } },
  { data: { status: 'pending' } },
  { data: { status: 'failed' } },
]

const RECENT_EVENTS = [
  { id: 'evt-1', event_type: 'block.created', occurred_at: '2026-03-10T10:00:00Z', payload: { block_type: 'client' } },
  { id: 'evt-2', event_type: 'workflow.step.completed', occurred_at: '2026-03-10T09:00:00Z', payload: { step: 'kyc' } },
  { id: 'evt-3', event_type: 'block.updated', occurred_at: '2026-03-10T08:00:00Z', payload: {} },
]

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('getOrgOverview', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns complete overview with correct structure', async () => {
    const supabase = createMockSupabase({
      orgs: { data: ORG_DETAILS, error: null },
      rpc: { data: HIERARCHY_ROWS, error: null },
      blocks: [
        { data: TEAM_MEMBERS, error: null },     // team_member query
        { data: ALL_BLOCKS, error: null },        // all blocks query
        { data: WORKFLOW_INSTANCES, error: null }, // workflow_instance query
      ],
      events: { data: RECENT_EVENTS, error: null },
    })

    const result = await getOrgOverview(supabase, ORG_ID)

    expect(result).not.toBeNull()
    expect(result!.org.id).toBe(ORG_ID)
    expect(result!.org.name).toBe('Thornfield Capital')
    expect(result!.org.slug).toBe('thornfield-capital')
    expect(result!.org.org_level).toBe('org')
    expect(result!.org.created_at).toBe('2026-01-01T00:00:00Z')

    // Hierarchy
    expect(result!.hierarchy).toHaveLength(2)
    expect(result!.hierarchy[0].level).toBe('org')
    expect(result!.hierarchy[1].name).toBe('APAC Division')

    // Events
    expect(result!.recent_events).toHaveLength(3)
    expect(result!.recent_events[0].event_type).toBe('block.created')
  })

  it('returns null when org is not found', async () => {
    const supabase = createMockSupabase({
      orgs: { data: null, error: { code: 'PGRST116' } },
      rpc: { data: [], error: null },
      blocks: [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ],
      events: { data: [], error: null },
    })

    const result = await getOrgOverview(supabase, 'nonexistent-id')
    expect(result).toBeNull()
  })

  it('counts blocks by type, excluding system types', async () => {
    const supabase = createMockSupabase({
      orgs: { data: ORG_DETAILS, error: null },
      rpc: { data: HIERARCHY_ROWS, error: null },
      blocks: [
        { data: [], error: null },                // team members
        { data: ALL_BLOCKS, error: null },         // all blocks
        { data: [], error: null },                 // workflow instances
      ],
      events: { data: [], error: null },
    })

    const result = await getOrgOverview(supabase, ORG_ID)

    expect(result).not.toBeNull()
    // 18 total blocks - 6 excluded types = 12 visible blocks
    expect(result!.blocks.total).toBe(12)
    expect(result!.blocks.by_type).toEqual({
      client: 3,
      deal: 2,
      project: 1,
      contact: 4,
      solution: 1,
      product: 1,
    })

    // Excluded types should NOT appear
    expect(result!.blocks.by_type).not.toHaveProperty('workflow_template')
    expect(result!.blocks.by_type).not.toHaveProperty('workflow_instance')
    expect(result!.blocks.by_type).not.toHaveProperty('task_queue_item')
    expect(result!.blocks.by_type).not.toHaveProperty('team_member')
    expect(result!.blocks.by_type).not.toHaveProperty('document_template')
    expect(result!.blocks.by_type).not.toHaveProperty('policy')
  })

  it('calculates team role distribution correctly', async () => {
    const supabase = createMockSupabase({
      orgs: { data: ORG_DETAILS, error: null },
      rpc: { data: [], error: null },
      blocks: [
        { data: TEAM_MEMBERS, error: null },  // team members
        { data: [], error: null },              // all blocks
        { data: [], error: null },              // workflow instances
      ],
      events: { data: [], error: null },
    })

    const result = await getOrgOverview(supabase, ORG_ID)

    expect(result).not.toBeNull()
    expect(result!.team.total).toBe(6)
    expect(result!.team.by_role).toEqual({
      'ops-admin': 2,
      'ops-user': 3,
      'compliance-approver': 1,
    })

    // Recent should contain at most 5 members
    expect(result!.team.recent).toHaveLength(5)
    expect(result!.team.recent[0].name).toBe('Alice Smith')
    expect(result!.team.recent[0].role).toBe('ops-admin')
  })

  it('calculates workflow status counts correctly', async () => {
    const supabase = createMockSupabase({
      orgs: { data: ORG_DETAILS, error: null },
      rpc: { data: [], error: null },
      blocks: [
        { data: [], error: null },                 // team members
        { data: [], error: null },                  // all blocks
        { data: WORKFLOW_INSTANCES, error: null },   // workflow instances
      ],
      events: { data: [], error: null },
    })

    const result = await getOrgOverview(supabase, ORG_ID)

    expect(result).not.toBeNull()
    // 2 running + 1 pending = 3 active, 3 completed, 7 total
    expect(result!.workflows.active).toBe(3)
    expect(result!.workflows.completed).toBe(3)
    expect(result!.workflows.total).toBe(7)
  })

  it('limits recent events to the configured amount', async () => {
    // The fetch asks for 10, but we only provide 3 — verifying the shape
    const supabase = createMockSupabase({
      orgs: { data: ORG_DETAILS, error: null },
      rpc: { data: [], error: null },
      blocks: [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ],
      events: { data: RECENT_EVENTS, error: null },
    })

    const result = await getOrgOverview(supabase, ORG_ID)

    expect(result).not.toBeNull()
    expect(result!.recent_events).toHaveLength(3)
    // Maps occurred_at to created_at in the response
    expect(result!.recent_events[0].created_at).toBe('2026-03-10T10:00:00Z')
    expect(result!.recent_events[0].event_type).toBe('block.created')
    expect(result!.recent_events[0].payload).toEqual({ block_type: 'client' })
  })

  it('handles empty org gracefully — zero blocks, zero team, zero events', async () => {
    const supabase = createMockSupabase({
      orgs: { data: ORG_DETAILS, error: null },
      rpc: { data: [{ id: ORG_ID, name: 'Thornfield Capital', org_level: 'org', parent_org_id: null }], error: null },
      blocks: [
        { data: [], error: null },  // team members
        { data: [], error: null },  // all blocks
        { data: [], error: null },  // workflow instances
      ],
      events: { data: [], error: null },
    })

    const result = await getOrgOverview(supabase, ORG_ID)

    expect(result).not.toBeNull()
    expect(result!.team.total).toBe(0)
    expect(result!.team.by_role).toEqual({})
    expect(result!.team.recent).toEqual([])
    expect(result!.blocks.total).toBe(0)
    expect(result!.blocks.by_type).toEqual({})
    expect(result!.workflows.active).toBe(0)
    expect(result!.workflows.completed).toBe(0)
    expect(result!.workflows.total).toBe(0)
    expect(result!.recent_events).toEqual([])
  })

  it('handles team members with missing role data', async () => {
    const membersNoRole = [
      { id: 'tm-1', name: 'No Role User', data: {} },
      { id: 'tm-2', name: 'Null Data', data: null },
    ]

    const supabase = createMockSupabase({
      orgs: { data: ORG_DETAILS, error: null },
      rpc: { data: [], error: null },
      blocks: [
        { data: membersNoRole, error: null },
        { data: [], error: null },
        { data: [], error: null },
      ],
      events: { data: [], error: null },
    })

    const result = await getOrgOverview(supabase, ORG_ID)

    expect(result).not.toBeNull()
    expect(result!.team.total).toBe(2)
    expect(result!.team.by_role).toEqual({ unassigned: 2 })
  })

  it('handles DB errors on individual queries gracefully', async () => {
    // Org found, but other queries fail — should return zero counts, not crash
    const supabase = createMockSupabase({
      orgs: { data: ORG_DETAILS, error: null },
      rpc: { data: null, error: { code: 'DB_ERR' } },
      blocks: [
        { data: null, error: { code: 'DB_ERR' } },  // team
        { data: null, error: { code: 'DB_ERR' } },  // blocks
        { data: null, error: { code: 'DB_ERR' } },  // workflows
      ],
      events: { data: null, error: { code: 'DB_ERR' } },
    })

    const result = await getOrgOverview(supabase, ORG_ID)

    expect(result).not.toBeNull()
    expect(result!.hierarchy).toEqual([])
    expect(result!.team.total).toBe(0)
    expect(result!.blocks.total).toBe(0)
    expect(result!.workflows.total).toBe(0)
    expect(result!.recent_events).toEqual([])
  })

  it('maps hierarchy rows correctly with parent references', async () => {
    const supabase = createMockSupabase({
      orgs: { data: ORG_DETAILS, error: null },
      rpc: { data: HIERARCHY_ROWS, error: null },
      blocks: [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ],
      events: { data: [], error: null },
    })

    const result = await getOrgOverview(supabase, ORG_ID)

    expect(result).not.toBeNull()
    expect(result!.hierarchy).toHaveLength(2)

    const root = result!.hierarchy[0]
    expect(root.id).toBe(ORG_ID)
    expect(root.level).toBe('org')
    expect(root.parent_org_id).toBeNull()

    const sub = result!.hierarchy[1]
    expect(sub.id).toBe(SUB_ID)
    expect(sub.level).toBe('suborg')
    expect(sub.parent_org_id).toBe(ORG_ID)
  })
})
