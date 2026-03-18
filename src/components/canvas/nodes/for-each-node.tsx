'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Repeat } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ForEachNodeData {
  label: string
  config: {
    for_each_source?: string
    for_each_max_parallel?: number
    for_each_max_iterations?: number
    [key: string]: unknown
  }
  selected?: boolean
}

function ForEachNodeComponent({ data, selected }: NodeProps & { data: ForEachNodeData }) {
  const source = data.config.for_each_source
  const maxParallel = data.config.for_each_max_parallel

  return (
    <div
      className={cn(
        'min-w-[180px] rounded-xl border bg-card/80 backdrop-blur-sm px-4 py-3 shadow-lg transition-shadow hover:shadow-xl',
        selected ? 'border-teal-500/60 ring-2 ring-teal-500/30' : 'border-border/50'
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-teal-500 !w-3 !h-3 !border-2 !border-white" />
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/15">
          <Repeat className="h-4 w-4 text-teal-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-teal-500 uppercase tracking-wide">For Each</p>
          <p className="text-sm font-medium text-foreground truncate">{data.label}</p>
        </div>
      </div>

      {/* Source and parallelism badges */}
      {(source || maxParallel) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {source && (
            <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium bg-teal-500/10 text-teal-600">
              {source}
            </span>
          )}
          {maxParallel && maxParallel > 1 && (
            <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
              {maxParallel}x parallel
            </span>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-teal-500 !w-3 !h-3 !border-2 !border-white" />
    </div>
  )
}

export const ForEachNode = memo(ForEachNodeComponent)
