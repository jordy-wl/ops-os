import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { AuthContext } from '@/lib/auth/withAuth'

const ALL_PERMS = new Set(['manage_blocks', 'edit_blocks', 'view_blocks', 'manage_workflows', 'execute_workflows', 'approve_tasks', 'manage_team', 'manage_settings', 'manage_integrations', 'view_audit_log'])
const USER_PERMS = new Set(['view_blocks', 'edit_blocks', 'execute_workflows', 'approve_tasks', 'view_audit_log'])

const mockAuth = vi.hoisted(() => ({
  permissions: null as unknown as Set<string>,
}))

vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: vi.fn(
    (handler: (req: NextRequest, ctx: AuthContext, params: Record<string, string>) => Promise<Response>) =>
      async (req: NextRequest, context: { params: Promise<Record<string, string>> }) => {
        const params = await context.params
        return handler(
          req,
          { userId: 'user_111', clerkOrgId: 'org_abc', orgId: 'uuid-org-1', role: 'ops-admin' as const, roleId: 'role-uuid', permissions: mockAuth.permissions },
          params
        )
      }
  ),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

vi.mock('@/lib/team/validation', () => ({
  validateReportingDepth: vi.fn().mockResolvedValue(null),
  isValidStatusTransition: vi.fn().mockReturnValue(true),
}))

import { createServerClient } from '@/lib/supabase/server'
import { validateReportingDepth, isValidStatusTransition } from '@/lib/team/validation'

function makeDb(...responses: { data: unknown; error: unknown; count?: number }[]) {
  const queue = [...responses]
  let i = 0

  const next = () => Promise.resolve(queue[i++] ?? { data: null, error: null })

  const chain: Record<string, unknown> = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(next),
    then: (resolve: (v: unknown) => void, reject: (r: unknown) => void) =>
      next().then(resolve, reject),
  }

  vi.mocked(createServerClient).mockReturnValue(chain as unknown as ReturnType<typeof createServerClient>)
  return chain
}

const makeReq = (url = 'http://localhost/api/team', opts?: RequestInit) =>
  new NextRequest(url, opts as ConstructorParameters<typeof NextRequest>[1])

const { GET, POST } = await import('@/app/api/team/route')
const { GET: getOne, PATCH, DELETE: softDelete } = await import('@/app/api/team/[id]/route')

describe('GET /api/team', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.permissions = ALL_PERMS
  })

  it('returns team members for org', async () => {
    const members = [
      { id: 'tm-1', name: 'Alice', type: 'team_member', metadata: { status: 'active' } },
      { id: 'tm-2', name: 'Bob', type: 'team_member', metadata: { status: 'active' } },
    ]
    makeDb({ data: members, error: null })

    const res = await GET(makeReq(), { params: Promise.resolve({}) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(2)
  })

  it('returns empty array when no team members', async () => {
    makeDb({ data: [], error: null })

    const res = await GET(makeReq(), { params: Promise.resolve({}) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(0)
  })
})

describe('POST /api/team', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.permissions = ALL_PERMS
  })

  it('creates a team member — returns 201', async () => {
    const created = { id: 'tm-new', name: 'Charlie', type: 'team_member', metadata: { status: 'active', email: 'charlie@example.com' } }
    makeDb(
      { data: created, error: null },  // block insert
      { data: null, error: null },       // event insert
    )

    const req = makeReq('http://localhost/api/team', {
      method: 'POST',
      body: JSON.stringify({ name: 'Charlie', email: 'charlie@example.com' }),
    })
    const res = await POST(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.name).toBe('Charlie')
  })

  it('returns 400 on missing name', async () => {
    makeDb()
    const req = makeReq('http://localhost/api/team', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@test.com' }),
    })
    const res = await POST(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid email', async () => {
    makeDb()
    const req = makeReq('http://localhost/api/team', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', email: 'not-an-email' }),
    })
    const res = await POST(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(400)
  })

  it('returns 400 when reporting hierarchy exceeds depth limit', async () => {
    vi.mocked(validateReportingDepth).mockResolvedValueOnce('Reporting hierarchy would exceed 4 levels')
    makeDb()

    const req = makeReq('http://localhost/api/team', {
      method: 'POST',
      body: JSON.stringify({ name: 'Deep', reporting_to: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }),
    })
    const res = await POST(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('team/invalid-hierarchy')
  })

  it('returns 403 for user without manage_team permission', async () => {
    mockAuth.permissions = USER_PERMS
    makeDb()

    const req = makeReq('http://localhost/api/team', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
    })
    const res = await POST(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(403)
  })
})

