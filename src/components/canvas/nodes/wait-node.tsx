'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WaitNodeData {
  label: string
  config: Record<string, unknown>
  selected?: boolean
}

function WaitNodeComponent({ data, selected }: NodeProps & { data: WaitNodeData }) {
  return (
    <div
      className={cn(
        'min-w-[180px] rounded-md border bg-card px-4 py-3 shadow-elevation-1',
        selected ? 'border-gray-600 ring-2 ring-ring' : 'border-border'
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-500 !w-3 !h-3 !border-2 !border-white" />
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-200">
          <Clock className="h-4 w-4 text-gray-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Wait</p>
          <p className="text-sm font-medium text-foreground truncate">{data.label}</p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-500 !w-3 !h-3 !border-2 !border-white" />
    </div>
  )
}

export const WaitNode = memo(WaitNodeComponent)
