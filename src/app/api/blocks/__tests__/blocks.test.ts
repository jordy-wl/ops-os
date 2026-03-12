import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { AuthContext } from '@/lib/auth/withAuth'

// Bypass withAuth — its own tests cover auth logic
vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: vi.fn(
    (handler: (req: NextRequest, ctx: AuthContext, params: Record<string, string>) => Promise<Response>) =>
      async (req: NextRequest, context: { params: Promise<Record<string, string>> }) => {
        const params = await context.params
        return handler(
          req,
          { userId: 'user_111', clerkOrgId: 'org_abc', orgId: 'uuid-org-1', role: 'ops-admin' as const },
          params
        )
      }
  ),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

import { createServerClient } from '@/lib/supabase/server'

// ─── Mock DB helper ────────────────────────────────────────────────────────────
// Responses are consumed in call order — both .single() and awaited chains
// share the same sequential queue.
function makeDb(...responses: { data: unknown; error: unknown }[]) {
  const queue = [...responses]
  let i = 0

  const singleFn = vi.fn().mockImplementation(() => Promise.resolve(queue[i++] ?? { data: null, error: null }))

  const maybeSingleFn = vi.fn().mockImplementation(() => Promise.resolve(queue[i++] ?? { data: null, error: null }))

  const rpcFn = vi.fn().mockImplementation(() => Promise.resolve(queue[i++] ?? { data: null, error: null }))

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
    lt: vi.fn().mockReturnThis(),
    single: singleFn,
    maybeSingle: maybeSingleFn,
    rpc: rpcFn,
    // Thenable for array-returning queries (awaited without .single())
    then: (resolve: (v: unknown) => void, reject: (r: unknown) => void) =>
      Promise.resolve(queue[i++] ?? { data: [], error: null }).then(resolve, reject),
  }

  vi.mocked(createServerClient).mockReturnValue(chain as unknown as ReturnType<typeof createServerClient>)
  return { chain, singleFn }
}

const makeReq = (url = 'http://localhost/api/blocks', opts?: RequestInit) =>
  new NextRequest(url, opts as ConstructorParameters<typeof NextRequest>[1])

