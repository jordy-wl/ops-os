/**
 * tests/unit/context-assembly.test.ts — Context Assembly Unit Tests
 *
 * Pure unit tests with mocked Supabase and OpenAI — no real services needed.
 * Tests cover: semantic search integration, no-query fallback, OpenAI failure
 * fallback, and contextToPromptString formatting for both event sections.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoist mocks before module imports ────────────────────────────────────────

const mockEmbeddingsCreate = vi.hoisted(() => vi.fn())

/** Stable client object — createServerClient always returns this same reference */
const mockClient = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    embeddings: { create: mockEmbeddingsCreate },
  })),
}))

vi.mock('@/lib/supabase/server', () => ({
  // Always return the same stable mockClient so beforeEach can reset its methods
  createServerClient: () => mockClient,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// ─── Import under test (after mocks) ──────────────────────────────────────────

import {
  assembleContext,
  contextToPromptString,
  MAX_CONTEXT_EVENTS,
  MAX_RECENT_EVENTS,
  MAX_SEMANTIC_EVENTS,
  type ContextObject,
  type Event,
} from '@/lib/context-assembly'
import { logger } from '@/lib/logger'

// ─── Test helpers ─────────────────────────────────────────────────────────────

/**
 * Thenable chainable query builder.
 * All methods return self (chainable). Awaiting the builder yields resolveValue.
 * This mirrors the real Supabase PostgrestFilterBuilder which is PromiseLike.
 */
function makeBuilder(resolveValue: { data: unknown; error?: unknown }) {
  const b: Record<string, unknown> = {}
  // Make it a thenable so `await builder.select(...).eq(...).in(...)` resolves correctly
  b.then = (resolve: (v: unknown) => void) => resolve(resolveValue)
  for (const method of ['select', 'eq', 'order', 'limit', 'single', 'in', 'or', 'gte']) {
    b[method] = vi.fn().mockReturnValue(b)
  }
  return b
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ORG_ID = 'org-111'
const BLOCK_ID = 'block-222'
const USER_ID = 'user-333'

const mockOrg = {
  id: ORG_ID, name: 'Test Org', slug: 'test-org',
  clerk_org_id: 'clerk_1', created_at: '2026-01-01T00:00:00Z',
}

const mockBlock = {
  id: BLOCK_ID, org_id: ORG_ID, type: 'client', name: 'Acme Capital', state: 'active',
  metadata: { jurisdiction: 'GB' }, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
}

function makeEvent(id: string, type = 'block.created'): Event {
  return {
    id, org_id: ORG_ID, block_id: BLOCK_ID, type,
    actor_id: 'user_abc', actor_type: 'user',
    payload: { note: `event-${id}` }, occurred_at: '2026-01-02T00:00:00Z',
  }
}

const recentEvents = [makeEvent('evt-1'), makeEvent('evt-2'), makeEvent('evt-3')]
const semanticEvent = makeEvent('evt-sem', 'compliance.review.started')

/** Standard block-level from() mock sequence — no query (4 calls) */
function setupBlockFromMocks(eventsData = recentEvents, edges: unknown[] = []) {
  mockClient.from
    .mockReturnValueOnce(makeBuilder({ data: mockOrg }))          // orgs
    .mockReturnValueOnce(makeBuilder({ data: mockBlock }))         // blocks (single)
    .mockReturnValueOnce(makeBuilder({ data: eventsData }))        // events (recent)
    .mockReturnValueOnce(makeBuilder({ data: edges }))             // block_edges
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('assembleContext', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    process.env.OPENAI_API_KEY = 'test-key'
    // Re-apply constructor mock after reset (resetAllMocks clears implementations)
    const { default: OpenAI } = await import('openai')
    vi.mocked(OpenAI).mockImplementation(() => ({
      embeddings: { create: mockEmbeddingsCreate },
    }) as unknown as InstanceType<typeof OpenAI>)
  })

  it('calls semantic search and returns both recent + relevant events when query provided', async () => {
    setupBlockFromMocks()
    // 5th from() call: fetch the semantic event by IDs
    mockClient.from.mockReturnValueOnce(makeBuilder({ data: [semanticEvent] }))

    mockEmbeddingsCreate.mockResolvedValueOnce({
      data: [{ embedding: new Array(1536).fill(0.1) }],
    })
    mockClient.rpc.mockResolvedValueOnce({
      data: [{ source_type: 'event', source_id: 'evt-sem', similarity: 0.92 }],
      error: null,
    })

    const ctx = await assembleContext(BLOCK_ID, ORG_ID, USER_ID, 'compliance review status')

    expect(mockEmbeddingsCreate).toHaveBeenCalledOnce()
    expect(mockClient.rpc).toHaveBeenCalledWith('match_embeddings', {
      query_embedding: expect.any(Array),
      match_count: MAX_SEMANTIC_EVENTS,
      filter_org_id: ORG_ID,
    })

    expect(ctx.events).toHaveLength(3)
    expect(ctx.relevantEvents).toHaveLength(1)
    expect(ctx.relevantEvents[0].id).toBe('evt-sem')
  })

  it('deduplicates: semantic event already in recent is excluded from relevantEvents', async () => {
    setupBlockFromMocks()
    // evt-1 is already in recentEvents — no new IDs to fetch

    mockEmbeddingsCreate.mockResolvedValueOnce({
      data: [{ embedding: new Array(1536).fill(0.1) }],
    })
    mockClient.rpc.mockResolvedValueOnce({
      data: [{ source_type: 'event', source_id: 'evt-1', similarity: 0.95 }],
      error: null,
    })

    const ctx = await assembleContext(BLOCK_ID, ORG_ID, USER_ID, 'any query')

    expect(ctx.relevantEvents).toHaveLength(0)
    // from() should only be called 4 times — no 5th call for deduplicated events
    expect(mockClient.from).toHaveBeenCalledTimes(4)
  })

  it('falls back to 20 recent events with no semantic search when no query given', async () => {
    setupBlockFromMocks()

    const ctx = await assembleContext(BLOCK_ID, ORG_ID, USER_ID)

    expect(mockEmbeddingsCreate).not.toHaveBeenCalled()
    expect(mockClient.rpc).not.toHaveBeenCalled()
    expect(ctx.events).toEqual(recentEvents)
    expect(ctx.relevantEvents).toHaveLength(0)
  })

  it('falls back to recency-only when OpenAI embedding call fails — never throws', async () => {
    setupBlockFromMocks()
    mockEmbeddingsCreate.mockRejectedValueOnce(new Error('OpenAI rate limit exceeded'))

    const ctx = await assembleContext(BLOCK_ID, ORG_ID, USER_ID, 'status update')

    expect(ctx.events).toHaveLength(3)
    expect(ctx.relevantEvents).toHaveLength(0)
    expect(logger.warn).toHaveBeenCalledWith(
      'context-assembly',
      'semantic.embed_failed',
      expect.objectContaining({ org_id: ORG_ID })
    )
  })

  it('falls back to recency-only when match_embeddings RPC fails — never throws', async () => {
    setupBlockFromMocks()
    mockEmbeddingsCreate.mockResolvedValueOnce({
      data: [{ embedding: new Array(1536).fill(0.1) }],
    })
    mockClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'RPC error' },
    })

    const ctx = await assembleContext(BLOCK_ID, ORG_ID, USER_ID, 'status')

    expect(ctx.relevantEvents).toHaveLength(0)
    expect(logger.warn).toHaveBeenCalledWith(
      'context-assembly',
      'semantic.rpc_failed',
      expect.objectContaining({ org_id: ORG_ID })
    )
  })

  it('assembles org-level context (blockId = null) with semantic search', async () => {
    mockClient.from
      .mockReturnValueOnce(makeBuilder({ data: mockOrg }))          // orgs
      .mockReturnValueOnce(makeBuilder({ data: recentEvents }))      // events (org-level, recent)
      .mockReturnValueOnce(makeBuilder({ data: [{ type: 'client' }] })) // blocks (type counts)
      .mockReturnValueOnce(makeBuilder({ data: [] }))               // workflow_jobs (active)
      .mockReturnValueOnce(makeBuilder({ data: [] }))               // events (24h count)
      .mockReturnValueOnce(makeBuilder({ data: [semanticEvent] }))   // events (semantic fetch)

    mockEmbeddingsCreate.mockResolvedValueOnce({
      data: [{ embedding: new Array(1536).fill(0.1) }],
    })
    mockClient.rpc.mockResolvedValueOnce({
      data: [{ source_type: 'event', source_id: 'evt-sem', similarity: 0.88 }],
      error: null,
    })

    const ctx = await assembleContext(null, ORG_ID, USER_ID, 'onboarding')

    expect(ctx.block).toBeNull()
    expect(ctx.events).toHaveLength(3)
    expect(ctx.relevantEvents).toHaveLength(1)
  })

  it('assembles org-level context (blockId = null) without query — no semantic search', async () => {
    mockClient.from
      .mockReturnValueOnce(makeBuilder({ data: mockOrg }))
      .mockReturnValueOnce(makeBuilder({ data: recentEvents }))
      .mockReturnValueOnce(makeBuilder({ data: [{ type: 'client' }, { type: 'deal' }] })) // blocks
      .mockReturnValueOnce(makeBuilder({ data: [{ id: 'j1' }] }))   // workflow_jobs (active)
      .mockReturnValueOnce(makeBuilder({ data: [{ id: 'e1' }] }))   // events (24h count)

    const ctx = await assembleContext(null, ORG_ID, USER_ID)

    expect(ctx.block).toBeNull()
    expect(ctx.relevantEvents).toHaveLength(0)
    expect(mockEmbeddingsCreate).not.toHaveBeenCalled()
    expect(ctx.orgSummary).toContain('2 blocks total')
    expect(ctx.orgSummary).toContain('1 active workflows')
    expect(ctx.orgSummary).toContain('1 events in the last 24 hours')
  })

  it('includes graphContext with direction labels when block has edges', async () => {
    const edges = [
      { from_block_id: 'parent-1', to_block_id: BLOCK_ID },
      { from_block_id: BLOCK_ID, to_block_id: 'child-1' },
    ]
    const parentBlock = { id: 'parent-1', org_id: ORG_ID, type: 'client', name: 'ParentCo', state: 'active', metadata: {}, created_at: '', updated_at: '' }
    const childBlock = { id: 'child-1', org_id: ORG_ID, type: 'contact', name: 'Jane Doe', state: 'active', metadata: {}, created_at: '', updated_at: '' }

    mockClient.from
      .mockReturnValueOnce(makeBuilder({ data: mockOrg }))       // orgs
      .mockReturnValueOnce(makeBuilder({ data: mockBlock }))      // blocks (single)
      .mockReturnValueOnce(makeBuilder({ data: recentEvents }))   // events (recent)
      .mockReturnValueOnce(makeBuilder({ data: edges }))          // block_edges
      .mockReturnValueOnce(makeBuilder({ data: [parentBlock, childBlock] })) // neighbour blocks

    const ctx = await assembleContext(BLOCK_ID, ORG_ID, USER_ID)

    expect(ctx.graphContext).toContain('ParentCo (client)')
    expect(ctx.graphContext).toContain('Jane Doe (contact)')
    expect(ctx.graphContext).toContain('Block relationships:')
  })

  it('sets graphContext to "none recorded" when block has no edges', async () => {
    setupBlockFromMocks(recentEvents, [])

    const ctx = await assembleContext(BLOCK_ID, ORG_ID, USER_ID)

    expect(ctx.graphContext).toBe('Block relationships: none recorded')
  })

  it('omits orgSummary gracefully when summary queries fail', async () => {
    // Provide org response, events response, but null for the 3 summary queries
    mockClient.from
      .mockReturnValueOnce(makeBuilder({ data: mockOrg }))
      .mockReturnValueOnce(makeBuilder({ data: recentEvents }))
      .mockReturnValueOnce(makeBuilder({ data: null }))  // blocks: null
      .mockReturnValueOnce(makeBuilder({ data: null }))  // workflow_jobs: null
      .mockReturnValueOnce(makeBuilder({ data: null }))  // events 24h: null

    const ctx = await assembleContext(null, ORG_ID, USER_ID)

    // Should still return a valid context (orgSummary uses ?? to handle null data)
    expect(ctx.events).toHaveLength(3)
    expect(ctx.orgSummary).toContain('0 blocks total')
  })
})

