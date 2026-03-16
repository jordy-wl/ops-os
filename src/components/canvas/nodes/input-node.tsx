'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ArrowDownToLine } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InputNodeData {
  label: string
  config: Record<string, unknown>
  selected?: boolean
}

function InputNodeComponent({ data, selected }: NodeProps & { data: InputNodeData }) {
  const sourceType = (data.config.source_type as string) || 'block_fields'
  const sourceLabel =
    sourceType === 'webhook' ? 'Webhook' : sourceType === 'api' ? 'API' : 'Block Fields'

  return (
    <div
      className={cn(
        'min-w-[180px] rounded-xl border bg-card/80 backdrop-blur-sm px-4 py-3 shadow-lg transition-shadow hover:shadow-xl',
        selected
          ? 'border-indigo-500/60 ring-2 ring-indigo-500/30'
          : 'border-border/50'
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/15">
          <ArrowDownToLine className="h-4 w-4 text-indigo-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-indigo-500 uppercase tracking-wide">
            Input
          </p>
          <p className="text-sm font-medium text-foreground truncate">{data.label}</p>
        </div>
      </div>
      {sourceLabel && (
        <div className="mt-2 pt-2 border-t border-border">
          <span className="inline-flex items-center rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
            {sourceLabel}
          </span>
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-indigo-500 !w-3 !h-3 !border-2 !border-white"
      />
    </div>
  )
}

export const InputNode = memo(InputNodeComponent)
