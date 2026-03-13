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
        'min-w-[180px] rounded-md border bg-card px-4 py-3 shadow-elevation-1',
        selected ? 'border-blue-600 ring-2 ring-ring' : 'border-border'
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-100">
          <Zap className="h-4 w-4 text-blue-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Trigger</p>
          <p className="text-sm font-medium text-foreground truncate">{data.label}</p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-3 !h-3 !border-2 !border-white" />
    </div>
  )
}

export const TriggerNode = memo(TriggerNodeComponent)
