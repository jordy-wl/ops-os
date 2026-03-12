'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  FIELD_TYPES,
  FIELD_TYPE_DEFINITIONS,
  inferFieldType,
  getFieldGroups,
  type FieldType,
  type FieldGroup,
} from '@/lib/block-types/field-types'
import type {
  SuggestedField,
  SuggestedGroup,
  FieldSuggestionResult,
} from '@/lib/ai/field-suggestion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FieldSchema {
  type: string
  properties: Record<string, Record<string, unknown>>
  required?: string[]
  'x-field-groups'?: FieldGroup[]
}

interface InlineFieldManagerProps {
  blockTypeId: string
  blockTypeName: string
  blockTypeSlug: string
  schema: FieldSchema
  onSchemaUpdate: () => void
}

interface FieldEntry {
  name: string
  fieldType: FieldType
  property: Record<string, unknown>
  order: number
  isSystem: boolean
  isRequired: boolean
  group: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFieldTypeIcon(fieldType: FieldType): string {
  const def = FIELD_TYPE_DEFINITIONS[fieldType]
  const iconMap: Record<string, string> = {
    type: 'Aa',
    hash: '#',
    mail: '@',
    calendar: '\u{1F4C5}',
    list: '\u2261',
    'list-checks': '\u2611',
    'toggle-left': '\u25C9',
    link: '\u{1F517}',
    phone: '\u{1F4DE}',
    'dollar-sign': '$',
    'link-2': '\u{1F50D}',
    text: '\u00B6',
  }
  return iconMap[def.icon] ?? 'Aa'
}

function labelToId(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InlineFieldManager({
  blockTypeId,
  blockTypeName,
  blockTypeSlug,
  schema,
  onSchemaUpdate,
}: InlineFieldManagerProps) {
  const router = useRouter()

  // ── Derived data ──────────────────────────────────────────────────────
  const fieldGroups = useMemo(
    () => getFieldGroups(schema as unknown as Record<string, unknown>),
    [schema]
  )

  const fields: FieldEntry[] = useMemo(
    () =>
      Object.entries(schema.properties)
        .map(([name, prop]) => ({
          name,
          fieldType: inferFieldType(prop),
          property: prop,
          order: (prop['x-display-order'] as number) ?? 0,
          isSystem: !!(prop['x-is-system'] as boolean),
          isRequired: (schema.required ?? []).includes(name),
          group: (prop['x-field-group'] as string) || 'general',
        }))
        .sort((a, b) => a.order - b.order),
    [schema]
  )

  const fieldsByGroup = useMemo(() => {
    const map = new Map<string, FieldEntry[]>()
    for (const g of fieldGroups) {
      map.set(g.id, [])
    }
    for (const field of fields) {
      const groupId = map.has(field.group) ? field.group : 'general'
      const list = map.get(groupId) ?? []
      list.push(field)
      map.set(groupId, list)
    }
    return map
  }, [fields, fieldGroups])

  const hasMultipleGroups = fieldGroups.length > 1

  // ── UI state ──────────────────────────────────────────────────────────
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [showAddField, setShowAddField] = useState(false)
  const [showGroupManager, setShowGroupManager] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Add field state
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState<FieldType>('text')
  const [newFieldGroup, setNewFieldGroup] = useState('')
  const [newFieldRequired, setNewFieldRequired] = useState(false)
  const [isAdding, setIsAdding] = useState(false)

  // Group management state
  const [newGroupLabel, setNewGroupLabel] = useState('')
  const [isAddingGroup, setIsAddingGroup] = useState(false)

  // AI Suggest state
  const [showAiSuggest, setShowAiSuggest] = useState(false)
  const [aiDescription, setAiDescription] = useState('')
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<FieldSuggestionResult | null>(null)
  const [acceptedFields, setAcceptedFields] = useState<Set<string>>(new Set())

  // Confirm dialog state
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null)

  // Delete field state
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  // ── Toggle helpers ────────────────────────────────────────────────────

  const toggleGroupCollapse = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }, [])

  // ── Schema save ───────────────────────────────────────────────────────

  const saveFieldSchema = useCallback(
    async (updatedSchema: Record<string, unknown>) => {
      const res = await fetch(`/api/block-types/${blockTypeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field_schema: updatedSchema }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error?.message ?? `Save failed (${res.status})`)
      }
      router.refresh()
      onSchemaUpdate()
    },
    [blockTypeId, router, onSchemaUpdate]
  )

  // ── Confirmed action wrapper ──────────────────────────────────────────

  const confirmAndExecute = useCallback(
    (action: () => Promise<void>) => {
      setPendingAction(() => action)
      setShowConfirm(true)
    },
    []
  )

  const handleConfirm = useCallback(async () => {
    if (pendingAction) {
      await pendingAction()
    }
    setShowConfirm(false)
    setPendingAction(null)
  }, [pendingAction])

  const handleCancelConfirm = useCallback(() => {
    setShowConfirm(false)
    setPendingAction(null)
  }, [])

  // ── Add field ─────────────────────────────────────────────────────────

  const handleAddField = useCallback(async () => {
    if (!newFieldName.trim()) {
      setError('Field name is required')
      return
    }

    const nameRegex = /^[a-z][a-z0-9_]*$/
    if (!nameRegex.test(newFieldName)) {
      setError('Field name must be lowercase snake_case starting with a letter')
      return
    }

    if (schema.properties[newFieldName]) {
      setError(`Field "${newFieldName}" already exists`)
      return
    }

    const doAdd = async () => {
      setIsAdding(true)
      setError(null)

      try {
        const body: Record<string, unknown> = {
          name: newFieldName,
          field_type: newFieldType,
        }

        const config: Record<string, unknown> = {}
        if (newFieldGroup) {
          config['x-field-group'] = newFieldGroup
        }
        if (Object.keys(config).length > 0) {
          body.config = config
        }
        if (newFieldRequired) {
          body.required = true
        }

        const res = await fetch(`/api/block-types/${blockTypeId}/fields`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(
            data.error?.message ?? `Failed to add field (${res.status})`
          )
        }

        setNewFieldName('')
        setNewFieldType('text')
        setNewFieldGroup('')
        setNewFieldRequired(false)
        setShowAddField(false)
        router.refresh()
        onSchemaUpdate()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add field')
      } finally {
        setIsAdding(false)
      }
    }

    confirmAndExecute(doAdd)
  }, [
    newFieldName,
    newFieldType,
    newFieldGroup,
    newFieldRequired,
    schema.properties,
    blockTypeId,
    router,
    onSchemaUpdate,
    confirmAndExecute,
  ])

  // ── Delete field ──────────────────────────────────────────────────────

  const handleDeleteField = useCallback(
    (fieldName: string) => {
      const doDelete = async () => {
        setIsDeleting(fieldName)
        setError(null)
        try {
          const res = await fetch(
            `/api/block-types/${blockTypeId}/fields/${fieldName}`,
            { method: 'DELETE' }
          )
          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            throw new Error(
              data.error?.message ?? `Failed to delete field (${res.status})`
            )
          }
          router.refresh()
          onSchemaUpdate()
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to delete field')
        } finally {
          setIsDeleting(null)
        }
      }
      confirmAndExecute(doDelete)
    },
    [blockTypeId, router, onSchemaUpdate, confirmAndExecute]
  )

  // ── Add group ─────────────────────────────────────────────────────────

  const handleAddGroup = useCallback(async () => {
    const label = newGroupLabel.trim()
    if (!label) return

    const id = labelToId(label)
    if (fieldGroups.some((g) => g.id === id)) {
      setError(`Group "${id}" already exists`)
      return
    }

    setIsAddingGroup(true)
    setError(null)
    try {
      const existingGroups = (schema['x-field-groups'] ?? []) as FieldGroup[]
      const maxOrder = existingGroups.reduce((max, g) => Math.max(max, g.order), 0)
      const updatedGroups = [...existingGroups, { id, label, order: maxOrder + 1 }]
      await saveFieldSchema({ ...schema, 'x-field-groups': updatedGroups })
      setNewGroupLabel('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add group')
    } finally {
      setIsAddingGroup(false)
    }
  }, [newGroupLabel, fieldGroups, schema, saveFieldSchema])

  // ── AI Suggest ────────────────────────────────────────────────────────

  const handleAiSuggest = useCallback(async () => {
    if (!aiDescription.trim()) {
      setError('Please describe what fields you need')
      return
    }

    setIsAiLoading(true)
    setError(null)
    setAiSuggestions(null)
    setAcceptedFields(new Set())

    try {
      const res = await fetch('/api/block-types/suggest-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: aiDescription,
          block_type_slug: blockTypeSlug,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(
          data.error?.message ?? `AI suggestion failed (${res.status})`
        )
      }

      const data = await res.json()
      const result = (data.data ?? data) as FieldSuggestionResult
      setAiSuggestions(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI suggestion failed')
    } finally {
      setIsAiLoading(false)
    }
  }, [aiDescription, blockTypeSlug])

  const toggleAcceptField = useCallback((fieldName: string) => {
    setAcceptedFields((prev) => {
      const next = new Set(prev)
      if (next.has(fieldName)) next.delete(fieldName)
      else next.add(fieldName)
      return next
    })
  }, [])

  const handleApplyAiSuggestions = useCallback(() => {
    if (!aiSuggestions || acceptedFields.size === 0) return

    const doApply = async () => {
      setIsAdding(true)
      setError(null)
      try {
        // Add accepted fields one at a time
        for (const field of aiSuggestions.suggested_fields) {
          if (!acceptedFields.has(field.name)) continue
          if (schema.properties[field.name]) continue // skip existing

          const body: Record<string, unknown> = {
            name: field.name,
            field_type: field.type,
          }
          const config: Record<string, unknown> = {}
          if (field.group && field.group !== 'general') {
            config['x-field-group'] = field.group
          }
          if (field.description) {
            body.description = field.description
          }
          if (field.required) {
            body.required = true
          }
          if (Object.keys(config).length > 0) {
            body.config = config
          }

          const res = await fetch(`/api/block-types/${blockTypeId}/fields`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            throw new Error(
              data.error?.message ?? `Failed to add field "${field.name}"`
            )
          }
        }

        setAiSuggestions(null)
        setAcceptedFields(new Set())
        setAiDescription('')
        setShowAiSuggest(false)
        router.refresh()
        onSchemaUpdate()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to apply AI suggestions')
      } finally {
        setIsAdding(false)
      }
    }

    confirmAndExecute(doApply)
  }, [
    aiSuggestions,
    acceptedFields,
    schema.properties,
    blockTypeId,
    router,
    onSchemaUpdate,
    confirmAndExecute,
  ])

  // ── Render helpers ────────────────────────────────────────────────────

  const renderFieldRow = (field: FieldEntry) => (
    <li key={field.name} className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors">
      <span
        className="flex h-6 w-6 items-center justify-center rounded bg-muted text-xs font-medium text-muted-foreground flex-shrink-0"
        aria-hidden="true"
      >
        {getFieldTypeIcon(field.fieldType)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-foreground truncate">{field.name}</span>
          {field.isRequired && (
            <span className="text-red-500 text-xs flex-shrink-0" aria-label="Required field">*</span>
          )}
          {field.isSystem && (
            <span
              className="text-muted-foreground flex-shrink-0"
              aria-label="System field (locked)"
              title="System field"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {FIELD_TYPE_DEFINITIONS[field.fieldType].label}
        </span>
      </div>
      {!field.isSystem && (
        <button
          onClick={() => handleDeleteField(field.name)}
          disabled={isDeleting === field.name}
          className="flex-shrink-0 p-1 text-muted-foreground hover:text-red-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          aria-label={`Delete field ${field.name}`}
          title="Delete field"
        >
          {isDeleting === field.name ? (
            <span className="text-xs">...</span>
          ) : (
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
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          )}
        </button>
      )}
    </li>
  )

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <section
      aria-label="Configure Fields"
      className="rounded-lg border bg-background p-4 sm:p-5"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Configure Fields
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {fields.length} field{fields.length !== 1 ? 's' : ''} across{' '}
            {fieldGroups.length} group{fieldGroups.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowGroupManager(!showGroupManager)
              setShowAddField(false)
              setShowAiSuggest(false)
            }}
            aria-label="Manage field groups"
          >
            {showGroupManager ? 'Hide Groups' : 'Manage Groups'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowAddField(!showAddField)
              setShowGroupManager(false)
              setShowAiSuggest(false)
            }}
            aria-label="Add a new field"
          >
            {showAddField ? 'Cancel' : 'Add Field'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowAiSuggest(!showAiSuggest)
              setShowAddField(false)
              setShowGroupManager(false)
            }}
            aria-label="AI field suggestions"
          >
            {showAiSuggest ? 'Cancel' : 'AI Suggest'}
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 font-medium underline hover:no-underline"
            aria-label="Dismiss error"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Confirmation dialog */}
      {showConfirm && (
        <div
          className="mb-4 rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 px-4 py-3"
          role="alertdialog"
          aria-label="Confirm field change"
        >
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">
            This changes the field configuration for all {blockTypeName} blocks.
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
            Are you sure you want to proceed?
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleConfirm}>
              Confirm
            </Button>
            <Button variant="outline" size="sm" onClick={handleCancelConfirm}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Add Field panel */}
      {showAddField && (
        <div className="mb-4 rounded-lg border bg-muted p-4">
          <h3 className="text-sm font-medium text-foreground mb-3">
            New Field
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label
                htmlFor="inline-new-field-name"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                Field Name (snake_case)
              </label>
              <Input
                id="inline-new-field-name"
                type="text"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                placeholder="e.g. phone_number"
                className="text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="inline-new-field-type"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                Type
              </label>
              <select
                id="inline-new-field-type"
                value={newFieldType}
                onChange={(e) => setNewFieldType(e.target.value as FieldType)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {FIELD_TYPES.map((ft) => (
                  <option key={ft} value={ft}>
                    {FIELD_TYPE_DEFINITIONS[ft].label}
                  </option>
                ))}
              </select>
            </div>
            {hasMultipleGroups && (
              <div>
                <label
                  htmlFor="inline-new-field-group"
                  className="block text-xs font-medium text-muted-foreground mb-1"
                >
                  Group
                </label>
                <select
                  id="inline-new-field-group"
                  value={newFieldGroup}
                  onChange={(e) => setNewFieldGroup(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">General (default)</option>
                  {fieldGroups
                    .filter((g) => g.id !== 'general')
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <div className="flex flex-col justify-end gap-2">
              <label
                htmlFor="inline-new-field-required"
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <input
                  id="inline-new-field-required"
                  type="checkbox"
                  checked={newFieldRequired}
                  onChange={(e) => setNewFieldRequired(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-ring"
                />
                <span className="text-xs text-muted-foreground">Required</span>
              </label>
              <Button
                size="sm"
                onClick={handleAddField}
                disabled={isAdding || !newFieldName.trim()}
              >
                {isAdding ? 'Adding...' : 'Add Field'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Group Manager panel */}
      {showGroupManager && (
        <div className="mb-4 rounded-lg border bg-muted p-4">
          <h3 className="text-sm font-medium text-foreground mb-2">
            Field Groups
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Organize fields into collapsible sections on the block detail page.
          </p>
          <ul className="space-y-2 mb-3" aria-label="Current field groups">
            {fieldGroups.map((group) => (
              <li key={group.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 text-foreground">
                  {group.label}
                  {group.id === 'general' && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      (default)
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {fieldsByGroup.get(group.id)?.length ?? 0} fields
                </span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Input
              type="text"
              value={newGroupLabel}
              onChange={(e) => setNewGroupLabel(e.target.value)}
              placeholder="New group name"
              className="h-8 text-sm flex-1"
              aria-label="New group name"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddGroup()
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={handleAddGroup}
              disabled={isAddingGroup || !newGroupLabel.trim()}
            >
              {isAddingGroup ? '...' : 'Add Group'}
            </Button>
          </div>
        </div>
      )}

      {/* AI Suggest panel */}
      {showAiSuggest && (
        <div className="mb-4 rounded-lg border bg-muted p-4">
          <h3 className="text-sm font-medium text-foreground mb-2">
            AI Field Suggestions
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Describe what fields you need and AI will suggest appropriate fields
            for this {blockTypeName} block type.
          </p>

          {/* Description input */}
          {!aiSuggestions && (
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <Input
                type="text"
                value={aiDescription}
                onChange={(e) => setAiDescription(e.target.value)}
                placeholder="e.g. I need fields for tracking financial compliance data"
                className="flex-1 text-sm"
                aria-label="Describe what fields you need"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isAiLoading) handleAiSuggest()
                }}
                disabled={isAiLoading}
              />
              <Button
                size="sm"
                onClick={handleAiSuggest}
                disabled={isAiLoading || !aiDescription.trim()}
              >
                {isAiLoading ? 'Thinking...' : 'Suggest'}
              </Button>
            </div>
          )}

          {/* Loading state */}
          {isAiLoading && (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground" role="status" aria-label="Loading AI suggestions">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" aria-hidden="true" />
              Generating field suggestions...
            </div>
          )}

          {/* Suggestions list */}
          {aiSuggestions && aiSuggestions.suggested_fields.length > 0 && (
            <div>
              {aiSuggestions.reasoning && (
                <p className="text-xs text-muted-foreground mb-3 italic">
                  {aiSuggestions.reasoning}
                </p>
              )}
              <ul className="space-y-2 mb-3" aria-label="Suggested fields">
                {aiSuggestions.suggested_fields.map((field) => {
                  const alreadyExists = !!schema.properties[field.name]
                  const isAccepted = acceptedFields.has(field.name)
                  return (
                    <li
                      key={field.name}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm border transition-colors',
                        alreadyExists
                          ? 'opacity-50 border-border'
                          : isAccepted
                            ? 'bg-primary/5 border-primary/20'
                            : 'border-border hover:bg-muted/50'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isAccepted}
                        disabled={alreadyExists}
                        onChange={() => toggleAcceptField(field.name)}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-ring"
                        aria-label={`Accept field ${field.name}`}
                      />
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded bg-muted text-xs font-medium text-muted-foreground flex-shrink-0"
                        aria-hidden="true"
                      >
                        {getFieldTypeIcon(field.type)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground">
                            {field.name}
                          </span>
                          {field.required && (
                            <span className="text-red-500 text-xs">*</span>
                          )}
                          {alreadyExists && (
                            <span className="text-xs text-muted-foreground">
                              (exists)
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {FIELD_TYPE_DEFINITIONS[field.type]?.label ?? field.type}
                          {field.description ? ` — ${field.description}` : ''}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleApplyAiSuggestions}
                  disabled={acceptedFields.size === 0 || isAdding}
                >
                  {isAdding
                    ? 'Applying...'
                    : `Apply ${acceptedFields.size} field${acceptedFields.size !== 1 ? 's' : ''}`}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAiSuggestions(null)
                    setAcceptedFields(new Set())
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>
          )}

          {/* Empty suggestions */}
          {aiSuggestions && aiSuggestions.suggested_fields.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              No field suggestions generated. Try a more specific description.
            </p>
          )}
        </div>
      )}

      {/* Grouped field list */}
      {fields.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm font-medium text-foreground mb-1">
            No fields configured
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            Add your first field to start defining the structure of this block
            type.
          </p>
          {!showAddField && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddField(true)}
            >
              Add Field
            </Button>
          )}
        </div>
      ) : hasMultipleGroups ? (
        <nav aria-label="Fields by group">
          <div className="space-y-3">
            {fieldGroups.map((group) => {
              const groupFields = fieldsByGroup.get(group.id) ?? []
              if (groupFields.length === 0) return null
              const isCollapsed = collapsedGroups.has(group.id)
              return (
                <div key={group.id}>
                  <button
                    onClick={() => toggleGroupCollapse(group.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                    aria-expanded={!isCollapsed}
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={cn(
                        'transition-transform flex-shrink-0',
                        isCollapsed ? '' : 'rotate-90'
                      )}
                      aria-hidden="true"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    <span className="truncate">{group.label}</span>
                    <span className="ml-auto text-muted-foreground font-normal">
                      {groupFields.length}
                    </span>
                  </button>
                  {!isCollapsed && (
                    <ul className="space-y-0.5 mt-1">{groupFields.map(renderFieldRow)}</ul>
                  )}
                </div>
              )
            })}
          </div>
        </nav>
      ) : (
        <nav aria-label="Field list">
          <ul className="space-y-0.5">{fields.map(renderFieldRow)}</ul>
        </nav>
      )}
    </section>
  )
}
