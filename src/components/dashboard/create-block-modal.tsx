'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { DynamicFieldRenderer } from '@/components/blocks/dynamic-field-renderer'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface BlockTypeDefinition {
  id: string
  type_name: string
  display_name: string
  field_schema: Record<string, unknown>
}

interface SuggestedField {
  name: string
  type: string
  label: string
  description: string
  required: boolean
  group: string
}

interface SuggestedGroup {
  id: string
  label: string
  order: number
}

interface SuggestedRelationship {
  field_name: string
  target_block_type: string
  description: string
}

interface FieldSuggestionResult {
  suggested_fields: SuggestedField[]
  suggested_groups: SuggestedGroup[]
  suggested_relationships: SuggestedRelationship[]
  reasoning: string
}

interface CreateBlockModalProps {
  onClose: () => void
  onCreated: () => void
}

/**
 * CreateBlockModal — modal form for creating a new block.
 * Includes AI-assisted field suggestion: describe what you need, get suggested
 * fields with types and groups, accept/dismiss per field, then create.
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

  // AI suggestion state
  const [aiDescription, setAiDescription] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<FieldSuggestionResult | null>(null)
  const [acceptedFields, setAcceptedFields] = useState<Set<string>>(new Set())
  const [showAiPanel, setShowAiPanel] = useState(false)

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

  const selectedType = blockTypes.find((t) => t.type_name === type)

  // Reset metadata when type changes
  function handleTypeChange(newType: string) {
    setType(newType)
    setMetadata({})
    setAiResult(null)
    setAcceptedFields(new Set())
    setShowAiPanel(false)
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

  // AI field suggestion
  const handleAiSuggest = useCallback(async () => {
    if (!aiDescription.trim() || !type) return

    setAiLoading(true)
    setError(null)
    setAiResult(null)

    try {
      const res = await fetch('/api/block-types/suggest-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: aiDescription.trim(),
          block_type_slug: type,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(
          data.error?.message ?? `Suggestion failed (${res.status})`
        )
      }

      const json = await res.json()
      const result = json.data as FieldSuggestionResult

      setAiResult(result)
      // Auto-accept all suggested fields
      setAcceptedFields(new Set(result.suggested_fields.map((f) => f.name)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI suggestion failed')
    } finally {
      setAiLoading(false)
    }
  }, [aiDescription, type])

  // Apply accepted AI suggestions to the block type, then create block
  const handleApplyAndCreate = useCallback(async () => {
    if (!aiResult || acceptedFields.size === 0) return

    setSubmitting(true)
    setError(null)

    try {
      const fieldsToAdd = aiResult.suggested_fields.filter((f) =>
        acceptedFields.has(f.name)
      )
      const groupsToAdd = aiResult.suggested_groups

      // Configure the block type with suggested fields + groups
      if (fieldsToAdd.length > 0 && selectedType) {
        const configRes = await fetch(`/api/block-types/${selectedType.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            field_schema: buildUpdatedSchema(
              selectedType.field_schema,
              fieldsToAdd,
              groupsToAdd
            ),
          }),
        })

        if (!configRes.ok) {
          const data = await configRes.json().catch(() => ({}))
          throw new Error(
            data.error?.message ?? 'Failed to configure block type'
          )
        }
      }

      // Now create the block
      const trimmed = name.trim()
      if (trimmed) {
        const createRes = await fetch('/api/blocks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type,
            name: trimmed,
            metadata:
              Object.keys(metadata).length > 0 ? metadata : undefined,
          }),
        })
        const json = await createRes.json()
        if (!createRes.ok) {
          setError(json?.error?.message ?? 'Failed to create block')
          return
        }
      }

      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed')
    } finally {
      setSubmitting(false)
    }
  }, [
    aiResult,
    acceptedFields,
    selectedType,
    name,
    type,
    metadata,
    onCreated,
    onClose,
  ])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || !type) return

    // If AI suggestions are accepted, apply them first
    if (aiResult && acceptedFields.size > 0) {
      await handleApplyAndCreate()
      return
    }

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

  function toggleFieldAcceptance(fieldName: string) {
    setAcceptedFields((prev) => {
      const next = new Set(prev)
      if (next.has(fieldName)) next.delete(fieldName)
      else next.add(fieldName)
      return next
    })
  }

  // Fallback types if API fetch fails or returns empty
  const FALLBACK_TYPES = [
    'client',
    'deal',
    'project',
    'contract',
    'contact',
    'solution',
    'product',
    'service',
    'team_member',
    'policy',
  ]
  const typeOptions =
    blockTypes.length > 0
      ? blockTypes.map((t) => ({ value: t.type_name, label: t.display_name }))
      : FALLBACK_TYPES.map((t) => ({ value: t, label: t }))

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Block</DialogTitle>
          <DialogDescription className="sr-only">
            Fill out the form below to create a new block.
          </DialogDescription>
        </DialogHeader>

        {typesLoading ? (
          <div
            className="py-8 text-center text-[13px] text-muted-foreground"
            aria-busy="true"
          >
            Loading types…
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {/* Block type */}
            <label
              htmlFor="block-type"
              className="block text-[13px] font-medium text-foreground mb-1"
            >
              Type
            </label>
            <select
              id="block-type"
              value={type}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="mb-4 w-full h-8 rounded-md border border-border bg-background px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring"
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
              className="block text-[13px] font-medium text-foreground mb-1"
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
              className="mb-4 w-full h-8 rounded-md border border-border bg-background px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring"
            />

            {/* AI-assisted field suggestion toggle */}
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setShowAiPanel(!showAiPanel)}
                className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
                  <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
                </svg>
                {showAiPanel ? 'Hide AI Assistant' : 'AI Suggest Fields'}
              </button>
            </div>

            {/* AI suggestion panel */}
            {showAiPanel && (
              <div className="mb-4 rounded-lg border bg-muted/50 p-4">
                <p className="text-xs text-muted-foreground mb-2">
                  Describe what fields this block type needs and AI will suggest
                  a configuration.
                </p>
                <textarea
                  value={aiDescription}
                  onChange={(e) => setAiDescription(e.target.value)}
                  placeholder="e.g. Financial services client with compliance tracking, risk assessment, and revenue data"
                  rows={2}
                  maxLength={500}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring resize-none mb-2"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAiSuggest}
                  disabled={aiLoading || !aiDescription.trim()}
                >
                  {aiLoading ? 'Suggesting...' : 'Get Suggestions'}
                </Button>

                {/* AI results */}
                {aiResult && (
                  <div className="mt-3 space-y-3">
                    {aiResult.reasoning && (
                      <p className="text-xs text-muted-foreground italic">
                        {aiResult.reasoning}
                      </p>
                    )}

                    {/* Suggested groups */}
                    {aiResult.suggested_groups.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-foreground mb-1">
                          Suggested Groups
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {aiResult.suggested_groups.map((g) => (
                            <span
                              key={g.id}
                              className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                            >
                              {g.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Suggested fields */}
                    {aiResult.suggested_fields.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-medium text-foreground">
                            Suggested Fields ({acceptedFields.size}/
                            {aiResult.suggested_fields.length})
                          </p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setAcceptedFields(
                                  new Set(
                                    aiResult.suggested_fields.map(
                                      (f) => f.name
                                    )
                                  )
                                )
                              }
                              className="text-xs text-primary hover:underline"
                            >
                              Accept all
                            </button>
                            <button
                              type="button"
                              onClick={() => setAcceptedFields(new Set())}
                              className="text-xs text-muted-foreground hover:underline"
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                        <ul className="space-y-1">
                          {aiResult.suggested_fields.map((field) => (
                            <li key={field.name}>
                              <label className="flex items-start gap-2 py-1 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={acceptedFields.has(field.name)}
                                  onChange={() =>
                                    toggleFieldAcceptance(field.name)
                                  }
                                  className="mt-0.5 rounded border-border text-primary focus:ring-ring"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-medium text-foreground">
                                      {field.label}
                                    </span>
                                    <span className="text-[10px] px-1 rounded bg-muted text-muted-foreground">
                                      {field.type}
                                    </span>
                                    {field.required && (
                                      <span className="text-[10px] text-destructive">
                                        req
                                      </span>
                                    )}
                                    {field.group &&
                                      field.group !== 'general' && (
                                        <span className="text-[10px] text-primary/70">
                                          {field.group}
                                        </span>
                                      )}
                                  </div>
                                  {field.description && (
                                    <p className="text-[10px] text-muted-foreground leading-tight">
                                      {field.description}
                                    </p>
                                  )}
                                </div>
                              </label>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Suggested relationships */}
                    {aiResult.suggested_relationships.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-foreground mb-1">
                          Suggested Relationships
                        </p>
                        <ul className="space-y-0.5">
                          {aiResult.suggested_relationships.map((r) => (
                            <li
                              key={r.field_name}
                              className="text-xs text-muted-foreground"
                            >
                              <span className="font-medium text-foreground">
                                {r.field_name}
                              </span>{' '}
                              → {r.target_block_type}
                              {r.description && ` — ${r.description}`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {aiResult.suggested_fields.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No field suggestions generated. Try a more specific
                        description.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Dynamic fields from field_schema */}
            {selectedType &&
              Object.keys(selectedType.field_schema).length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    {selectedType.display_name} Fields
                  </p>
                  <DynamicFieldRenderer
                    fieldSchema={
                      selectedType.field_schema as Parameters<
                        typeof DynamicFieldRenderer
                      >[0]['fieldSchema']
                    }
                    values={metadata}
                    onChange={handleFieldChange}
                  />
                </div>
              )}

            {error && (
              <p role="alert" className="mb-4 text-xs text-destructive">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting || !name.trim() || !type}
              >
                {submitting
                  ? 'Creating…'
                  : aiResult && acceptedFields.size > 0
                    ? `Create + Apply ${acceptedFields.size} Fields`
                    : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Build an updated field_schema by merging AI-suggested fields and groups
 * into the existing schema.
 */
function buildUpdatedSchema(
  existing: Record<string, unknown>,
  fields: SuggestedField[],
  groups: SuggestedGroup[]
): Record<string, unknown> {
  const FIELD_TYPE_MAP: Record<string, Record<string, unknown>> = {
    text: { type: 'string' },
    number: { type: 'number' },
    email: { type: 'string', format: 'email' },
    date: { type: 'string', format: 'date' },
    select: { type: 'string', enum: [] },
    'multi-select': { type: 'array', items: { type: 'string', enum: [] } },
    boolean: { type: 'boolean' },
    url: { type: 'string', format: 'uri' },
    phone: { type: 'string' },
    currency: { type: 'number', minimum: 0, 'x-currency-code': 'AUD' },
    relation: { type: 'string' },
    'rich-text': { type: 'string' },
  }

  const properties = {
    ...((existing.properties ?? {}) as Record<string, Record<string, unknown>>),
  }

  const existingFieldCount = Object.keys(properties).length
  let orderCounter = existingFieldCount

  for (const field of fields) {
    if (properties[field.name]) continue // Don't overwrite existing fields

    const baseSchema = FIELD_TYPE_MAP[field.type] ?? { type: 'string' }
    properties[field.name] = {
      ...baseSchema,
      'x-field-type': field.type,
      'x-display-order': orderCounter++,
      description: field.description || field.label,
      ...(field.group && field.group !== 'general'
        ? { 'x-field-group': field.group }
        : {}),
    }
  }

  // Merge groups
  const existingGroups = (existing['x-field-groups'] ?? []) as SuggestedGroup[]
  const existingGroupIds = new Set(existingGroups.map((g) => g.id))
  const newGroups = groups.filter((g) => !existingGroupIds.has(g.id))
  const mergedGroups = [...existingGroups, ...newGroups]

  // Build required array
  const existingRequired = (existing.required ?? []) as string[]
  const newRequired = fields
    .filter((f) => f.required && !existingRequired.includes(f.name))
    .map((f) => f.name)
  const allRequired = [...existingRequired, ...newRequired]

  return {
    ...existing,
    type: 'object',
    properties,
    required: allRequired.length > 0 ? allRequired : undefined,
    'x-field-groups':
      mergedGroups.length > 0 ? mergedGroups : existing['x-field-groups'],
  }
}
