'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Block } from '@/lib/context-assembly'
import { DynamicFieldRenderer } from '@/components/blocks/dynamic-field-renderer'

interface BlockDataPanelProps {
  block: Block
  /** Optional field_schema from block_type_definitions — enables structured display */
  fieldSchema?: {
    type?: string
    properties?: Record<string, unknown>
    required?: string[]
  }
}

// Fields shown separately in BlockHeader — omit from the data table
const EXCLUDED_FIELDS = new Set(['jurisdiction'])

/**
 * BlockDataPanel — renders block metadata with inline editing support.
 * Uses DynamicFieldRenderer V2 for typed display and editing.
 */
export function BlockDataPanel({ block, fieldSchema }: BlockDataPanelProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editValues, setEditValues] = useState<Record<string, unknown>>(block.metadata)
  const [error, setError] = useState<string | null>(null)

  const handleChange = useCallback((field: string, value: unknown) => {
    setEditValues((prev) => ({ ...prev, [field]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/blocks/${block.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata: editValues }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error?.message ?? 'Failed to save')
      }
      setEditing(false)
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }, [block.id, editValues, router])

  const handleCancel = useCallback(() => {
    setEditValues(block.metadata)
    setEditing(false)
    setError(null)
  }, [block.metadata])

  const entries = Object.entries(block.metadata).filter(
    ([key]) => !EXCLUDED_FIELDS.has(key)
  )

  // Use DynamicFieldRenderer when schema is available
  if (fieldSchema && fieldSchema.properties && Object.keys(fieldSchema.properties).length > 0) {
    return (
      <section aria-label="Block data">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Block Data</h2>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Edit
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancel}
                disabled={saving}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-xs font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>
        {error && (
          <p className="text-xs text-destructive mb-2">{error}</p>
        )}
        <DynamicFieldRenderer
          fieldSchema={fieldSchema as Parameters<typeof DynamicFieldRenderer>[0]['fieldSchema']}
          values={editing ? editValues : block.metadata}
          onChange={editing ? handleChange : undefined}
          readOnly={!editing}
        />
      </section>
    )
  }

  // Fallback: raw key-value display
  return (
    <section aria-label="Block data">
      <h2 className="text-sm font-semibold text-foreground mb-3">Block Data</h2>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No additional data recorded.</p>
      ) : (
        <dl className="divide-y divide-border rounded-lg border text-sm">
          {entries.map(([key, value]) => (
            <div key={key} className="flex gap-4 px-4 py-2.5">
              <dt className="w-36 shrink-0 font-medium text-muted-foreground capitalize">
                {key.replace(/_/g, ' ')}
              </dt>
              <dd className="flex-1 text-foreground break-words">
                {typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—')}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