// ─── Import routes after mocks are set up ──────────────────────────────────────
const { GET: listBlocks, POST: createBlock } = await import('@/app/api/blocks/route')
const { GET: getBlock, PATCH: patchBlock } = await import('@/app/api/blocks/[id]/route')
const { GET: getNeighbours } = await import('@/app/api/blocks/[id]/neighbours/route')

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/blocks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates block and event atomically — returns 201', async () => {
    const block = { id: 'block-1', org_id: 'uuid-org-1', type: 'client', name: 'Acme Corp', state: 'active', metadata: {} }
    const event = { id: 'event-1', type: 'block.created', actor_id: 'user_111' }
    makeDb(
      { data: { type_key: 'client' }, error: null },    // maybeSingle: type validation
      { data: { block, event }, error: null },           // rpc: create_block_with_event
    )

    const req = makeReq('http://localhost/api/blocks', {
      method: 'POST',
      body: JSON.stringify({ type: 'client', name: 'Acme Corp' }),
    })
    const res = await createBlock(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.block.id).toBe('block-1')
    expect(body.data.event.id).toBe('event-1')
    expect(body.error).toBeNull()
  })

  it('returns 400 on invalid body — missing type', async () => {
    makeDb()
    const req = makeReq('http://localhost/api/blocks', {
      method: 'POST',
      body: JSON.stringify({ name: 'Missing type' }),
    })
    const res = await createBlock(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('validation/invalid-input')
    expect(body.error.details[0].path).toBe('type')
  })

  it('returns 400 on invalid block type', async () => {
    makeDb()
    const req = makeReq('http://localhost/api/blocks', {
      method: 'POST',
      body: JSON.stringify({ type: 'widget', name: 'Bad type' }),
    })
    const res = await createBlock(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(400)
  })

  it('returns 500 on DB insert failure', async () => {
    makeDb(
      { data: { type_key: 'deal' }, error: null },      // maybeSingle: type validation passes
      { data: null, error: { code: 'DB_ERR' } },        // rpc: insert fails
    )
    const req = makeReq('http://localhost/api/blocks', {
      method: 'POST',
      body: JSON.stringify({ type: 'deal', name: 'New Deal' }),
    })
    const res = await createBlock(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(500)
  })
})

describe('GET /api/blocks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns block list for org', async () => {
    const blocks = [
      { id: 'block-1', type: 'client', name: 'Acme' },
      { id: 'block-2', type: 'deal', name: 'Deal A' },
    ]
    makeDb({ data: blocks, error: null })

    const res = await listBlocks(makeReq(), { params: Promise.resolve({}) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(2)
  })
})

describe('GET /api/blocks/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns block with last 20 events', async () => {
    const block = { id: 'block-1', type: 'client', name: 'Acme' }
    const events = [{ id: 'ev-1', type: 'block.created' }, { id: 'ev-2', type: 'block.updated' }]
    // single() → block; then awaited array query → events
    makeDb({ data: block, error: null }, { data: events, error: null })

    const res = await getBlock(makeReq('http://localhost/api/blocks/block-1'), {
      params: Promise.resolve({ id: 'block-1' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.block.id).toBe('block-1')
    expect(body.data.events).toHaveLength(2)
  })

  it('returns 404 when block not found', async () => {
    makeDb({ data: null, error: { code: 'PGRST116' } })

    const res = await getBlock(makeReq('http://localhost/api/blocks/unknown'), {
      params: Promise.resolve({ id: 'unknown' }),
    })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('blocks/not-found')
  })
})

describe('PATCH /api/blocks/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates block and creates block.updated event with diff', async () => {
    const current = { id: 'block-1', name: 'Old Name', state: 'active', metadata: {} }
    const updated = { id: 'block-1', name: 'New Name', state: 'active', metadata: {} }
    const event = { id: 'ev-1', type: 'block.updated', payload: { diff: { name: { before: 'Old Name', after: 'New Name' } } } }

    makeDb(
      { data: current, error: null }, // fetch current
      { data: updated, error: null }, // update
      { data: event, error: null }    // insert event
    )

    const req = makeReq('http://localhost/api/blocks/block-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'New Name' }),
    })
    const res = await patchBlock(req, { params: Promise.resolve({ id: 'block-1' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.block.name).toBe('New Name')
    expect(body.data.event.payload.diff.name.before).toBe('Old Name')
    expect(body.data.event.payload.diff.name.after).toBe('New Name')
  })

  it('returns 404 when block not found', async () => {
    makeDb({ data: null, error: { code: 'PGRST116' } })

    const req = makeReq('http://localhost/api/blocks/unknown', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'X' }),
    })
    const res = await patchBlock(req, { params: Promise.resolve({ id: 'unknown' }) })
    expect(res.status).toBe(404)
  })

  it('returns 400 when body is empty object', async () => {
    makeDb()
    const req = makeReq('http://localhost/api/blocks/block-1', {
      method: 'PATCH',
      body: JSON.stringify({}),
    })
    const res = await patchBlock(req, { params: Promise.resolve({ id: 'block-1' }) })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/blocks/:id/neighbours', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns directly connected blocks', async () => {
    const block = { id: 'block-1' }
    const edges = [
      { from_block_id: 'block-1', to_block_id: 'block-2' },
      { from_block_id: 'block-3', to_block_id: 'block-1' },
    ]
    const neighbours = [
      { id: 'block-2', name: 'Neighbour A' },
      { id: 'block-3', name: 'Neighbour B' },
    ]
    // single() → block; then → edges; then → neighbours
    makeDb(
      { data: block, error: null },      // single: block verify
      { data: edges, error: null },      // then: edges
      { data: neighbours, error: null }  // then: neighbour blocks
    )

    const res = await getNeighbours(makeReq('http://localhost/api/blocks/block-1/neighbours'), {
      params: Promise.resolve({ id: 'block-1' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(2)
  })

  it('returns empty array when block has no edges', async () => {
    makeDb(
      { data: { id: 'block-1' }, error: null }, // single: block verify
      { data: [], error: null }                  // then: edges (empty)
    )

    const res = await getNeighbours(makeReq('http://localhost/api/blocks/block-1/neighbours'), {
      params: Promise.resolve({ id: 'block-1' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })
})