describe('GET /api/team/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.permissions = ALL_PERMS
  })

  it('returns a single team member', async () => {
    const member = { id: 'tm-1', name: 'Alice', type: 'team_member' }
    makeDb({ data: member, error: null })

    const res = await getOne(makeReq('http://localhost/api/team/tm-1'), { params: Promise.resolve({ id: 'tm-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.name).toBe('Alice')
  })

  it('returns 404 for nonexistent member', async () => {
    makeDb({ data: null, error: { code: 'PGRST116' } })

    const res = await getOne(makeReq('http://localhost/api/team/unknown'), { params: Promise.resolve({ id: 'unknown' }) })
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/team/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.permissions = ALL_PERMS
    vi.mocked(isValidStatusTransition).mockReturnValue(true)
  })

  it('updates team member fields', async () => {
    const existing = { id: 'tm-1', name: 'Alice', metadata: { status: 'active', email: 'old@ex.com' } }
    const updated = { id: 'tm-1', name: 'Alice Updated', metadata: { status: 'active', email: 'new@ex.com' } }
    makeDb(
      { data: existing, error: null },  // fetch
      { data: updated, error: null },    // update
    )

    const req = makeReq('http://localhost/api/team/tm-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Alice Updated', email: 'new@ex.com' }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'tm-1' }) })
    expect(res.status).toBe(200)
  })

  it('returns 400 on invalid status transition', async () => {
    vi.mocked(isValidStatusTransition).mockReturnValue(false)
    const existing = { id: 'tm-1', name: 'Alice', metadata: { status: 'inactive' } }
    makeDb({ data: existing, error: null })

    const req = makeReq('http://localhost/api/team/tm-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'active' }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'tm-1' }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('team/invalid-status-transition')
  })

  it('returns 404 for nonexistent member', async () => {
    makeDb({ data: null, error: { code: 'PGRST116' } })

    const req = makeReq('http://localhost/api/team/unknown', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Test' }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'unknown' }) })
    expect(res.status).toBe(404)
  })

  it('returns 400 on empty body', async () => {
    makeDb()
    const req = makeReq('http://localhost/api/team/tm-1', {
      method: 'PATCH',
      body: JSON.stringify({}),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'tm-1' }) })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/team/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.permissions = ALL_PERMS
  })

  it('soft-deactivates a team member', async () => {
    const existing = { id: 'tm-1', metadata: { status: 'active' } }
    const updated = { id: 'tm-1', metadata: { status: 'inactive' } }
    makeDb(
      { data: existing, error: null },  // fetch
      { data: updated, error: null },    // update
      { data: null, error: null },       // event insert
    )

    const req = makeReq('http://localhost/api/team/tm-1', { method: 'DELETE' })
    const res = await softDelete(req, { params: Promise.resolve({ id: 'tm-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe('inactive')
  })

  it('returns 409 when already inactive', async () => {
    const existing = { id: 'tm-1', metadata: { status: 'inactive' } }
    makeDb({ data: existing, error: null })

    const req = makeReq('http://localhost/api/team/tm-1', { method: 'DELETE' })
    const res = await softDelete(req, { params: Promise.resolve({ id: 'tm-1' }) })
    expect(res.status).toBe(409)
  })

  it('returns 404 for nonexistent member', async () => {
    makeDb({ data: null, error: { code: 'PGRST116' } })

    const req = makeReq('http://localhost/api/team/unknown', { method: 'DELETE' })
    const res = await softDelete(req, { params: Promise.resolve({ id: 'unknown' }) })
    expect(res.status).toBe(404)
  })

  it('returns 403 for user without manage_team permission', async () => {
    mockAuth.permissions = USER_PERMS
    makeDb()

    const req = makeReq('http://localhost/api/team/tm-1', { method: 'DELETE' })
    const res = await softDelete(req, { params: Promise.resolve({ id: 'tm-1' }) })
    expect(res.status).toBe(403)
  })
})
