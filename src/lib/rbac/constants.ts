import type { Permission, SystemRoleName } from './types'

/**
 * System role definitions — seeded per org on creation.
 * System roles cannot be renamed or deleted.
 */
export const SYSTEM_ROLES: Record<
  SystemRoleName,
  { display_name: string; description: string; permissions: Permission[] }
> = {
  'ops-admin': {
    display_name: 'Admin',
    description: 'Full access to all features and settings.',
    permissions: [
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
    ],
  },
  'ops-user': {
    display_name: 'User',
    description: 'Can view and edit blocks, run workflows, and approve tasks.',
    permissions: [
      'view_blocks',
      'edit_blocks',
      'execute_workflows',
      'approve_tasks',
      'view_audit_log',
    ],
  },
  'compliance-approver': {
    display_name: 'Compliance Approver',
    description: 'Read-only access with task approval rights for compliance review.',
    permissions: [
      'view_blocks',
      'approve_tasks',
      'view_audit_log',
    ],
  },
}

/**
 * Map legacy role names to permissions for backward compatibility.
 * Used by resolvePermissions() when falling back to user_roles table.
 */
export function permissionsForRole(roleName: string): Permission[] {
  const role = SYSTEM_ROLES[roleName as SystemRoleName]
  return role ? [...role.permissions] : SYSTEM_ROLES['ops-user'].permissions
}
