import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { AuthContext } from '@/lib/auth/withAuth'
import type { Permission } from '@/lib/rbac/types'

// ─── Mock auth ─────────────────────────────────────────────────────────────────

const mockState = vi.hoisted(() => ({
  permissions: new Set<string>([
    'manage_blocks', 'edit_blocks', 'view_blocks', 'manage_workflows',
    'execute_workflows', 'approve_tasks', 'manage_team', 'manage_settings',
    'manage_integrations', 'view_audit_log',
  ]),
}))

const ALL_PERMS = new Set<Permission>([
  'manage_blocks', 'edit_blocks', 'view_blocks', 'manage_workflows',
  'execute_workflows', 'approve_tasks', 'manage_team', 'manage_settings',
  'manage_integrations', 'view_audit_log',
])

const USER_PERMS = new Set<Permission>([
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
            role: 'ops-admin' as const, roleId: 'role-uuid-admin',
            permissions: mockState.permissions as Set<Permission>,
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

  const chain: Record<string, unknown> = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: singleFn,
    then: (resolve: (v: unknown) => void, reject: (r: unknown) => void) =>
      Promise.resolve(queue[i++] ?? { data: [], error: null }).then(resolve, reject),
  }

  vi.mocked(createServerClient).mockReturnValue(chain as unknown as ReturnType<typeof createServerClient>)
  return { chain, singleFn }
}

const makeReq = (url = 'http://localhost/api/roles', opts?: RequestInit) =>
  new NextRequest(url, opts as ConstructorParameters<typeof NextRequest>[1])

// ─── Import routes after mocks ─────────────────────────────────────────────────

const { GET: listRoles, POST: createRole } = await import('@/app/api/roles/route')
const { PATCH: patchRole, DELETE: deleteRole } = await import('@/app/api/roles/[id]/route')

const ROLE_ID = '00000000-0000-0000-0000-000000000010'

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/roles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.permissions = ALL_PERMS
  })

  it('returns roles with permissions for org', async () => {
    const roles = [
      { id: 'r1', name: 'ops-admin', display_name: 'Admin', description: 'Full access', is_system: true, created_at: '2026-01-01' },
      { id: 'r2', name: 'custom', display_name: 'Custom', description: '', is_system: false, created_at: '2026-01-02' },
    ]
    const perms = [
      { role_id: 'r1', permission: 'manage_blocks' },
      { role_id: 'r1', permission: 'view_blocks' },
      { role_id: 'r2', permission: 'view_blocks' },
    ]
    makeDb(
      { data: roles, error: null },  // then: roles list
      { data: perms, error: null },  // then: permission_groups
    )

    const res = await listRoles(makeReq(), { params: Promise.resolve({}) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(2)
    expect(body.data[0].permissions).toContain('manage_blocks')
    expect(body.data[1].permissions).toEqual(['view_blocks'])
  })

  it('returns 500 on DB error', async () => {
    makeDb({ data: null, error: { code: 'DB_ERR' } })

    const res = await listRoles(makeReq(), { params: Promise.resolve({}) })
    expect(res.status).toBe(500)
  })
})

