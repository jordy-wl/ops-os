'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ArrowUpFromLine } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OutputNodeData {
  label: string
  config: Record<string, unknown>
  selected?: boolean
}

function OutputNodeComponent({ data, selected }: NodeProps & { data: OutputNodeData }) {
  const outputType = (data.config.output_type as string) || 'update_fields'
  const outputLabel =
    outputType === 'api_call'
      ? 'API Call'
      : outputType === 'emit_event'
        ? 'Event'
        : outputType === 'document'
          ? 'Document'
          : 'Update Fields'

  return (
    <div
      className={cn(
        'min-w-[180px] rounded-xl border bg-card/80 backdrop-blur-sm px-4 py-3 shadow-lg transition-shadow hover:shadow-xl',
        selected
          ? 'border-teal-500/60 ring-2 ring-teal-500/30'
          : 'border-border/50'
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-teal-500 !w-3 !h-3 !border-2 !border-white"
      />
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/15">
          <ArrowUpFromLine className="h-4 w-4 text-teal-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-teal-500 uppercase tracking-wide">
            Output
          </p>
          <p className="text-sm font-medium text-foreground truncate">{data.label}</p>
        </div>
      </div>
      {outputLabel && (
        <div className="mt-2 pt-2 border-t border-border">
          <span className="inline-flex items-center rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-medium text-teal-600 dark:text-teal-400">
            {outputLabel}
          </span>
        </div>
      )}
    </div>
  )
}

export const OutputNode = memo(OutputNodeComponent)
