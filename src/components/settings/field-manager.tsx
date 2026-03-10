'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  FIELD_TYPES,
  FIELD_TYPE_DEFINITIONS,
  inferFieldType,
  type FieldType,
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

export function FieldManager({
  blockTypeId,
  blockTypeName,
  fieldSchema,
  requiredFields,
  allBlockTypes,
}: FieldManagerProps) {
  const router = useRouter()

  // Parse fields from schema, sorted by display order
  const fields: FieldEntry[] = Object.entries(fieldSchema.properties)
    .map(([name, prop]) => ({
      name,
      fieldType: inferFieldType(prop),
      property: prop,
      order: (prop['x-display-order'] as number) ?? 0,
      isSystem: !!(prop['x-is-system'] as boolean),
      isRequired: requiredFields.includes(name),
    }))
    .sort((a, b) => a.order - b.order)

  const [selectedField, setSelectedField] = useState<string | null>(
    fields.length > 0 ? fields[0].name : null
  )
  const [showAddForm, setShowAddForm] = useState(false)
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState<FieldType>('text')
  const [isAdding, setIsAdding] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

      // Add relation target config if applicable
      if (newFieldType === 'relation') {
        const firstNonSelf = allBlockTypes.find(
          (t) => t.type_name !== blockTypeName
        )
        if (firstNonSelf) {
          body.config = { 'x-relation-target': firstNonSelf.type_name }
        }
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
      setShowAddForm(false)
      setSelectedField(newFieldName)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add field')
    } finally {
      setIsAdding(false)
    }
  }, [newFieldName, newFieldType, blockTypeId, blockTypeName, allBlockTypes, router])

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
        setError(err instanceof Error ? err.message : 'Failed to delete field')
      } finally {
        setIsDeleting(null)
      }
    },
    [blockTypeId, selectedField, router]
  )

  const selectedFieldEntry = fields.find((f) => f.name === selectedField)

  return (
    <div>
      {error && (
        <div
          className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
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
        <h2 className="text-lg font-medium text-gray-900">
          Fields ({fields.length})
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? 'Cancel' : 'Add Field'}
        </Button>
      </div>

      {/* Add field form */}
      {showAddForm && (
        <div className="mb-6 rounded-lg border bg-gray-50 p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">
            New Field
          </h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label
                htmlFor="new-field-name"
                className="block text-xs font-medium text-gray-600 mb-1"
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
                className="block text-xs font-medium text-gray-600 mb-1"
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
          <p className="text-lg font-medium text-gray-900 mb-1">
            No fields configured
          </p>
          <p className="text-sm text-gray-500 mb-4">
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
              <ul className="space-y-1">
                {fields.map((field) => (
                  <li key={field.name}>
                    <button
                      onClick={() => setSelectedField(field.name)}
                      className={cn(
                        'w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        selectedField === field.name
                          ? 'bg-gray-100 text-gray-900'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      )}
                      aria-current={
                        selectedField === field.name ? 'true' : undefined
                      }
                    >
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded bg-gray-200 text-xs font-medium text-gray-600 flex-shrink-0"
                        aria-hidden="true"
                      >
                        {getFieldTypeIcon(field.fieldType)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium truncate">
                            {field.name}
                          </span>
                          {field.isSystem && (
                            <span
                              className="text-gray-400 flex-shrink-0"
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
                                <rect
                                  x="3"
                                  y="11"
                                  width="18"
                                  height="11"
                                  rx="2"
                                  ry="2"
                                />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                              </svg>
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">
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
                          className="flex-shrink-0 p-1 text-gray-300 hover:text-red-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
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
                ))}
              </ul>
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
              />
            ) : (
              <div className="flex items-center justify-center py-12 text-center text-sm text-gray-400 border rounded-lg border-dashed">
                Select a field from the list to view its configuration.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
