'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TriggerNodeData {
  label: string
  config: Record<string, unknown>
  selected?: boolean
}

function TriggerNodeComponent({ data, selected }: NodeProps & { data: TriggerNodeData }) {
  return (
    <div
      className={cn(
        'min-w-[180px] rounded-xl border bg-card/80 backdrop-blur-sm px-4 py-3 shadow-lg transition-shadow hover:shadow-xl',
        selected ? 'border-blue-500/60 ring-2 ring-blue-500/30' : 'border-border/50'
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/15">
          <Zap className="h-4 w-4 text-blue-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-blue-500 uppercase tracking-wide">Trigger</p>
          <p className="text-sm font-medium text-foreground truncate">{data.label}</p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-3 !h-3 !border-2 !border-white" />
    </div>
  )
}

export const TriggerNode = memo(TriggerNodeComponent)
