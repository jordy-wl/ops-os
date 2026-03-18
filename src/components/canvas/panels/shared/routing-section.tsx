'use client'

import { User, Bot, GitPullRequest, Link2 } from 'lucide-react'
import { PERMISSIONS, type Permission } from '@/lib/rbac/types'
import { FieldLabel, SelectInput } from './form-primitives'

const ROUTING_MODE_OPTIONS = [
  { value: 'policy_default', label: 'Inherit from Policy' },
  { value: 'human_only', label: 'Human Only' },
  { value: 'ai_only', label: 'AI Only' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'escalation_chain', label: 'Escalation Chain' },
]

const ROUTING_ICONS: Record<string, React.ElementType> = {
  human_only: User,
  ai_only: Bot,
  hybrid: GitPullRequest,
  escalation_chain: Link2,
}

const PERM_LABELS: Record<Permission, string> = {
  manage_blocks: 'Manage Blocks',
  edit_blocks: 'Edit Blocks',
  view_blocks: 'View Blocks',
  manage_workflows: 'Manage Workflows',
  execute_workflows: 'Execute Workflows',
  approve_tasks: 'Approve Tasks',
  manage_team: 'Manage Team',
  manage_settings: 'Manage Settings',
  manage_integrations: 'Manage Integrations',
  view_audit_log: 'View Audit Log',
}

interface RoutingSectionProps {
  routingMode: string
  requiredPermissions: string[]
  onRoutingModeChange: (v: string) => void
  onPermissionsChange: (v: string[] | undefined) => void
  /** If true, only show routing mode without permissions */
  compact?: boolean
}

export function RoutingSection({
  routingMode,
  requiredPermissions,
  onRoutingModeChange,
  onPermissionsChange,
  compact,
}: RoutingSectionProps) {
  return (
    <div className="mt-4 pt-4 border-t border-border">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Routing</h4>

      <div className="mb-3">
        <FieldLabel htmlFor="routing-mode">Routing Mode</FieldLabel>
        <div className="flex items-center gap-2">
          <SelectInput
            id="routing-mode"
            value={routingMode}
            onChange={onRoutingModeChange}
            options={ROUTING_MODE_OPTIONS}
          />
          {(() => {
            if (!routingMode || routingMode === 'policy_default') return null
            const Icon = ROUTING_ICONS[routingMode]
            return Icon ? <Icon className="h-4 w-4 text-muted-foreground shrink-0" /> : null
          })()}
        </div>
      </div>

      {!compact && (
        <div className="mb-3">
          <FieldLabel htmlFor="required-perms">Required Permissions</FieldLabel>
          <div className="space-y-1 max-h-40 overflow-y-auto rounded border border-border p-2">
            {PERMISSIONS.map((perm) => (
              <label key={perm} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                <input
                  type="checkbox"
                  checked={requiredPermissions.includes(perm)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...requiredPermissions, perm]
                      : requiredPermissions.filter((p) => p !== perm)
                    onPermissionsChange(next.length > 0 ? next : undefined)
                  }}
                  className="h-3 w-3 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-foreground">{PERM_LABELS[perm]}</span>
              </label>
            ))}
          </div>
          {requiredPermissions.length === 0 && (
            <p className="mt-1 text-xs text-muted-foreground italic">Any team member can handle this step</p>
          )}
        </div>
      )}
    </div>
  )
}

export { ROUTING_MODE_OPTIONS, ROUTING_ICONS, PERM_LABELS }
