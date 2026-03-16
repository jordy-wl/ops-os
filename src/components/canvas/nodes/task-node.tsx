'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ClipboardCheck, User, Bot, GitPullRequest, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TaskNodeData {
  label: string
  config: Record<string, unknown>
  selected?: boolean
}

const ROUTING_BADGE: Record<string, { icon: React.ElementType; label: string }> = {
  human_only: { icon: User, label: 'Human' },
  ai_only: { icon: Bot, label: 'AI' },
  hybrid: { icon: GitPullRequest, label: 'Hybrid' },
  escalation_chain: { icon: Link2, label: 'Chain' },
}

function TaskNodeComponent({ data, selected }: NodeProps & { data: TaskNodeData }) {
  const config = (data.config ?? {}) as Record<string, unknown>
  const routingMode = config.routing_mode as string | undefined
  const badge = routingMode ? ROUTING_BADGE[routingMode] : undefined
  const formSchema = config.task_form_schema as Record<string, unknown> | undefined
  const actionCount = Array.isArray(formSchema?.actions) ? (formSchema.actions as unknown[]).length : 0
  const fieldCount = Array.isArray(formSchema?.fields) ? (formSchema.fields as unknown[]).length : 0

  return (
    <div
      className={cn(
        'min-w-[180px] rounded-xl border bg-card/80 backdrop-blur-sm px-4 py-3 shadow-lg transition-shadow hover:shadow-xl',
        selected ? 'border-violet-500/60 ring-2 ring-violet-500/30' : 'border-border/50'
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-violet-500 !w-3 !h-3 !border-2 !border-white" />
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15">
          <ClipboardCheck className="h-4 w-4 text-violet-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-violet-500 uppercase tracking-wide">Task</p>
          <p className="text-sm font-medium text-foreground truncate">{data.label}</p>
        </div>
      </div>
      {(badge || fieldCount > 0 || actionCount > 0) && (
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border">
          {badge && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400" title={`Routing: ${badge.label}`}>
              <badge.icon className="h-3 w-3" />
              {badge.label}
            </span>
          )}
          {fieldCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
              {fieldCount} field{fieldCount !== 1 ? 's' : ''}
            </span>
          )}
          {actionCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              {actionCount} action{actionCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-violet-500 !w-3 !h-3 !border-2 !border-white" />
    </div>
  )
}

export const TaskNode = memo(TaskNodeComponent)
