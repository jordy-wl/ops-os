import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

import { resolvePermissions } from '@/lib/rbac/resolve'

// ─── Supabase mock builder ──────────────────────────────────────────────────

type MockResult = { data: unknown; error: unknown }

function makeSupabase(config: {
  assignmentResult?: MockResult
  defaultRoleResult?: MockResult
  roleNameResult?: MockResult
  permissionsResult?: MockResult
}) {
  const chains: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {}

  // user_permissions chain
  const upMaybeSingle = vi.fn().mockResolvedValue(
    config.assignmentResult ?? { data: null, error: null }
  )
  const upInsert = vi.fn().mockResolvedValue({ data: null, error: null })
  chains['user_permissions'] = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: upMaybeSingle,
    insert: upInsert,
  }

  // roles chain — can be called for default role lookup OR role name lookup
  const roleResults = [
    config.defaultRoleResult ?? { data: null, error: null },
    config.roleNameResult ?? { data: { name: 'ops-admin' }, error: null },
  ]
  let roleCallIdx = 0
  const roleMaybeSingle = vi.fn().mockImplementation(() =>
    Promise.resolve(roleResults[roleCallIdx++] ?? { data: null, error: null })
  )
  const roleSingle = vi.fn().mockImplementation(() =>
    Promise.resolve(config.roleNameResult ?? { data: { name: 'ops-admin' }, error: null })
  )
  chains['roles'] = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: roleMaybeSingle,
    single: roleSingle,
  }

  // permission_groups chain
  const pgEq = vi.fn().mockResolvedValue(
    config.permissionsResult ?? {
      data: [
        { permission: 'manage_blocks' },
        { permission: 'edit_blocks' },
        { permission: 'view_blocks' },
      ],
      error: null,
    }
  )
  chains['permission_groups'] = {
    select: vi.fn().mockReturnThis(),
    eq: pgEq,
  }

  const mock = {
    from: vi.fn((table: string) => {
      return chains[table] ?? chains['user_permissions']
    }),
  }

  return { mock: mock as unknown as Parameters<typeof resolvePermissions>[0], chains, upInsert }
}

describe('resolvePermissions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns permissions for a user with an existing assignment', async () => {
    const { mock } = makeSupabase({
      assignmentResult: { data: { role_id: 'role-123' }, error: null },
      roleNameResult: { data: { name: 'ops-admin' }, error: null },
      permissionsResult: {
        data: [
          { permission: 'manage_blocks' },
          { permission: 'edit_blocks' },
          { permission: 'view_blocks' },
        ],
        error: null,
      },
    })

    const result = await resolvePermissions(mock, 'org-1', 'user-1', 'ops-user')

    expect(result.role).toBe('ops-admin')
    expect(result.roleId).toBe('role-123')
    expect(result.permissions).toEqual(new Set(['manage_blocks', 'edit_blocks', 'view_blocks']))
  })

  it('auto-assigns default role when no assignment exists', async () => {
    const { mock, upInsert } = makeSupabase({
      assignmentResult: { data: null, error: null }, // no assignment
      defaultRoleResult: { data: { id: 'default-role-id' }, error: null }, // default role found
      roleNameResult: { data: { name: 'ops-user' }, error: null },
      permissionsResult: {
        data: [{ permission: 'view_blocks' }, { permission: 'edit_blocks' }],
        error: null,
      },
    })

    const result = await resolvePermissions(mock, 'org-1', 'user-new', 'ops-user')

    expect(result.role).toBe('ops-user')
    expect(result.roleId).toBe('default-role-id')
    expect(result.permissions).toEqual(new Set(['view_blocks', 'edit_blocks']))
    expect(upInsert).toHaveBeenCalledWith({
      user_id: 'user-new', org_id: 'org-1', role_id: 'default-role-id', assigned_by: 'system',
    })
  })

  it('falls back to static permissions when RBAC not seeded for org', async () => {
    const { mock, upInsert } = makeSupabase({
      assignmentResult: { data: null, error: null }, // no assignment
      defaultRoleResult: { data: null, error: null }, // no default role (RBAC not seeded)
    })

    const result = await resolvePermissions(mock, 'org-1', 'user-1', 'ops-admin')

    expect(result.role).toBe('ops-admin')
    expect(result.roleId).toBe('')
    expect(result.permissions).toContain('manage_blocks')
    expect(result.permissions).toContain('view_blocks')
    expect(result.permissions.size).toBe(10) // all permissions for ops-admin
    expect(upInsert).not.toHaveBeenCalled()
  })

  it('returns empty permissions when role has no permission_groups', async () => {
    const { mock } = makeSupabase({
      assignmentResult: { data: { role_id: 'custom-role-id' }, error: null },
      roleNameResult: { data: { name: 'custom-viewer' }, error: null },
      permissionsResult: { data: [], error: null },
    })

    const result = await resolvePermissions(mock, 'org-1', 'user-1', 'ops-user')

    expect(result.role).toBe('custom-viewer')
    expect(result.roleId).toBe('custom-role-id')
    expect(result.permissions.size).toBe(0)
  })

  it('handles null permissions gracefully', async () => {
    const { mock } = makeSupabase({
      assignmentResult: { data: { role_id: 'role-123' }, error: null },
      roleNameResult: { data: { name: 'ops-admin' }, error: null },
      permissionsResult: { data: null, error: { code: 'PGRST116' } },
    })

    const result = await resolvePermissions(mock, 'org-1', 'user-1', 'ops-user')

    expect(result.permissions.size).toBe(0)
  })

  it('uses default role name when role lookup returns null', async () => {
    const { mock } = makeSupabase({
      assignmentResult: { data: { role_id: 'role-123' }, error: null },
      roleNameResult: { data: null, error: { code: 'PGRST116' } },
      permissionsResult: { data: [{ permission: 'view_blocks' }], error: null },
    })

    const result = await resolvePermissions(mock, 'org-1', 'user-1', 'ops-user')

    expect(result.role).toBe('ops-user') // falls back to default name
  })
})
