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
import { FieldConfigPanel } from '@/components/settings/field-config-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface FieldManagerProps {
  blockTypeId: string
  blockTypeName: string
  fieldSchema: {
    type: string
    properties: Record<string, Record<string, unknown>>
    required?: string[]
    'x-field-groups'?: FieldGroup[]
  }
  requiredFields: string[]
  allBlockTypes: Array<{ type_name: string; display_name: string }>
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

/** Map field type icon names to simple text symbols for display. */
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

/** Convert a label to snake_case ID */
function labelToId(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export function FieldManager({
  blockTypeId,
  blockTypeName,
  fieldSchema,
  requiredFields,
  allBlockTypes,
}: FieldManagerProps) {
  const router = useRouter()

  // Extract groups from schema
  const fieldGroups = useMemo(
    () => getFieldGroups(fieldSchema as Record<string, unknown>),
    [fieldSchema]
  )

  // Parse fields from schema, sorted by display order, with group info
  const fields: FieldEntry[] = useMemo(
    () =>
      Object.entries(fieldSchema.properties)
        .map(([name, prop]) => ({
          name,
          fieldType: inferFieldType(prop),
          property: prop,
          order: (prop['x-display-order'] as number) ?? 0,
          isSystem: !!(prop['x-is-system'] as boolean),
          isRequired: requiredFields.includes(name),
          group: (prop['x-field-group'] as string) || 'general',
        }))
        .sort((a, b) => a.order - b.order),
    [fieldSchema.properties, requiredFields]
  )

  // Group fields by their group ID
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

  const [selectedField, setSelectedField] = useState<string | null>(
    fields.length > 0 ? fields[0].name : null
  )
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set()
  )
  const [showAddForm, setShowAddForm] = useState(false)
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState<FieldType>('text')
  const [newFieldGroup, setNewFieldGroup] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Group management state
  const [showGroupManager, setShowGroupManager] = useState(false)
  const [newGroupLabel, setNewGroupLabel] = useState('')
  const [isAddingGroup, setIsAddingGroup] = useState(false)
  const [isDeletingGroup, setIsDeletingGroup] = useState<string | null>(null)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editingGroupLabel, setEditingGroupLabel] = useState('')

  const toggleGroupCollapse = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }, [])

  // Save updated field_schema to the block type
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
    },
    [blockTypeId, router]
  )

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
      const existingGroups = (fieldSchema['x-field-groups'] ?? []) as FieldGroup[]
      const maxOrder = existingGroups.reduce(
        (max, g) => Math.max(max, g.order),
        0
      )
      const updatedGroups = [...existingGroups, { id, label, order: maxOrder + 1 }]
      await saveFieldSchema({ ...fieldSchema, 'x-field-groups': updatedGroups })
      setNewGroupLabel('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add group')
    } finally {
      setIsAddingGroup(false)
    }
  }, [newGroupLabel, fieldGroups, fieldSchema, saveFieldSchema])

  const handleRenameGroup = useCallback(
    async (groupId: string, newLabel: string) => {
      if (!newLabel.trim()) return
      setError(null)
      try {
        const existingGroups = (fieldSchema['x-field-groups'] ?? []) as FieldGroup[]
        const updatedGroups = existingGroups.map((g) =>
          g.id === groupId ? { ...g, label: newLabel.trim() } : g
        )
        await saveFieldSchema({
          ...fieldSchema,
          'x-field-groups': updatedGroups,
        })
        setEditingGroupId(null)
        setEditingGroupLabel('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to rename group')
      }
    },
    [fieldSchema, saveFieldSchema]
  )

  const handleDeleteGroup = useCallback(
    async (groupId: string) => {
      if (groupId === 'general') return
      setIsDeletingGroup(groupId)
      setError(null)
      try {
        const existingGroups = (fieldSchema['x-field-groups'] ?? []) as FieldGroup[]
        const updatedGroups = existingGroups.filter((g) => g.id !== groupId)
        // Move fields from deleted group to General (remove x-field-group)
        const updatedProperties: Record<string, Record<string, unknown>> = {}
        for (const [name, prop] of Object.entries(fieldSchema.properties)) {
          if ((prop['x-field-group'] as string) === groupId) {
            const { 'x-field-group': _, ...rest } = prop
            updatedProperties[name] = rest
          } else {
            updatedProperties[name] = prop
          }
        }
        await saveFieldSchema({
          ...fieldSchema,
          properties: updatedProperties,
          'x-field-groups': updatedGroups,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete group')
      } finally {
        setIsDeletingGroup(null)
      }
    },
    [fieldSchema, saveFieldSchema]
  )

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

    setIsAdding(true)
    setError(null)

    try {
      const body: Record<string, unknown> = {
        name: newFieldName,
        field_type: newFieldType,
      }

      const config: Record<string, unknown> = {}

      // Add relation target config if applicable
      if (newFieldType === 'relation') {
        const firstNonSelf = allBlockTypes.find(
          (t) => t.type_name !== blockTypeName
        )
        if (firstNonSelf) {
          config['x-relation-target'] = firstNonSelf.type_name
        }
      }

      // Add field group assignment
      if (newFieldGroup) {
        config['x-field-group'] = newFieldGroup
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
          data.error?.message ?? `Failed to add field (${res.status})`
        )
      }

      setNewFieldName('')
      setNewFieldType('text')
      setNewFieldGroup('')
      setShowAddForm(false)
      setSelectedField(newFieldName)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add field')
    } finally {
      setIsAdding(false)
    }
  }, [
    newFieldName,
    newFieldType,
    newFieldGroup,
    blockTypeId,
    blockTypeName,
    allBlockTypes,
    router,
  ])

  const handleDeleteField = useCallback(
    async (fieldName: string) => {
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

        if (selectedField === fieldName) {
          setSelectedField(null)
        }
        router.refresh()
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to delete field'
        )
      } finally {
        setIsDeleting(null)
      }
    },
    [blockTypeId, selectedField, router]
  )

  const selectedFieldEntry = fields.find((f) => f.name === selectedField)

  /** Render a single field row in the left panel */
  const renderFieldRow = (field: FieldEntry) => (
    <li key={field.name}>
      <button
        onClick={() => setSelectedField(field.name)}
        className={cn(
          'w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          selectedField === field.name
            ? 'bg-muted text-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
        aria-current={selectedField === field.name ? 'true' : undefined}
      >
        <span
          className="flex h-7 w-7 items-center justify-center rounded bg-muted text-xs font-medium text-muted-foreground flex-shrink-0"
          aria-hidden="true"
        >
          {getFieldTypeIcon(field.fieldType)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-medium truncate">{field.name}</span>
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
            onClick={(e) => {
              e.stopPropagation()
              handleDeleteField(field.name)
            }}
            disabled={isDeleting === field.name}
            className="flex-shrink-0 p-1 text-muted-foreground hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
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
      </button>
    </li>
  )

  return (
    <div>
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

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-foreground">
          Fields ({fields.length})
        </h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowGroupManager(!showGroupManager)}
          >
            {showGroupManager ? 'Hide Groups' : 'Manage Groups'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? 'Cancel' : 'Add Field'}
          </Button>
        </div>
      </div>

      {/* Group management panel */}
      {showGroupManager && (
        <div className="mb-6 rounded-lg border bg-muted p-4">
          <h3 className="text-sm font-medium text-foreground mb-3">
            Field Groups
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Organize fields into collapsible sections on the block detail page.
          </p>
          {/* Existing groups */}
          <ul className="space-y-2 mb-3">
            {fieldGroups.map((group) => (
              <li key={group.id} className="flex items-center gap-2 text-sm">
                {editingGroupId === group.id ? (
                  <>
                    <Input
                      type="text"
                      value={editingGroupLabel}
                      onChange={(e) => setEditingGroupLabel(e.target.value)}
                      className="h-7 text-sm flex-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter')
                          handleRenameGroup(group.id, editingGroupLabel)
                        if (e.key === 'Escape') {
                          setEditingGroupId(null)
                          setEditingGroupLabel('')
                        }
                      }}
                      autoFocus
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() =>
                        handleRenameGroup(group.id, editingGroupLabel)
                      }
                    >
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        setEditingGroupId(null)
                        setEditingGroupLabel('')
                      }}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
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
                    {group.id !== 'general' && (
                      <>
                        <button
                          onClick={() => {
                            setEditingGroupId(group.id)
                            setEditingGroupLabel(group.label)
                          }}
                          className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
                          aria-label={`Rename group ${group.label}`}
                          title="Rename"
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
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(group.id)}
                          disabled={isDeletingGroup === group.id}
                          className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors"
                          aria-label={`Delete group ${group.label}`}
                          title="Delete group (moves fields to General)"
                        >
                          {isDeletingGroup === group.id ? (
                            <span className="text-xs">...</span>
                          ) : (
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
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          )}
                        </button>
                      </>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
          {/* Add new group */}
          <div className="flex gap-2">
            <Input
              type="text"
              value={newGroupLabel}
              onChange={(e) => setNewGroupLabel(e.target.value)}
              placeholder="New group name"
              className="h-8 text-sm flex-1"
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

      {/* Add field form */}
      {showAddForm && (
        <div className="mb-6 rounded-lg border bg-muted p-4">
          <h3 className="text-sm font-medium text-foreground mb-3">
            New Field
          </h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label
                htmlFor="new-field-name"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                Field Name (snake_case)
              </label>
              <Input
                id="new-field-name"
                type="text"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                placeholder="e.g. phone_number"
                className="text-sm"
              />
            </div>
            <div className="sm:w-48">
              <label
                htmlFor="new-field-type"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                Field Type
              </label>
              <select
                id="new-field-type"
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
              <div className="sm:w-44">
                <label
                  htmlFor="new-field-group"
                  className="block text-xs font-medium text-muted-foreground mb-1"
                >
                  Group
                </label>
                <select
                  id="new-field-group"
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
            <div className="flex items-end">
              <Button
                size="sm"
                onClick={handleAddField}
                disabled={isAdding || !newFieldName.trim()}
              >
                {isAdding ? 'Adding...' : 'Add'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Field list + config panel layout */}
      {fields.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-lg font-medium text-foreground mb-1">
            No fields configured
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Add your first field to start defining the structure of this block
            type.
          </p>
          {!showAddForm && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddForm(true)}
            >
              Add Field
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left panel: field list */}
          <div className="w-full lg:w-72 lg:flex-shrink-0">
            <nav aria-label="Field list">
              {hasMultipleGroups ? (
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
                          <ul className="space-y-1 mt-1">
                            {groupFields.map(renderFieldRow)}
                          </ul>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <ul className="space-y-1">
                  {fields.map(renderFieldRow)}
                </ul>
              )}
            </nav>
          </div>

          {/* Right panel: field config */}
          <div className="flex-1 min-w-0">
            {selectedFieldEntry ? (
              <FieldConfigPanel
                blockTypeId={blockTypeId}
                blockTypeName={blockTypeName}
                fieldName={selectedFieldEntry.name}
                fieldType={selectedFieldEntry.fieldType}
                property={selectedFieldEntry.property}
                isSystem={selectedFieldEntry.isSystem}
                isRequired={selectedFieldEntry.isRequired}
                allBlockTypes={allBlockTypes}
                fieldGroups={fieldGroups
                  .filter((g) => g.id !== 'general')
                  .map((g) => ({ id: g.id, label: g.label }))}
              />
            ) : (
              <div className="flex items-center justify-center py-12 text-center text-sm text-muted-foreground border rounded-lg border-dashed">
                Select a field from the list to view its configuration.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
