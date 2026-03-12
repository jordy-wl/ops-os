'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { DynamicFieldRenderer } from '@/components/blocks/dynamic-field-renderer'

interface BlockTypeDefinition {
  id: string
  type_name: string
  display_name: string
  field_schema: Record<string, unknown>
}

interface CreateBlockModalProps {
  onClose: () => void
  onCreated: () => void
}

/**
 * CreateBlockModal — modal form for creating a new block.
 * Fetches block type definitions and renders dynamic fields from field_schema.
 * Falls back to type-only selector if fetch fails or no types defined.
 */
export function CreateBlockModal({ onClose, onCreated }: CreateBlockModalProps) {
  const [blockTypes, setBlockTypes] = useState<BlockTypeDefinition[]>([])
  const [typesLoading, setTypesLoading] = useState(true)
  const [type, setType] = useState('')
  const [name, setName] = useState('')
  const [metadata, setMetadata] = useState<Record<string, unknown>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  // Fetch block type definitions
  const fetchTypes = useCallback(async () => {
    try {
      const res = await fetch('/api/block-types')
      if (res.ok) {
        const json = await res.json()
        const types = (json.data ?? []) as BlockTypeDefinition[]
        setBlockTypes(types)
        if (types.length > 0) setType(types[0].type_name)
      }
    } catch {
      // Fall back to no dynamic fields
    } finally {
      setTypesLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTypes()
  }, [fetchTypes])

  // Focus the name input once types are loaded
  useEffect(() => {
    if (!typesLoading) nameRef.current?.focus()
  }, [typesLoading])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const selectedType = blockTypes.find((t) => t.type_name === type)

  // Reset metadata when type changes
  function handleTypeChange(newType: string) {
    setType(newType)
    setMetadata({})
  }

  function handleFieldChange(field: string, value: unknown) {
    setMetadata((prev) => {
      const next = { ...prev }
      if (value === undefined) {
        delete next[field]
      } else {
        next[field] = value
      }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || !type) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          name: trimmed,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json?.error?.message ?? 'Failed to create block')
        return
      }

      onCreated()
      onClose()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  // Fallback types if API fetch fails or returns empty
  const FALLBACK_TYPES = ['client', 'deal', 'project', 'contract', 'contact', 'solution', 'product', 'service', 'team_member', 'policy']
  const typeOptions = blockTypes.length > 0
    ? blockTypes.map((t) => ({ value: t.type_name, label: t.display_name }))
    : FALLBACK_TYPES.map((t) => ({ value: t, label: t }))

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-block-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-sm rounded-lg bg-background p-6 shadow-lg max-h-[85vh] overflow-y-auto">
        <h2 id="create-block-title" className="text-lg font-semibold text-foreground mb-4">
          Create Block
        </h2>

        {typesLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground" aria-busy="true">
            Loading types…
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {/* Block type */}
            <label
              htmlFor="block-type"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Type
            </label>
            <select
              id="block-type"
              value={type}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="mb-4 w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {typeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Block name */}
            <label
              htmlFor="block-name"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Name
            </label>
            <input
              ref={nameRef}
              id="block-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Thornfield Capital Partners"
              maxLength={255}
              required
              className="mb-4 w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />

            {/* Dynamic fields from field_schema */}
            {selectedType && Object.keys(selectedType.field_schema).length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  {selectedType.display_name} Fields
                </p>
                <DynamicFieldRenderer
                  fieldSchema={selectedType.field_schema as Parameters<typeof DynamicFieldRenderer>[0]['fieldSchema']}
                  values={metadata}
                  onChange={handleFieldChange}
                />
              </div>
            )}

            {error && (
              <p role="alert" className="mb-4 text-xs text-red-600">
                {error}
              </p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium border border-border text-foreground',
                  'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                )}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !name.trim() || !type}
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground',
                  'hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {submitting ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
