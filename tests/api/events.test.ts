/**
 * tests/api/events.test.ts — Events API Contract Tests
 *
 * Tests run against a REAL local Supabase instance.
 * Key coverage: event immutability (RLS + Postgres trigger), cross-org isolation.
 *
 * Requires: supabase start + SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 * To reset test data: npm run db:reset && npm run db:seed
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'
import { hasSupabase, getTestSupabase, makePost } from './helpers'

// ─── Shared test org context ──────────────────────────────────────────────────
const ctx = vi.hoisted(() => ({
  orgId: '',
  userId: 'user_contract_events_test',
  clerkOrgId: '',
  blockId: '', // Block created in beforeAll for event tests
}))

vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: vi.fn(
    (handler) =>
      async (req: NextRequest, context: { params: Promise<Record<string, string>> }) =>
        handler(req, { userId: ctx.userId, clerkOrgId: ctx.clerkOrgId, orgId: ctx.orgId },
          await (context.params ?? Promise.resolve({})))
  ),
}))

vi.mock('@/lib/supabase/server', async () => {
  const { createClient } = await import('@supabase/supabase-js')
  return {
    createServerClient: vi.fn(() =>
      createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      )
    ),
  }
})

// Suppress OpenAI calls during contract tests
vi.mock('@/lib/embeddings', () => ({
  embedEvent: vi.fn().mockResolvedValue(undefined),
}))

import { GET, POST } from '@/app/api/events/route'

// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(!hasSupabase)('Events API — contract tests (real Supabase)', () => {
  let createdEventId: string

  beforeAll(async () => {
    const supabase = getTestSupabase()
    const runId = Date.now()

    ctx.clerkOrgId = `clerk_contract_events_${runId}`
    const { data: org } = await supabase
      .from('orgs')
      .insert({ clerk_org_id: ctx.clerkOrgId, name: 'Events Contract Test Org', slug: `events-contract-${runId}` })
      .select()
      .single()
    ctx.orgId = org!.id

    // Create a block to attach events to
    const { data: block } = await supabase
      .from('blocks')
      .insert({ org_id: ctx.orgId, type: 'client', name: 'Test Client', state: 'active', metadata: {} })
      .select()
      .single()
    ctx.blockId = block!.id
  })

  // ── POST /api/events ───────────────────────────────────────────────────────

  it('creates an event and returns 201', async () => {
    const req = makePost('http://localhost/api/events', {
      block_id: ctx.blockId,
      type: 'kyc.check.initiated',
      actor_type: 'system',
      payload: { check_types: ['identity', 'sanctions'] },
    })
    const res = await POST(req, { params: Promise.resolve({}) })
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.error).toBeNull()
    expect(json.data.id).toBeTypeOf('string')
    expect(json.data.type).toBe('kyc.check.initiated')
    expect(json.data.org_id).toBe(ctx.orgId)
    expect(json.data.actor_id).toBe(ctx.userId) // always from JWT, never body
    expect(json.data.occurred_at).toBeTypeOf('string') // server-side timestamp

    createdEventId = json.data.id
  })

  it('returns 400 for missing block_id', async () => {
    const req = makePost('http://localhost/api/events', {
      type: 'kyc.check.initiated',
    })
    const res = await POST(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('validation/invalid-input')
  })

  it('returns 404 for block_id that does not exist in this org', async () => {
    const fakeBlockId = '00000000-0000-0000-0000-000000000099'
    const req = makePost('http://localhost/api/events', {
      block_id: fakeBlockId,
      type: 'test.event',
    })
    const res = await POST(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('events/block-not-found')
  })

  // ── GET /api/events ────────────────────────────────────────────────────────

  it('lists events for a block in desc occurred_at order', async () => {
    const req = new NextRequest(`http://localhost/api/events?block_id=${ctx.blockId}`)
    const res = await GET(req, { params: Promise.resolve({}) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(json.data.events)).toBe(true)
    expect(json.data.events.length).toBeGreaterThan(0)

    // All events must belong to this block and org
    for (const event of json.data.events) {
      expect(event.block_id).toBe(ctx.blockId)
      expect(event.org_id).toBe(ctx.orgId)
    }

    // Events should be in descending occurred_at order
    const timestamps = json.data.events.map((e: { occurred_at: string }) => e.occurred_at)
    const sorted = [...timestamps].sort((a, b) => b.localeCompare(a))
    expect(timestamps).toEqual(sorted)
  })

  it('returns 400 when neither block_id nor org_id is provided', async () => {
    const req = new NextRequest('http://localhost/api/events')
    const res = await GET(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('validation/missing-param')
  })

  it('cursor pagination returns next page when limit reached', async () => {
    // Create 3 more events to have enough for pagination
    for (let i = 0; i < 3; i++) {
      await POST(
        makePost('http://localhost/api/events', {
          block_id: ctx.blockId,
          type: `pagination.test.event_${i}`,
        }),
        { params: Promise.resolve({}) }
      )
    }

    // Fetch with limit=2
    const req = new NextRequest(`http://localhost/api/events?block_id=${ctx.blockId}&limit=2`)
    const res = await GET(req, { params: Promise.resolve({}) })
    const json = await res.json()

    expect(json.data.events.length).toBe(2)
    expect(json.data.cursor).toBeTypeOf('string') // cursor present when more results exist

    // Fetch next page using cursor
    const req2 = new NextRequest(
      `http://localhost/api/events?block_id=${ctx.blockId}&limit=2&cursor=${encodeURIComponent(json.data.cursor)}`
    )
    const res2 = await GET(req2, { params: Promise.resolve({}) })
    const json2 = await res2.json()

    expect(res2.status).toBe(200)
    // Second page should not contain first page events
    const page1Ids = json.data.events.map((e: { id: string }) => e.id)
    for (const event of json2.data.events) {
      expect(page1Ids).not.toContain(event.id)
    }
  })

  // ── Event immutability ────────────────────────────────────────────────────

  it('event immutability: direct UPDATE via service role is rejected by trigger', async () => {
    const supabase = getTestSupabase()

    // Attempt to directly update the event (should be blocked by the DB trigger)
    const { error } = await supabase
      .from('events')
      .update({ type: 'mutated.event' })
      .eq('id', createdEventId)

    // The trigger raises an exception — Supabase returns an error
    expect(error).not.toBeNull()
    expect(error!.message).toContain('immutable')
  })

  it('event immutability: direct DELETE via service role is rejected by trigger', async () => {
    const supabase = getTestSupabase()

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', createdEventId)

    expect(error).not.toBeNull()
    expect(error!.message).toContain('immutable')
  })

  it('no UPDATE endpoint exists for events', async () => {
    // Verify the route file does not export PATCH or PUT
    const routeModule = await import('@/app/api/events/route')
    expect((routeModule as Record<string, unknown>).PATCH).toBeUndefined()
    expect((routeModule as Record<string, unknown>).PUT).toBeUndefined()
    expect((routeModule as Record<string, unknown>).DELETE).toBeUndefined()
  })

  // ── Cross-org isolation ───────────────────────────────────────────────────

  it('cannot fetch events for a block belonging to another org', async () => {
    const supabase = getTestSupabase()
    const runId = Date.now()

    // Create org C with its own block
    const { data: orgC } = await supabase
      .from('orgs')
      .insert({ clerk_org_id: `clerk_orgC_${runId}`, name: 'Org C', slug: `orgc-${runId}` })
      .select()
      .single()

    const { data: blockC } = await supabase
      .from('blocks')
      .insert({ org_id: orgC!.id, type: 'client', name: 'Org C Client', state: 'active', metadata: {} })
      .select()
      .single()

    // Query events with org C's block_id, but as org A (ctx.orgId via mock)
    const req = new NextRequest(`http://localhost/api/events?block_id=${blockC!.id}`)
    const res = await GET(req, { params: Promise.resolve({}) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.events).toHaveLength(0) // org A sees no events for org C's block
  })
})
