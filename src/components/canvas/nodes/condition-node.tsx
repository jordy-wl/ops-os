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
        'min-w-[180px] rounded-lg border-2 bg-amber-50 px-4 py-3 shadow-sm',
        selected ? 'border-amber-600 ring-2 ring-amber-200' : 'border-amber-300'
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-3 !h-3 !border-2 !border-white" />
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-100">
          <GitBranch className="h-4 w-4 text-amber-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-amber-600 uppercase tracking-wide">Condition</p>
          <p className="text-sm font-medium text-gray-900 truncate">{data.label}</p>
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
