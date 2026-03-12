'use client'

import { useState } from 'react'
import type { Permission } from '@/lib/rbac/types'
import { PermissionMatrix } from './permission-matrix'

interface RoleData {
  id: string
  name: string
  display_name: string
  description: string
  is_system: boolean
  permissions: string[]
}

interface RoleListProps {
  roles: RoleData[]
}

export function RoleList({ roles }: RoleListProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      {roles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-lg font-medium text-foreground mb-1">No roles found</p>
          <p className="text-sm text-muted-foreground">
            System roles are created automatically. Add custom roles for your team.
          </p>
        </div>
      )}

      {roles.map((role) => (
        <div key={role.id} className="rounded-lg border border-border bg-background overflow-hidden">
          <button
            type="button"
            onClick={() => setExpanded(expanded === role.id ? null : role.id)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground">{role.display_name}</span>
              {role.is_system && (
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  System
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {role.permissions.length} {role.permissions.length === 1 ? 'permission' : 'permissions'}
              </span>
            </div>
            <span className="text-muted-foreground text-xs">
              {expanded === role.id ? 'Collapse' : 'Expand'}
            </span>
          </button>

          {expanded === role.id && (
            <div className="border-t border-border px-4 py-3">
              {role.description && (
                <p className="text-sm text-muted-foreground mb-3">{role.description}</p>
              )}
              <PermissionMatrix
                selected={new Set(role.permissions as Permission[])}
                onChange={() => {}}
                disabled={role.is_system}
              />
              {role.is_system && (
                <p className="text-xs text-muted-foreground mt-3 italic">
                  System roles are read-only and cannot be modified.
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