describe('POST /api/roles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.permissions = ALL_PERMS
  })

  it('creates a custom role — returns 201', async () => {
    const role = { id: ROLE_ID, name: 'field-manager', display_name: 'Field Manager', description: 'Can edit blocks', is_system: false }
    makeDb(
      { data: role, error: null },   // single: insert role
      { data: null, error: null },   // insert: permission_groups
    )

    const req = makeReq('http://localhost/api/roles', {
      method: 'POST',
      body: JSON.stringify({
        name: 'field-manager',
        display_name: 'Field Manager',
        description: 'Can edit blocks',
        permissions: ['edit_blocks', 'view_blocks'],
      }),
    })
    const res = await createRole(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.name).toBe('field-manager')
    expect(body.data.permissions).toEqual(['edit_blocks', 'view_blocks'])
  })

  it('returns 400 when permissions array is empty', async () => {
    const req = makeReq('http://localhost/api/roles', {
      method: 'POST',
      body: JSON.stringify({ name: 'empty', display_name: 'Empty', permissions: [] }),
    })
    const res = await createRole(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(400)
  })

  it('returns 400 when name format is invalid', async () => {
    const req = makeReq('http://localhost/api/roles', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bad Name!', display_name: 'Bad', permissions: ['view_blocks'] }),
    })
    const res = await createRole(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(400)
  })

  it('returns 409 for duplicate role name', async () => {
    makeDb({ data: null, error: { code: '23505', message: 'duplicate' } })

    const req = makeReq('http://localhost/api/roles', {
      method: 'POST',
      body: JSON.stringify({ name: 'ops-admin', display_name: 'Dup', permissions: ['view_blocks'] }),
    })
    const res = await createRole(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(409)
  })

  it('returns 403 when user lacks manage_team permission', async () => {
    mockState.permissions = USER_PERMS

    const req = makeReq('http://localhost/api/roles', {
      method: 'POST',
      body: JSON.stringify({ name: 'test', display_name: 'Test', permissions: ['view_blocks'] }),
    })
    const res = await createRole(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(403)
  })
})

describe('PATCH /api/roles/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.permissions = ALL_PERMS
  })

  it('updates a custom role', async () => {
    const existing = { id: ROLE_ID, is_system: false }
    const updated = { id: ROLE_ID, name: 'custom', display_name: 'Updated', description: 'New desc', is_system: false }
    makeDb(
      { data: existing, error: null },     // single: fetch
      { data: null, error: null },          // update
      { data: null, error: null },          // delete perms
      { data: null, error: null },          // insert perms
      { data: updated, error: null },       // single: fetch updated
      { data: [{ permission: 'view_blocks' }], error: null }, // then: fetch perms
    )

    const req = makeReq(`http://localhost/api/roles/${ROLE_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ display_name: 'Updated', permissions: ['view_blocks'] }),
    })
    const res = await patchRole(req, { params: Promise.resolve({ id: ROLE_ID }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.display_name).toBe('Updated')
  })

  it('returns 403 for system role modification', async () => {
    makeDb({ data: { id: ROLE_ID, is_system: true }, error: null })

    const req = makeReq(`http://localhost/api/roles/${ROLE_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ display_name: 'Hacked' }),
    })
    const res = await patchRole(req, { params: Promise.resolve({ id: ROLE_ID }) })

    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('roles/system-readonly')
  })

  it('returns 404 for unknown role', async () => {
    makeDb({ data: null, error: { code: 'PGRST116' } })

    const req = makeReq(`http://localhost/api/roles/${ROLE_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ display_name: 'X' }),
    })
    const res = await patchRole(req, { params: Promise.resolve({ id: ROLE_ID }) })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/roles/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.permissions = ALL_PERMS
  })

  it('deletes a custom role with no users', async () => {
    makeDb(
      { data: { id: ROLE_ID, is_system: false }, error: null }, // single: fetch
      { data: [], error: null },                                  // then: check assignments
      { data: null, error: null },                                // delete
    )

    const res = await deleteRole(makeReq(`http://localhost/api/roles/${ROLE_ID}`), {
      params: Promise.resolve({ id: ROLE_ID }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.deleted).toBe(ROLE_ID)
  })

  it('returns 403 for system role deletion', async () => {
    makeDb({ data: { id: ROLE_ID, is_system: true }, error: null })

    const res = await deleteRole(makeReq(`http://localhost/api/roles/${ROLE_ID}`), {
      params: Promise.resolve({ id: ROLE_ID }),
    })

    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('roles/system-readonly')
  })

  it('returns 409 when role is assigned to users', async () => {
    makeDb(
      { data: { id: ROLE_ID, is_system: false }, error: null },  // single: fetch
      { data: [{ id: 'up-1' }], error: null },                    // then: assignments exist
    )

    const res = await deleteRole(makeReq(`http://localhost/api/roles/${ROLE_ID}`), {
      params: Promise.resolve({ id: ROLE_ID }),
    })

    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('roles/in-use')
  })

  it('returns 404 for unknown role', async () => {
    makeDb({ data: null, error: { code: 'PGRST116' } })

    const res = await deleteRole(makeReq(`http://localhost/api/roles/${ROLE_ID}`), {
      params: Promise.resolve({ id: ROLE_ID }),
    })
    expect(res.status).toBe(404)
  })
})
