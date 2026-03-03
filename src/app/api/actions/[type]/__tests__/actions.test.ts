import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mock auth middleware ────────────────────────────────────────────────────
const MOCK_CTX = { userId: 'user_111', clerkOrgId: 'org_abc', orgId: 'uuid-org-1', role: 'ops-admin' as const }

// vi.hoisted creates a value accessible inside vi.mock factories (which are hoisted)
const mockState = vi.hoisted(() => ({ denyAuth: false }))

vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: vi.fn(
    (handler) =>
      async (req: NextRequest, context: { params: Promise<Record<string, string>> }) => {
        // Check denyAuth at invocation time, not at setup time — so per-test overrides work
        if (mockState.denyAuth) {
          return new Response(
            JSON.stringify({ data: null, error: { message: 'Forbidden', code: 'auth/no-org' } }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          )
        }
        return handler(req, MOCK_CTX, await (context.params ?? Promise.resolve({})))
      }
  ),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

import { createServerClient } from '@/lib/supabase/server'
import { POST } from '@/app/api/actions/[type]/route'

// ─── Sequential Supabase mock ────────────────────────────────────────────────
function makeDb(...responses: { data: unknown; error: unknown }[]) {
  let i = 0
  const singleFn = vi.fn().mockImplementation(() => Promise.resolve(responses[i++] ?? { data: null, error: null }))

  const chain: Record<string, unknown> = {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: singleFn,
  }

  vi.mocked(createServerClient).mockReturnValue(chain as unknown as ReturnType<typeof createServerClient>)
  return chain
}

function makeReq(type: string, body: unknown) {
  return new NextRequest(`http://localhost/api/actions/${type}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const BLOCK_ID = '00000000-0000-0000-0000-000000000001'
const EVENT_ID = '00000000-0000-0000-0000-000000000002'
const JOB_ID   = '00000000-0000-0000-0000-000000000003'

describe('POST /api/actions/:type', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.denyAuth = false
  })

  // ── block.create ─────────────────────────────────────────────────────────

  it('block.create — happy path returns 201 with actionId and eventId', async () => {
    makeDb(
      { data: { id: BLOCK_ID }, error: null },  // insert block
      { data: { id: EVENT_ID }, error: null },   // insert event
    )

    const req = makeReq('block.create', { type: 'client', name: 'Acme Ltd' })
    const res = await POST(req, { params: Promise.resolve({ type: 'block.create' }) })
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.data.actionId).toBeTypeOf('string')
    expect(json.data.eventId).toBe(EVENT_ID)
    expect(json.data.workflowJobId).toBeNull()
    expect(json.data.status).toBe('completed')
    expect(json.error).toBeNull()
  })

  it('block.create — missing name returns 400 validation error', async () => {
    makeDb()
    const req = makeReq('block.create', { type: 'client' }) // name missing
    const res = await POST(req, { params: Promise.resolve({ type: 'block.create' }) })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.data).toBeNull()
    expect(json.error.code).toBe('validation/invalid-input')
  })

  it('block.create — invalid type returns 400 validation error', async () => {
    makeDb()
    const req = makeReq('block.create', { type: 'INVALID', name: 'Test' })
    const res = await POST(req, { params: Promise.resolve({ type: 'block.create' }) })

    expect(res.status).toBe(400)
  })

  it('block.create — DB insert failure returns 500', async () => {
    makeDb(
      { data: null, error: { message: 'DB error', code: 'XX000' } }, // block insert fails
    )

    const req = makeReq('block.create', { type: 'deal', name: 'Deal Alpha' })
    const res = await POST(req, { params: Promise.resolve({ type: 'block.create' }) })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe('actions/execution-failed')
  })

  // ── onboarding.start ──────────────────────────────────────────────────────

  it('onboarding.start — happy path returns 201 with actionId, eventId, workflowJobId', async () => {
    makeDb(
      { data: { id: BLOCK_ID }, error: null },  // insert block
      { data: { id: EVENT_ID }, error: null },   // insert event
      { data: { id: JOB_ID },   error: null },   // insert workflow_job
    )

    const req = makeReq('onboarding.start', {
      clientName: 'Thornfield Capital',
      jurisdiction: 'UK',
    })
    const res = await POST(req, { params: Promise.resolve({ type: 'onboarding.start' }) })
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.data.actionId).toBeTypeOf('string')
    expect(json.data.eventId).toBe(EVENT_ID)
    expect(json.data.workflowJobId).toBe(JOB_ID)
    expect(json.data.status).toBe('pending')
    expect(json.error).toBeNull()
  })

  it('onboarding.start — missing clientName returns 400', async () => {
    makeDb()
    const req = makeReq('onboarding.start', { jurisdiction: 'UK' })
    const res = await POST(req, { params: Promise.resolve({ type: 'onboarding.start' }) })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('validation/invalid-input')
  })

  it('onboarding.start — workflow_job insert failure returns 500', async () => {
    makeDb(
      { data: { id: BLOCK_ID }, error: null },  // block ok
      { data: { id: EVENT_ID }, error: null },   // event ok
      { data: null, error: { message: 'Job insert failed', code: 'XX000' } }, // job fails
    )

    const req = makeReq('onboarding.start', { clientName: 'Client A' })
    const res = await POST(req, { params: Promise.resolve({ type: 'onboarding.start' }) })

    expect(res.status).toBe(500)
  })

  // ── Registry / routing ────────────────────────────────────────────────────

  it('unknown action type returns 404', async () => {
    makeDb()
    const req = makeReq('foo.bar', {})
    const res = await POST(req, { params: Promise.resolve({ type: 'foo.bar' }) })
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe('actions/unknown-type')
  })

  it('malformed JSON body returns 400', async () => {
    const req = new NextRequest('http://localhost/api/actions/block.create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })

    // Registry lookup succeeds (block.create exists)
    makeDb()
    const res = await POST(req, { params: Promise.resolve({ type: 'block.create' }) })

    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('validation/invalid-json')
  })

  // ── Auth (Gate 5) ─────────────────────────────────────────────────────────

  it('returns 403 when withAuth denies (no org)', async () => {
    mockState.denyAuth = true

    const req = makeReq('block.create', { type: 'client', name: 'Test' })
    const res = await POST(req, { params: Promise.resolve({ type: 'block.create' }) })

    expect(res.status).toBe(403)
  })
})