describe('contextToPromptString', () => {
  const baseContext: ContextObject = {
    block: {
      id: BLOCK_ID, org_id: ORG_ID, type: 'client', name: 'Thornfield Capital',
      state: 'active', metadata: { jurisdiction: 'GB' },
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    },
    events: [makeEvent('evt-r1', 'block.created'), makeEvent('evt-r2', 'workflow.started')],
    relevantEvents: [],
    neighbours: [],
    org: { id: ORG_ID, name: 'Test Org', slug: 'test-org', clerk_org_id: 'c1', created_at: '2026-01-01T00:00:00Z' },
    userRole: 'member',
  }

  it('renders only the recent events section when relevantEvents is empty', () => {
    const result = contextToPromptString(baseContext)

    expect(result).toContain('[CONTEXT]')
    expect(result).toContain('Recent events (last 2, newest first):')
    expect(result).toContain('block.created')
    expect(result).toContain('workflow.started')
    expect(result).not.toContain('Relevant events')
    expect(result).toContain('[END CONTEXT]')
  })

  it('renders both recent and relevant sections when relevantEvents is non-empty', () => {
    const ctx: ContextObject = {
      ...baseContext,
      relevantEvents: [makeEvent('evt-s1', 'compliance.review.started')],
    }
    const result = contextToPromptString(ctx)

    expect(result).toContain('Recent events (last 2, newest first):')
    expect(result).toContain('Relevant events (semantically matched, 1):')
    expect(result).toContain('compliance.review.started')
    expect(result).toContain('[END CONTEXT]')

    // Recent section precedes relevant section
    expect(result.indexOf('Recent events')).toBeLessThan(result.indexOf('Relevant events'))
  })

  it('handles missing relevantEvents gracefully (backward compat)', () => {
    const ctx = { ...baseContext, relevantEvents: undefined as unknown as Event[] }

    expect(() => contextToPromptString(ctx)).not.toThrow()
    expect(contextToPromptString(ctx)).not.toContain('Relevant events')
  })

  it('includes org name and block metadata in output', () => {
    const result = contextToPromptString(baseContext)

    expect(result).toContain('Org: Test Org')
    expect(result).toContain('"Thornfield Capital"')
    expect(result).toContain('jurisdiction: GB')
  })
})

describe('constants', () => {
  it('combined recent + semantic events does not exceed MAX_CONTEXT_EVENTS', () => {
    expect(MAX_RECENT_EVENTS + MAX_SEMANTIC_EVENTS).toBeLessThanOrEqual(MAX_CONTEXT_EVENTS)
  })
})
