'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Split } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RouteBranch {
  value: string
  label?: string
}

interface RouteNodeData {
  label: string
  config: {
    route_field?: string
    route_branches?: RouteBranch[]
    route_default_label?: string
    [key: string]: unknown
  }
  selected?: boolean
}

function RouteNodeComponent({ data, selected }: NodeProps & { data: RouteNodeData }) {
  const branches = data.config.route_branches ?? []
  const defaultLabel = data.config.route_default_label ?? 'Default'

  // All output handles: one per branch + default
  const allBranches = [...branches.map((b) => b.label || b.value), defaultLabel]

  return (
    <div
      className={cn(
        'min-w-[200px] rounded-xl border bg-card/80 backdrop-blur-sm px-4 py-3 shadow-lg transition-shadow hover:shadow-xl',
        selected ? 'border-orange-500/60 ring-2 ring-orange-500/30' : 'border-border/50'
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-orange-500 !w-3 !h-3 !border-2 !border-white" />
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/15">
          <Split className="h-4 w-4 text-orange-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-orange-500 uppercase tracking-wide">Route</p>
          <p className="text-sm font-medium text-foreground truncate">{data.label}</p>
        </div>
      </div>

      {/* Branch labels */}
      {allBranches.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {allBranches.map((label, i) => (
            <span
              key={`${label}-${i}`}
              className={cn(
                'inline-block rounded px-1.5 py-0.5 text-[10px] font-medium',
                i === allBranches.length - 1
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-orange-500/10 text-orange-600'
              )}
            >
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Output handles — one per branch + default, spread horizontally */}
      {allBranches.map((label, i) => {
        const total = allBranches.length
        const offset = total <= 1 ? 50 : (i / (total - 1)) * 80 + 10
        return (
          <Handle
            key={`branch-${i}`}
            type="source"
            position={Position.Bottom}
            id={i === allBranches.length - 1 ? 'default' : `branch-${i}`}
            className={cn(
              '!w-3 !h-3 !border-2 !border-white',
              i === allBranches.length - 1 ? '!bg-muted-foreground' : '!bg-orange-500'
            )}
            style={{ left: `${offset}%` }}
          />
        )
      })}
    </div>
  )
}

export const RouteNode = memo(RouteNodeComponent)
