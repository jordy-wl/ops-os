import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { AuthContext } from '@/lib/auth/withAuth'

vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: vi.fn(
    (handler: (req: NextRequest, ctx: AuthContext, params: Record<string, string>) => Promise<Response>) =>
      async (req: NextRequest, context: { params: Promise<Record<string, string>> }) => {
        const params = await context.params
        return handler(
          req,
          { userId: 'user_111', clerkOrgId: 'org_abc', orgId: 'uuid-org-1' },
          params
        )
      }
  ),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

import { createServerClient } from '@/lib/supabase/server'

function makeDb(...responses: { data: unknown; error: unknown }[]) {
  const queue = [...responses]
  let i = 0

  const singleFn = vi.fn().mockImplementation(() => Promise.resolve(queue[i++] ?? { data: null, error: null }))

  const chain: Record<string, unknown> = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    single: singleFn,
    then: (resolve: (v: unknown) => void, reject: (r: unknown) => void) =>
      Promise.resolve(queue[i++] ?? { data: [], error: null }).then(resolve, reject),
  }

  vi.mocked(createServerClient).mockReturnValue(chain as unknown as ReturnType<typeof createServerClient>)
  return { chain, singleFn }
}

const makeReq = (url: string, opts?: RequestInit) => new NextRequest(url, opts as ConstructorParameters<typeof NextRequest>[1])

const { GET: listEvents, POST: createEvent } = await import('@/app/api/events/route')

describe('POST /api/events', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates event — actor_id from JWT, not body — returns 201', async () => {
    const block = { id: 'block-1' }
    const event = {
      id: 'ev-1',
      type: 'kyc.submitted',
      actor_id: 'user_111', // from JWT
      actor_type: 'human',
      occurred_at: '2026-03-02T14:00:00Z',
    }
    makeDb({ data: block, error: null }, { data: event, error: null })

    const req = makeReq('http://localhost/api/events', {
      method: 'POST',
      body: JSON.stringify({
        block_id: '00000000-0000-0000-0000-000000000001',
        type: 'kyc.submitted',
        // actor_id deliberately NOT included in body
        payload: { document: 'passport' },
      }),
    })
    const res = await createEvent(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.actor_id).toBe('user_111')
    expect(body.data.type).toBe('kyc.submitted')
    expect(body.error).toBeNull()
  })

  it('returns 400 when block_id is not a UUID', async () => {
    makeDb()
    const req = makeReq('http://localhost/api/events', {
      method: 'POST',
      body: JSON.stringify({ block_id: 'not-a-uuid', type: 'some.event' }),
    })
    const res = await createEvent(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('validation/invalid-input')
  })

  it('returns 400 when type is missing', async () => {
    makeDb()
    const req = makeReq('http://localhost/api/events', {
      method: 'POST',
      body: JSON.stringify({ block_id: '00000000-0000-0000-0000-000000000001' }),
    })
    const res = await createEvent(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(400)
  })

  it('returns 404 when block not found in this org', async () => {
    makeDb({ data: null, error: { code: 'PGRST116' } })

    const req = makeReq('http://localhost/api/events', {
      method: 'POST',
      body: JSON.stringify({ block_id: '00000000-0000-0000-0000-000000000099', type: 'test.event' }),
    })
    const res = await createEvent(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('events/block-not-found')
  })
})

describe('GET /api/events', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns events for block_id, sorted DESC', async () => {
    const events = [
      { id: 'ev-2', occurred_at: '2026-03-02T14:00:00Z', type: 'block.updated' },
      { id: 'ev-1', occurred_at: '2026-03-02T12:00:00Z', type: 'block.created' },
    ]
    makeDb({ data: events, error: null })

    const res = await listEvents(
      makeReq('http://localhost/api/events?block_id=block-1'),
      { params: Promise.resolve({}) }
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.events).toHaveLength(2)
    expect(body.data.events[0].type).toBe('block.updated') // DESC order
    expect(body.data.cursor).toBeNull() // less than limit, no next page
  })

  it('returns cursor when a full page is returned', async () => {
    // Return 50 events (= default limit) to trigger cursor
    const events = Array.from({ length: 50 }, (_, i) => ({
      id: `ev-${i}`,
      occurred_at: new Date(Date.now() - i * 1000).toISOString(),
      type: 'block.updated',
    }))
    makeDb({ data: events, error: null })

    const res = await listEvents(
      makeReq('http://localhost/api/events?block_id=block-1'),
      { params: Promise.resolve({}) }
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.cursor).toBe(events[49].occurred_at)
  })

  it('returns 400 when no block_id or org_id provided', async () => {
    makeDb()
    const res = await listEvents(makeReq('http://localhost/api/events'), { params: Promise.resolve({}) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('validation/missing-param')
  })

  it('does not expose events from other orgs', async () => {
    // The org_id is set from ctx.orgId (from JWT), not from request params.
    // Query is scoped to ctx.orgId — verified by checking the eq() call on org_id.
    const { chain } = makeDb({ data: [], error: null })
    await listEvents(makeReq('http://localhost/api/events?org_id=other-org-uuid'), { params: Promise.resolve({}) })

    // eq() should have been called with ctx.orgId (uuid-org-1), not the param
    const eqCalls = vi.mocked(chain.eq as ReturnType<typeof vi.fn>).mock.calls
    const orgIdCall = eqCalls.find(([field]: string[]) => field === 'org_id')
    expect(orgIdCall?.[1]).toBe('uuid-org-1') // JWT org, not request param
  })
})
