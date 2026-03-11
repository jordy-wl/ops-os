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
        status === 'created' && 'border-green-200 bg-green-50',
        status === 'duplicate_warning' && 'border-amber-200 bg-amber-50',
        status === 'error' && 'border-red-200 bg-red-50'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        {status === 'created' && <CheckCircle className="h-4 w-4 text-green-600 shrink-0" aria-hidden="true" />}
        {status === 'duplicate_warning' && <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" aria-hidden="true" />}
        {status === 'error' && <XCircle className="h-4 w-4 text-red-600 shrink-0" aria-hidden="true" />}
        <span className={cn(
          'text-xs font-medium',
          status === 'created' && 'text-green-800',
          status === 'duplicate_warning' && 'text-amber-800',
          status === 'error' && 'text-red-800'
        )}>
          {status === 'created' && 'Block Created'}
          {status === 'duplicate_warning' && 'Potential Duplicates Found'}
          {status === 'error' && 'Creation Failed'}
        </span>
      </div>

      {/* Block info card */}
      <div className="flex items-start gap-2.5 bg-white rounded-md border border-gray-200 p-2.5 mb-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-gray-100">
          <Box className="h-4 w-4 text-gray-500" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
          <p className="text-xs text-gray-500">{typeLabel}</p>
        </div>
      </div>

      {/* Fields preview */}
      {fields && Object.keys(fields).length > 0 && (
        <div className="space-y-1 mb-2">
          <p className="text-xs font-medium text-gray-600">Fields</p>
          {Object.entries(fields).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2 text-xs">
              <span className="text-gray-500 shrink-0">{key}:</span>
              <span className="text-gray-900 truncate">{String(value)}</span>
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
      {error && <p className="text-xs text-red-700 mb-1">{error}</p>}

      {/* Block ID on success */}
      {blockId && (
        <p className="text-xs text-green-700 font-mono">{blockId}</p>
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
