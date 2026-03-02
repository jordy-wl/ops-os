/**
 * tests/api/blocks.test.ts — Blocks API Contract Tests
 *
 * Tests run against a REAL local Supabase instance.
 * Requires: supabase start + SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Tests DO NOT clean up created data (events immutability trigger prevents cascade delete).
 * To reset: npm run db:reset && npm run db:seed
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'
import { hasSupabase, getTestSupabase, makePost, makePatch } from './helpers'

// ─── Shared test org context (populated in beforeAll) ────────────────────────
const ctx = vi.hoisted(() => ({
  orgId: '',
  orgBId: '', // second org for cross-org isolation tests
  userId: 'user_contract_test',
  clerkOrgId: '',
  clerkOrgBId: '',
}))

vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: vi.fn(
    (handler) =>
      async (req: NextRequest, context: { params: Promise<Record<string, string>> }) =>
        handler(req, { userId: ctx.userId, clerkOrgId: ctx.clerkOrgId, orgId: ctx.orgId },
          await (context.params ?? Promise.resolve({})))
  ),
}))

vi.mock('@/lib/supabase/server', async (importActual) => {
  // Use REAL Supabase client — this is the key difference from unit tests
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

// Mock embeddings to prevent OpenAI calls in contract tests
vi.mock('@/lib/embeddings', () => ({
  embedEvent: vi.fn().mockResolvedValue(undefined),
}))

import { GET, POST } from '@/app/api/blocks/route'
import { GET as GET_ONE, PATCH } from '@/app/api/blocks/[id]/route'
import { GET as GET_NEIGHBOURS } from '@/app/api/blocks/[id]/neighbours/route'
import { POST as POST_EDGE } from '@/app/api/blocks/[id]/edges/route'

// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(!hasSupabase)('Blocks API — contract tests (real Supabase)', () => {
  let createdBlockId: string

  beforeAll(async () => {
    const supabase = getTestSupabase()
    const runId = Date.now()

    // Org A — primary test org
    ctx.clerkOrgId = `clerk_contract_blocks_${runId}`
    const { data: orgA } = await supabase
      .from('orgs')
      .insert({ clerk_org_id: ctx.clerkOrgId, name: 'Contract Test Org A', slug: `contract-a-${runId}` })
      .select()
      .single()
    ctx.orgId = orgA!.id

    // Org B — for cross-org isolation tests
    ctx.clerkOrgBId = `clerk_contract_blocks_b_${runId}`
    const { data: orgB } = await supabase
      .from('orgs')
      .insert({ clerk_org_id: ctx.clerkOrgBId, name: 'Contract Test Org B', slug: `contract-b-${runId}` })
      .select()
      .single()
    ctx.orgBId = orgB!.id
  })

  // ── POST /api/blocks ───────────────────────────────────────────────────────

  it('creates a block and returns 201 with correct shape', async () => {
    const req = makePost('http://localhost/api/blocks', {
      type: 'client',
      name: 'Acme Corp (contract test)',
      metadata: { jurisdiction: 'GB', aum: '£100M' },
    })
    const res = await POST(req, { params: Promise.resolve({}) })
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.error).toBeNull()
    expect(json.data.block.id).toBeTypeOf('string')
    expect(json.data.block.type).toBe('client')
    expect(json.data.block.name).toBe('Acme Corp (contract test)')
    expect(json.data.block.org_id).toBe(ctx.orgId)
    expect(json.data.event.type).toBe('block.created')

    createdBlockId = json.data.block.id
  })

  it('returns 400 for missing required fields', async () => {
    const req = makePost('http://localhost/api/blocks', { type: 'client' }) // name missing
    const res = await POST(req, { params: Promise.resolve({}) })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.data).toBeNull()
    expect(json.error.code).toBe('validation/invalid-input')
  })

  it('returns 400 for invalid block type', async () => {
    const req = makePost('http://localhost/api/blocks', { type: 'invoice', name: 'Test' })
    const res = await POST(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(400)
  })

  // ── GET /api/blocks ────────────────────────────────────────────────────────

  it('lists blocks for the org', async () => {
    const req = new NextRequest('http://localhost/api/blocks')
    const res = await GET(req, { params: Promise.resolve({}) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(json.data.blocks)).toBe(true)
    expect(json.data.blocks.length).toBeGreaterThan(0)
    // All blocks must belong to this org
    for (const block of json.data.blocks) {
      expect(block.org_id).toBe(ctx.orgId)
    }
  })

  it('filters by type', async () => {
    const req = new NextRequest('http://localhost/api/blocks?type=client')
    const res = await GET(req, { params: Promise.resolve({}) })
    const json = await res.json()

    expect(res.status).toBe(200)
    for (const block of json.data.blocks) {
      expect(block.type).toBe('client')
    }
  })

  // ── GET /api/blocks/:id ────────────────────────────────────────────────────

  it('returns block with events', async () => {
    const req = new NextRequest(`http://localhost/api/blocks/${createdBlockId}`)
    const res = await GET_ONE(req, { params: Promise.resolve({ id: createdBlockId }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.block.id).toBe(createdBlockId)
    expect(Array.isArray(json.data.events)).toBe(true)
    expect(json.data.events.length).toBeGreaterThan(0)
    expect(json.data.events[0].type).toBe('block.created')
  })

  it('returns 404 for non-existent block', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000099'
    const req = new NextRequest(`http://localhost/api/blocks/${fakeId}`)
    const res = await GET_ONE(req, { params: Promise.resolve({ id: fakeId }) })
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe('blocks/not-found')
  })

  // ── PATCH /api/blocks/:id ──────────────────────────────────────────────────

  it('updates a block and creates block.updated event', async () => {
    const req = makePatch(`http://localhost/api/blocks/${createdBlockId}`, {
      name: 'Acme Corp (updated)',
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: createdBlockId }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.block.name).toBe('Acme Corp (updated)')
    expect(json.data.event.type).toBe('block.updated')
    expect(json.data.event.payload.diff).toBeDefined()
    expect(json.data.event.payload.diff.name.before).toBe('Acme Corp (contract test)')
    expect(json.data.event.payload.diff.name.after).toBe('Acme Corp (updated)')
  })

  it('returns 400 when PATCH body is empty', async () => {
    const req = makePatch(`http://localhost/api/blocks/${createdBlockId}`, {})
    const res = await PATCH(req, { params: Promise.resolve({ id: createdBlockId }) })
    expect(res.status).toBe(400)
  })

  // ── Cross-org isolation ────────────────────────────────────────────────────

  it('cannot read a block from another org', async () => {
    // Create a block in org B
    const supabase = getTestSupabase()
    const { data: orgBBlock } = await supabase
      .from('blocks')
      .insert({ org_id: ctx.orgBId, type: 'client', name: 'Org B Block', state: 'active', metadata: {} })
      .select()
      .single()

    // Try to fetch org B's block as org A (ctx.orgId)
    const req = new NextRequest(`http://localhost/api/blocks/${orgBBlock!.id}`)
    const res = await GET_ONE(req, { params: Promise.resolve({ id: orgBBlock!.id }) })

    expect(res.status).toBe(404) // returns 404 (not 403) — does not reveal cross-org existence
  })

  it('list endpoint only returns blocks for current org', async () => {
    // Org B's block should not appear in org A's list
    const req = new NextRequest('http://localhost/api/blocks')
    const res = await GET(req, { params: Promise.resolve({}) })
    const json = await res.json()

    for (const block of json.data.blocks) {
      expect(block.org_id).toBe(ctx.orgId)
    }
  })

  // ── Edges + Neighbours ────────────────────────────────────────────────────

  it('creates an edge and retrieves neighbours', async () => {
    // Create a second block in org A
    const req2 = makePost('http://localhost/api/blocks', {
      type: 'deal',
      name: 'Deal Alpha (contract test)',
    })
    const res2 = await POST(req2, { params: Promise.resolve({}) })
    const blockBId = (await res2.json()).data.block.id

    // Create edge: createdBlockId → blockBId
    const edgeReq = makePost(`http://localhost/api/blocks/${createdBlockId}/edges`, {
      to_block_id: blockBId,
      edge_type: 'owns',
    })
    const edgeRes = await POST_EDGE(edgeReq, { params: Promise.resolve({ id: createdBlockId }) })
    expect(edgeRes.status).toBe(201)

    // Fetch neighbours of createdBlockId
    const neighbourReq = new NextRequest(`http://localhost/api/blocks/${createdBlockId}/neighbours`)
    const neighbourRes = await GET_NEIGHBOURS(neighbourReq, { params: Promise.resolve({ id: createdBlockId }) })
    const neighbourJson = await neighbourRes.json()

    expect(neighbourRes.status).toBe(200)
    const neighbourIds = neighbourJson.data.neighbours.map((b: { id: string }) => b.id)
    expect(neighbourIds).toContain(blockBId)
  })
})
