'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { GitBranch } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConditionNodeData {
  label: string
  config: Record<string, unknown>
  selected?: boolean
}

function ConditionNodeComponent({ data, selected }: NodeProps & { data: ConditionNodeData }) {
  return (
    <div
      className={cn(
        'min-w-[180px] rounded-xl border bg-card/80 backdrop-blur-sm px-4 py-3 shadow-lg transition-shadow hover:shadow-xl',
        selected ? 'border-amber-500/60 ring-2 ring-amber-500/30' : 'border-border/50'
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-3 !h-3 !border-2 !border-white" />
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15">
          <GitBranch className="h-4 w-4 text-amber-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-amber-500 uppercase tracking-wide">Condition</p>
          <p className="text-sm font-medium text-foreground truncate">{data.label}</p>
        </div>
      </div>
      {/* True branch (right) and False branch (bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        className="!bg-green-500 !w-3 !h-3 !border-2 !border-white !left-1/3"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        className="!bg-red-400 !w-3 !h-3 !border-2 !border-white !left-2/3"
      />
    </div>
  )
}

export const ConditionNode = memo(ConditionNodeComponent)
