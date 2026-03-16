'use client'

import { cn } from '@/lib/utils'
import { Box, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

interface BlockCreationPreviewProps {
  name: string
  type: string
  fields?: Record<string, unknown>
  warnings?: string[]
  duplicates?: { id: string; name: string; similarity: string }[]
  status: 'created' | 'duplicate_warning' | 'error'
  blockId?: string
  error?: string
}

const TYPE_LABELS: Record<string, string> = {
  client: 'Client',
  deal: 'Deal',
  project: 'Project',
  contact: 'Contact',
  contract: 'Contract',
  task_queue_item: 'Task',
  workflow_template: 'Workflow',
}

export function BlockCreationPreview({
  name,
  type,
  fields,
  warnings,
  duplicates,
  status,
  blockId,
  error,
}: BlockCreationPreviewProps) {
  const typeLabel = TYPE_LABELS[type] ?? type

  return (
    <div
      className={cn(
        'rounded-lg border p-3 max-w-[85%]',
        status === 'created' && 'border-success/20 bg-success/5',
        status === 'duplicate_warning' && 'border-warning/20 bg-warning/5',
        status === 'error' && 'border-destructive/20 bg-destructive/5'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        {status === 'created' && <CheckCircle className="h-4 w-4 text-success shrink-0" aria-hidden="true" />}
        {status === 'duplicate_warning' && <AlertTriangle className="h-4 w-4 text-warning shrink-0" aria-hidden="true" />}
        {status === 'error' && <XCircle className="h-4 w-4 text-destructive shrink-0" aria-hidden="true" />}
        <span className={cn(
          'text-xs font-medium',
          status === 'created' && 'text-success',
          status === 'duplicate_warning' && 'text-warning',
          status === 'error' && 'text-destructive'
        )}>
          {status === 'created' && 'Block Created'}
          {status === 'duplicate_warning' && 'Potential Duplicates Found'}
          {status === 'error' && 'Creation Failed'}
        </span>
      </div>

      {/* Block info card */}
      <div className="flex items-start gap-2.5 bg-background rounded-md border border-border p-2.5 mb-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted">
          <Box className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{name}</p>
          <p className="text-xs text-muted-foreground">{typeLabel}</p>
        </div>
      </div>

      {/* Fields preview */}
      {fields && Object.keys(fields).length > 0 && (
        <div className="space-y-1 mb-2">
          <p className="text-xs font-medium text-muted-foreground">Fields</p>
          {Object.entries(fields).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground shrink-0">{key}:</span>
              <span className="text-foreground truncate">{String(value)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Duplicate matches */}
      {duplicates && duplicates.length > 0 && (
        <div className="space-y-1 mb-2">
          <p className="text-xs font-medium text-amber-700">Similar blocks exist:</p>
          {duplicates.map((d) => (
            <div key={d.id} className="flex items-center gap-2 text-xs text-amber-800 bg-amber-100/50 rounded px-2 py-1">
              <span className="truncate">{d.name}</span>
              <span className="shrink-0 text-amber-600">({d.similarity} match)</span>
            </div>
          ))}
        </div>
      )}

      {/* Validation warnings */}
      {warnings && warnings.length > 0 && (
        <div className="space-y-0.5 mb-2">
          {warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-700">{w}</p>
          ))}
        </div>
      )}

      {/* Error message */}
      {error && <p className="text-xs text-destructive mb-1">{error}</p>}

      {/* Block ID on success */}
      {blockId && (
        <p className="text-xs text-success font-mono">{blockId}</p>
      )}
    </div>
  )
}

/**
 * Extract block creation preview data from a create_block tool call result.
 * Returns null if the tool call is not a create_block call.
 */
export function extractBlockCreationData(
  toolCall: { name: string; input: unknown; result: { success: boolean; data?: unknown; error?: string } }
): BlockCreationPreviewProps | null {
  if (toolCall.name !== 'create_block') return null

  const input = toolCall.input as Record<string, unknown> | undefined
  const data = toolCall.result.data as Record<string, unknown> | undefined

  const name = String(input?.name ?? data?.name ?? 'Unknown')
  const type = String(input?.type ?? data?.type ?? 'unknown')
  const fields = (input?.metadata as Record<string, unknown>) ?? undefined

  if (toolCall.result.success) {
    return {
      name,
      type,
      fields,
      warnings: (data?.warnings as string[]) ?? undefined,
      status: 'created',
      blockId: data?.block_id ? String(data.block_id) : undefined,
    }
  }

  // Check if it's a duplicate warning
  const duplicates = data?.duplicates as { id: string; name: string; similarity: string }[] | undefined
  if (duplicates && duplicates.length > 0) {
    return {
      name,
      type,
      fields,
      duplicates,
      status: 'duplicate_warning',
    }
  }

  return {
    name,
    type,
    fields,
    status: 'error',
    error: toolCall.result.error,
  }
}
