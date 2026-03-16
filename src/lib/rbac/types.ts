/**
 * RBAC Types — Custom permission-based role system.
 *
 * Clerk handles authentication (login). This module handles authorization
 * (what a logged-in user can do within their org).
 */

/** The 10 granular permissions in the system. */
export const PERMISSIONS = [
  'manage_blocks',
  'edit_blocks',
  'view_blocks',
  'manage_workflows',
  'execute_workflows',
  'approve_tasks',
  'manage_team',
  'manage_settings',
  'manage_integrations',
  'view_audit_log',
] as const

export type Permission = (typeof PERMISSIONS)[number]

/** System role names — these cannot be renamed or deleted. */
export const SYSTEM_ROLE_NAMES = ['ops-admin', 'ops-user', 'compliance-approver'] as const
export type SystemRoleName = (typeof SYSTEM_ROLE_NAMES)[number]

/** A role row from the `roles` table. */
export interface Role {
  id: string
  org_id: string
  name: string
  display_name: string
  description: string
  is_system: boolean
  created_at: string
  updated_at: string
}

/** A permission_groups row (role → permission mapping). */
export interface PermissionGroup {
  id: string
  role_id: string
  permission: Permission
}

/** A user_permissions row (user → role assignment per org). */
export interface UserPermission {
  id: string
  user_id: string
  org_id: string
  role_id: string
  assigned_by: string | null
  assigned_at: string
}
