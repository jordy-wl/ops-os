import type { SupabaseClient } from '@supabase/supabase-js'
import type { Permission } from './types'
import { permissionsForRole } from './constants'
import { logger } from '@/lib/logger'

/** Return type for resolvePermissions — spread into AuthContext. */
export interface ResolvedAuth {
  role: string
  roleId: string
  permissions: Set<Permission>
}

/**
 * Resolve a user's role and permissions from the RBAC tables.
 *
 * Query path:
 *   1. user_permissions → get role_id for this user+org
 *   2. roles → get role name
 *   3. permission_groups → get permission set
 *
 * If no assignment exists, auto-assigns the default role.
 * If RBAC tables aren't seeded for this org, falls back to static permissions.
 */
export async function resolvePermissions(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  defaultRoleName: string
): Promise<ResolvedAuth> {
  // 1. Check for existing role assignment
  const { data: assignment } = await supabase
    .from('user_permissions')
    .select('role_id')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle()

  let roleId: string

  if (assignment) {
    roleId = assignment.role_id
  } else {
    // No assignment — look up the default role for auto-assignment
    const { data: defaultRole } = await supabase
      .from('roles')
      .select('id')
      .eq('org_id', orgId)
      .eq('name', defaultRoleName)
      .maybeSingle()

    if (!defaultRole) {
      // RBAC not seeded for this org — fall back to static permissions
      logger.warn('rbac', 'rbac.fallback_to_static', { org_id: orgId })
      return {
        role: defaultRoleName,
        roleId: '',
        permissions: new Set(permissionsForRole(defaultRoleName)),
      }
    }

    roleId = defaultRole.id
    await supabase
      .from('user_permissions')
      .insert({ user_id: userId, org_id: orgId, role_id: roleId, assigned_by: 'system' })
  }

  // 2. Get role name
  const { data: role } = await supabase
    .from('roles')
    .select('name')
    .eq('id', roleId)
    .single()

  // 3. Get permissions for this role
  const { data: perms } = await supabase
    .from('permission_groups')
    .select('permission')
    .eq('role_id', roleId)

  return {
    role: role?.name ?? defaultRoleName,
    roleId,
    permissions: new Set<Permission>(
      (perms ?? []).map((p: { permission: string }) => p.permission as Permission)
    ),
  }
}
