'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Play, Mail, FileText, Calendar, Globe, Pencil, User, Bot, GitPullRequest, Link2, ScrollText, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ActionNodeData {
  label: string
  stepType?: string
  config: Record<string, unknown>
  selected?: boolean
}

const ROUTING_BADGE: Record<string, { icon: React.ElementType; label: string }> = {
  human_only: { icon: User, label: 'Human' },
  ai_only: { icon: Bot, label: 'AI' },
  hybrid: { icon: GitPullRequest, label: 'Hybrid' },
  escalation_chain: { icon: Link2, label: 'Chain' },
}

const STEP_ICONS: Record<string, React.ElementType> = {
  emit_event: Play,
  run_action: Play,
  call_api: Globe,
  send_email: Mail,
  generate_document: FileText,
  book_meeting: Calendar,
  update_block: Pencil,
}

function ActionNodeComponent({ data, selected }: NodeProps & { data: ActionNodeData }) {
  const Icon = STEP_ICONS[data.stepType ?? ''] ?? Play
  const config = (data.config ?? {}) as Record<string, unknown>
  const routingMode = config.routing_mode as string | undefined
  const hasInstructions = !!config.instructions
  const hasPermissions = Array.isArray(config.required_permissions) && config.required_permissions.length > 0
  const badge = routingMode ? ROUTING_BADGE[routingMode] : undefined

  return (
    <div
      className={cn(
        'min-w-[180px] rounded-md border bg-card px-4 py-3 shadow-elevation-1',
        selected ? 'border-green-600 ring-2 ring-ring' : 'border-border'
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-green-500 !w-3 !h-3 !border-2 !border-white" />
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-green-100">
          <Icon className="h-4 w-4 text-green-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-green-600 uppercase tracking-wide">Action</p>
          <p className="text-sm font-medium text-foreground truncate">{data.label}</p>
        </div>
      </div>
      {(badge || hasInstructions || hasPermissions) && (
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border">
          {badge && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700" title={`Routing: ${badge.label}`}>
              <badge.icon className="h-3 w-3" />
              {badge.label}
            </span>
          )}
          {hasInstructions && (
            <span className="inline-flex items-center rounded-full bg-blue-100 p-0.5" title="Has SOP instructions">
              <ScrollText className="h-3 w-3 text-blue-600" />
            </span>
          )}
          {hasPermissions && (
            <span className="inline-flex items-center rounded-full bg-amber-100 p-0.5" title="Permission required">
              <Shield className="h-3 w-3 text-amber-600" />
            </span>
          )}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-green-500 !w-3 !h-3 !border-2 !border-white" />
    </div>
  )
}

export const ActionNode = memo(ActionNodeComponent)
