import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { AuthContext } from '@/lib/auth/withAuth'
import type { Permission } from '@/lib/rbac/types'

// ─── Mock auth ─────────────────────────────────────────────────────────────────

const ALL_PERMS = new Set<Permission>([
  'manage_blocks', 'edit_blocks', 'view_blocks', 'manage_workflows',
  'execute_workflows', 'approve_tasks', 'manage_team', 'manage_settings',
  'manage_integrations', 'view_audit_log',
])

const _USER_PERMS = new Set<Permission>([
  'view_blocks', 'edit_blocks', 'execute_workflows', 'approve_tasks', 'view_audit_log',
])

vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: vi.fn(
    (handler: (req: NextRequest, ctx: AuthContext, params: Record<string, string>) => Promise<Response>) =>
      async (req: NextRequest, context: { params: Promise<Record<string, string>> }) => {
        const params = await context.params
        return handler(
          req,
          {
            userId: 'user_111', clerkOrgId: 'org_abc', orgId: 'uuid-org-1',
            role: 'ops-admin' as const, roleId: 'role-uuid-admin', permissions: ALL_PERMS,
          },
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

function makeDb(...responses: { data: unknown; error: unknown }[]) {
  const queue = [...responses]
  let i = 0

  const singleFn = vi.fn().mockImplementation(() =>
    Promise.resolve(queue[i++] ?? { data: null, error: null })
  )
  const rpcFn = vi.fn().mockImplementation(() =>
    Promise.resolve(queue[i++] ?? { data: null, error: null })
  )

  const chain: Record<string, unknown> = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: singleFn,
    rpc: rpcFn,
    then: (resolve: (v: unknown) => void, reject: (r: unknown) => void) =>
      Promise.resolve(queue[i++] ?? { data: [], error: null }).then(resolve, reject),
  }

  vi.mocked(createServerClient).mockReturnValue(chain as unknown as ReturnType<typeof createServerClient>)
  return { chain, singleFn, rpcFn }
}

const makeReq = (url = 'http://localhost/api/org', opts?: RequestInit) =>
  new NextRequest(url, opts as ConstructorParameters<typeof NextRequest>[1])

// ─── UUID constants for test data ──────────────────────────────────────────────
const ROOT_ID = '00000000-0000-0000-0000-000000000001'
const SUB_ID  = '00000000-0000-0000-0000-000000000002'
const DEPT_ID = '00000000-0000-0000-0000-000000000003'
const TEAM_ID = '00000000-0000-0000-0000-000000000004'

// ─── Import routes after mocks ─────────────────────────────────────────────────

const { GET: getHierarchy } = await import('@/app/api/org/hierarchy/route')
const { POST: createSubOrg } = await import('@/app/api/org/sub-orgs/route')
const { GET: getOrg, PATCH: patchOrg, DELETE: deleteOrg } = await import('@/app/api/org/[id]/route')

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/org/hierarchy', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns nested org tree', async () => {
    const flat = [
      { id: ROOT_ID, name: 'Thornfield', slug: 'thornfield', org_level: 'org', parent_org_id: null, depth: 0 },
      { id: SUB_ID, name: 'APAC', slug: 'apac', org_level: 'suborg', parent_org_id: ROOT_ID, depth: 1 },
      { id: DEPT_ID, name: 'Compliance', slug: 'compliance', org_level: 'department', parent_org_id: SUB_ID, depth: 2 },
    ]
    makeDb({ data: flat, error: null }) // rpc: get_org_hierarchy

    const res = await getHierarchy(makeReq(), { params: Promise.resolve({}) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.name).toBe('Thornfield')
    expect(body.data.level).toBe('org')
    expect(body.data.children).toHaveLength(1)
    expect(body.data.children[0].name).toBe('APAC')
    expect(body.data.children[0].children).toHaveLength(1)
    expect(body.data.children[0].children[0].name).toBe('Compliance')
  })

  it('returns single root with no children', async () => {
    const flat = [
      { id: ROOT_ID, name: 'Solo Org', slug: 'solo', org_level: 'org', parent_org_id: null, depth: 0 },
    ]
    makeDb({ data: flat, error: null })

    const res = await getHierarchy(makeReq(), { params: Promise.resolve({}) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.children).toEqual([])
  })

  it('returns 404 when org not found', async () => {
    makeDb({ data: [], error: null })

    const res = await getHierarchy(makeReq(), { params: Promise.resolve({}) })
    expect(res.status).toBe(404)
  })

  it('returns 500 on DB error', async () => {
    makeDb({ data: null, error: { code: 'DB_ERR' } })

    const res = await getHierarchy(makeReq(), { params: Promise.resolve({}) })
    expect(res.status).toBe(500)
  })
})

describe('POST /api/org/sub-orgs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates sub-org — returns 201', async () => {
    const newOrg = { id: DEPT_ID, name: 'New Dept', slug: 'new-dept', org_level: 'department', parent_org_id: SUB_ID }
    makeDb(
      { data: { id: SUB_ID, org_level: 'suborg' }, error: null },  // single: parent lookup
      { data: newOrg, error: null },                                 // single: insert
    )

    const req = makeReq('http://localhost/api/org/sub-orgs', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Dept', parent_id: SUB_ID, org_level: 'department' }),
    })
    const res = await createSubOrg(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.name).toBe('New Dept')
  })

  it('returns 404 when parent not found', async () => {
    makeDb({ data: null, error: { code: 'PGRST116' } })

    const req = makeReq('http://localhost/api/org/sub-orgs', {
      method: 'POST',
      body: JSON.stringify({ name: 'X', parent_id: ROOT_ID, org_level: 'suborg' }),
    })
    const res = await createSubOrg(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid level ordering (team under team)', async () => {
    makeDb({ data: { id: TEAM_ID, org_level: 'team' }, error: null })

    const req = makeReq('http://localhost/api/org/sub-orgs', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bad', parent_id: TEAM_ID, org_level: 'team' }),
    })
    const res = await createSubOrg(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('org/invalid-level-ordering')
  })

  it('returns 400 for invalid level ordering (org under suborg)', async () => {
    makeDb({ data: { id: SUB_ID, org_level: 'suborg' }, error: null })

    const req = makeReq('http://localhost/api/org/sub-orgs', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bad', parent_id: SUB_ID, org_level: 'org' }),
    })
    const res = await createSubOrg(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('org/invalid-level-ordering')
  })

  it('returns 400 when body validation fails', async () => {
    const req = makeReq('http://localhost/api/org/sub-orgs', {
      method: 'POST',
      body: JSON.stringify({ name: '' }),
    })
    const res = await createSubOrg(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(400)
  })

  it('returns 400 when DB trigger rejects depth (exceed 4 levels)', async () => {
    makeDb(
      { data: { id: DEPT_ID, org_level: 'department' }, error: null },           // parent lookup
      { data: null, error: { message: 'Organisation hierarchy cannot exceed 4 levels', code: 'P0001' } }, // insert
    )

    const req = makeReq('http://localhost/api/org/sub-orgs', {
      method: 'POST',
      body: JSON.stringify({ name: 'Deep', parent_id: DEPT_ID, org_level: 'team' }),
    })
    const res = await createSubOrg(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('org/depth-exceeded')
  })
})

describe('GET /api/org/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a single org node', async () => {
    const org = { id: SUB_ID, name: 'APAC', slug: 'apac', org_level: 'suborg', parent_org_id: ROOT_ID, created_at: '2026-01-01' }
    makeDb({ data: org, error: null })

    const res = await getOrg(makeReq(`http://localhost/api/org/${SUB_ID}`), {
      params: Promise.resolve({ id: SUB_ID }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.name).toBe('APAC')
  })

  it('returns 404 when org not found', async () => {
    makeDb({ data: null, error: { code: 'PGRST116' } })

    const res = await getOrg(makeReq(`http://localhost/api/org/${ROOT_ID}`), {
      params: Promise.resolve({ id: ROOT_ID }),
    })
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/org/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates org name', async () => {
    const existing = { id: SUB_ID, org_level: 'suborg', parent_org_id: ROOT_ID }
    const updated = { id: SUB_ID, name: 'New Name', slug: 'apac', org_level: 'suborg', parent_org_id: ROOT_ID }
    makeDb(
      { data: existing, error: null }, // single: fetch existing
      { data: updated, error: null },  // single: update
    )

    const req = makeReq(`http://localhost/api/org/${SUB_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'New Name' }),
    })
    const res = await patchOrg(req, { params: Promise.resolve({ id: SUB_ID }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.name).toBe('New Name')
  })

  it('returns 404 when org not found', async () => {
    makeDb({ data: null, error: { code: 'PGRST116' } })

    const req = makeReq(`http://localhost/api/org/${ROOT_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'X' }),
    })
    const res = await patchOrg(req, { params: Promise.resolve({ id: ROOT_ID }) })
    expect(res.status).toBe(404)
  })

  it('returns 400 when body is empty object', async () => {
    const req = makeReq(`http://localhost/api/org/${SUB_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    })
    const res = await patchOrg(req, { params: Promise.resolve({ id: SUB_ID }) })
    expect(res.status).toBe(400)
  })

  it('returns 400 for self-reference reparent', async () => {
    const existing = { id: SUB_ID, org_level: 'suborg', parent_org_id: ROOT_ID }
    makeDb({ data: existing, error: null })

    const req = makeReq(`http://localhost/api/org/${SUB_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ parent_org_id: SUB_ID }),
    })
    const res = await patchOrg(req, { params: Promise.resolve({ id: SUB_ID }) })

    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('org/self-reference')
  })

  it('returns 400 for cycle detection (reparent to descendant)', async () => {
    const existing = { id: ROOT_ID, org_level: 'org', parent_org_id: null }
    const descendants = [
      { id: ROOT_ID, depth: 0 },
      { id: SUB_ID, depth: 1 },
      { id: DEPT_ID, depth: 2 },
    ]
    makeDb(
      { data: existing, error: null },   // single: fetch existing
      { data: descendants, error: null }, // rpc: get_org_hierarchy (for cycle check)
    )

    const req = makeReq(`http://localhost/api/org/${ROOT_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ parent_org_id: DEPT_ID }),
    })
    const res = await patchOrg(req, { params: Promise.resolve({ id: ROOT_ID }) })

    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('org/cycle-detected')
  })
})

describe('DELETE /api/org/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes a leaf sub-org', async () => {
    makeDb(
      { data: { id: DEPT_ID, parent_org_id: SUB_ID }, error: null }, // single: fetch
      { data: [], error: null },                                       // then: children check
      { data: null, error: null },                                     // delete
    )

    const res = await deleteOrg(makeReq(`http://localhost/api/org/${DEPT_ID}`), {
      params: Promise.resolve({ id: DEPT_ID }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.deleted).toBe(DEPT_ID)
  })

  it('returns 400 when trying to delete root org', async () => {
    makeDb({ data: { id: ROOT_ID, parent_org_id: null }, error: null })

    const res = await deleteOrg(makeReq(`http://localhost/api/org/${ROOT_ID}`), {
      params: Promise.resolve({ id: ROOT_ID }),
    })

    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('org/cannot-delete-root')
  })

  it('returns 409 when org has children', async () => {
    makeDb(
      { data: { id: SUB_ID, parent_org_id: ROOT_ID }, error: null }, // single: fetch
      { data: [{ id: DEPT_ID }], error: null },                       // then: children exist
    )

    const res = await deleteOrg(makeReq(`http://localhost/api/org/${SUB_ID}`), {
      params: Promise.resolve({ id: SUB_ID }),
    })

    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('org/has-children')
  })

  it('returns 404 when org not found', async () => {
    makeDb({ data: null, error: { code: 'PGRST116' } })

    const res = await deleteOrg(makeReq(`http://localhost/api/org/${ROOT_ID}`), {
      params: Promise.resolve({ id: ROOT_ID }),
    })
    expect(res.status).toBe(404)
  })
})
