'use client'

import { PERMISSIONS, type Permission } from '@/lib/rbac/types'

/** Human-readable labels for each permission. */
const PERM_LABELS: Record<Permission, { label: string; group: string }> = {
  manage_blocks: { label: 'Create & delete blocks', group: 'Blocks' },
  edit_blocks: { label: 'Edit blocks', group: 'Blocks' },
  view_blocks: { label: 'View blocks', group: 'Blocks' },
  manage_workflows: { label: 'Create & edit workflows', group: 'Workflows' },
  execute_workflows: { label: 'Run workflows', group: 'Workflows' },
  approve_tasks: { label: 'Approve / reject tasks', group: 'Tasks' },
  manage_team: { label: 'Manage team & roles', group: 'Admin' },
  manage_settings: { label: 'Manage org settings', group: 'Admin' },
  manage_integrations: { label: 'Manage integrations', group: 'Admin' },
  view_audit_log: { label: 'View audit log', group: 'Audit' },
}

interface PermissionMatrixProps {
  selected: Set<Permission>
  onChange: (perms: Set<Permission>) => void
  disabled?: boolean
}

export function PermissionMatrix({ selected, onChange, disabled }: PermissionMatrixProps) {
  // Group permissions by category
  const groups = new Map<string, Permission[]>()
  for (const perm of PERMISSIONS) {
    const { group } = PERM_LABELS[perm]
    const existing = groups.get(group) ?? []
    existing.push(perm)
    groups.set(group, existing)
  }

  function toggle(perm: Permission) {
    const next = new Set(selected)
    if (next.has(perm)) {
      next.delete(perm)
    } else {
      next.add(perm)
    }
    onChange(next)
  }

  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([group, perms]) => (
        <div key={group}>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group}</h4>
          <div className="space-y-1">
            {perms.map((perm) => (
              <label
                key={perm}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-muted/50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(perm)}
                  onChange={() => toggle(perm)}
                  disabled={disabled}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
                />
                <span className="text-foreground">{PERM_LABELS[perm].label}</span>
                <code className="ml-auto text-xs text-muted-foreground">{perm}</code>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
