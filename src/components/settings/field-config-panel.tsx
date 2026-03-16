'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FIELD_TYPE_DEFINITIONS, type FieldType } from '@/lib/block-types/field-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface FieldConfigPanelProps {
  blockTypeId: string
  blockTypeName: string
  fieldName: string
  fieldType: FieldType
  property: Record<string, unknown>
  isSystem: boolean
  isRequired: boolean
  allBlockTypes: Array<{ type_name: string; display_name: string }>
  /** Available field groups for the block type */
  fieldGroups?: Array<{ id: string; label: string }>
}

const CURRENCY_CODES = ['AUD', 'USD', 'GBP', 'EUR', 'SGD', 'HKD', 'NZD', 'JPY', 'CAD', 'CHF']

export function FieldConfigPanel({
  blockTypeId,
  blockTypeName,
  fieldName,
  fieldType,
  property,
  isSystem,
  isRequired,
  allBlockTypes,
  fieldGroups = [],
}: FieldConfigPanelProps) {
  const router = useRouter()
  const typeDef = FIELD_TYPE_DEFINITIONS[fieldType]

  // Local form state, re-initialised when the selected field changes
  const [description, setDescription] = useState(
    (property.description as string) ?? ''
  )
  const [placeholder, setPlaceholder] = useState(
    (property['x-placeholder'] as string) ?? ''
  )
  const [required, setRequired] = useState(isRequired)
  const [enumValues, setEnumValues] = useState(() => {
    if (fieldType === 'select') {
      return ((property.enum as string[]) ?? []).join(', ')
    }
    if (fieldType === 'multi-select') {
      const items = property.items as Record<string, unknown> | undefined
      return ((items?.enum as string[]) ?? []).join(', ')
    }
    return ''
  })
  const [relationTarget, setRelationTarget] = useState(
    (property['x-relation-target'] as string) ?? ''
  )
  const [currencyCode, setCurrencyCode] = useState(
    (property['x-currency-code'] as string) ?? 'AUD'
  )
  const [fieldGroup, setFieldGroup] = useState(
    (property['x-field-group'] as string) ?? ''
  )
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>(
    'idle'
  )
  const [error, setError] = useState<string | null>(null)

  // Reset form state when field selection changes
  useEffect(() => {
    setDescription((property.description as string) ?? '')
    setPlaceholder((property['x-placeholder'] as string) ?? '')
    setRequired(isRequired)
    setSaveStatus('idle')
    setError(null)

    if (fieldType === 'select') {
      setEnumValues(((property.enum as string[]) ?? []).join(', '))
    } else if (fieldType === 'multi-select') {
      const items = property.items as Record<string, unknown> | undefined
      setEnumValues(((items?.enum as string[]) ?? []).join(', '))
    } else {
      setEnumValues('')
    }

    setRelationTarget((property['x-relation-target'] as string) ?? '')
    setCurrencyCode((property['x-currency-code'] as string) ?? 'AUD')
    setFieldGroup((property['x-field-group'] as string) ?? '')
  }, [fieldName, fieldType, property, isRequired])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    setError(null)
    setSaveStatus('idle')

    try {
      const body: Record<string, unknown> = {
        description: description || undefined,
        placeholder: placeholder || undefined,
        required,
      }

      // Build type-specific config
      const config: Record<string, unknown> = {}

      if (fieldType === 'select') {
        const values = enumValues
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean)
        config.enum = values
      }

      if (fieldType === 'multi-select') {
        const values = enumValues
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean)
        config.items = { type: 'string', enum: values }
      }

      if (fieldType === 'relation' && relationTarget) {
        config['x-relation-target'] = relationTarget
      }

      if (fieldType === 'currency' && currencyCode) {
        config['x-currency-code'] = currencyCode
      }

      if (fieldGroup) {
        config['x-field-group'] = fieldGroup
      }

      if (Object.keys(config).length > 0) {
        body.config = config
      }

      const res = await fetch(
        `/api/block-types/${blockTypeId}/fields/${fieldName}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      )

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(
          data.error?.message ?? `Save failed (${res.status})`
        )
      }

      setSaveStatus('saved')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setSaveStatus('error')
    } finally {
      setIsSaving(false)
    }
  }, [
    blockTypeId,
    fieldName,
    fieldType,
    description,
    placeholder,
    required,
    enumValues,
    relationTarget,
    currencyCode,
    fieldGroup,
    router,
  ])

  /** Map field type icon name to a simple display string. */
  function getFieldTypeIcon(ft: FieldType): string {
    const def = FIELD_TYPE_DEFINITIONS[ft]
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

  return (
    <div className="rounded-lg border p-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b">
        <span
          className="flex h-9 w-9 items-center justify-center rounded bg-muted text-sm font-medium text-muted-foreground"
          aria-hidden="true"
        >
          {getFieldTypeIcon(fieldType)}
        </span>
        <div>
          <h3 className="text-base font-semibold text-foreground">
            {fieldName}
          </h3>
          <p className="text-xs text-muted-foreground">{typeDef.label} field</p>
        </div>
        {isSystem && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
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
            System field (read-only)
          </span>
        )}
      </div>

      {isSystem && (
        <p className="text-sm text-muted-foreground mb-6">
          System fields cannot be modified. They are managed automatically by
          Ops OS.
        </p>
      )}

      {error && (
        <div
          className="mb-4 rounded-md bg-destructive/5 border border-destructive/20 px-4 py-3 text-[13px] text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}

      {saveStatus === 'saved' && (
        <div
          className="mb-4 rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700"
          role="status"
        >
          Field updated successfully.
        </div>
      )}

      <fieldset disabled={isSystem} className="space-y-5">
        {/* Description */}
        <div>
          <label
            htmlFor={`field-description-${fieldName}`}
            className="block text-sm font-medium text-foreground mb-1"
          >
            Description
          </label>
          <Input
            id={`field-description-${fieldName}`}
            type="text"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              setSaveStatus('idle')
            }}
            placeholder="Human-readable description of this field"
            className="text-sm"
          />
        </div>

        {/* Required toggle */}
        <div className="flex items-center gap-3">
          <input
            id={`field-required-${fieldName}`}
            type="checkbox"
            checked={required}
            onChange={(e) => {
              setRequired(e.target.checked)
              setSaveStatus('idle')
            }}
            className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-ring"
          />
          <label
            htmlFor={`field-required-${fieldName}`}
            className="text-sm font-medium text-foreground"
          >
            Required field
          </label>
        </div>

        {/* Placeholder */}
        <div>
          <label
            htmlFor={`field-placeholder-${fieldName}`}
            className="block text-sm font-medium text-foreground mb-1"
          >
            Placeholder
          </label>
          <Input
            id={`field-placeholder-${fieldName}`}
            type="text"
            value={placeholder}
            onChange={(e) => {
              setPlaceholder(e.target.value)
              setSaveStatus('idle')
            }}
            placeholder="Placeholder text shown in empty input"
            className="text-sm"
          />
        </div>

        {/* Field Group assignment */}
        {fieldGroups.length > 0 && (
          <div>
            <label
              htmlFor={`field-group-${fieldName}`}
              className="block text-sm font-medium text-foreground mb-1"
            >
              Field Group
            </label>
            <select
              id={`field-group-${fieldName}`}
              value={fieldGroup}
              onChange={(e) => {
                setFieldGroup(e.target.value)
                setSaveStatus('idle')
              }}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">General (default)</option>
              {fieldGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Group this field under a section on the block detail page.
            </p>
          </div>
        )}

        {/* Type-specific config: Select / Multi-Select enum values */}
        {(fieldType === 'select' || fieldType === 'multi-select') && (
          <div>
            <label
              htmlFor={`field-enum-${fieldName}`}
              className="block text-sm font-medium text-foreground mb-1"
            >
              Options (comma-separated)
            </label>
            <Input
              id={`field-enum-${fieldName}`}
              type="text"
              value={enumValues}
              onChange={(e) => {
                setEnumValues(e.target.value)
                setSaveStatus('idle')
              }}
              placeholder="option_a, option_b, option_c"
              className="text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Enter each option separated by a comma.
            </p>
          </div>
        )}

        {/* Type-specific config: Relation target */}
        {fieldType === 'relation' && (
          <div>
            <label
              htmlFor={`field-relation-target-${fieldName}`}
              className="block text-sm font-medium text-foreground mb-1"
            >
              Relation Target Type
            </label>
            <select
              id={`field-relation-target-${fieldName}`}
              value={relationTarget}
              onChange={(e) => {
                setRelationTarget(e.target.value)
                setSaveStatus('idle')
              }}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Select a block type...</option>
              {allBlockTypes
                .filter((t) => t.type_name !== blockTypeName)
                .map((t) => (
                  <option key={t.type_name} value={t.type_name}>
                    {t.display_name}
                  </option>
                ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              The block type that this relation field points to.
            </p>
          </div>
        )}

        {/* Type-specific config: Currency code */}
        {fieldType === 'currency' && (
          <div>
            <label
              htmlFor={`field-currency-${fieldName}`}
              className="block text-sm font-medium text-foreground mb-1"
            >
              Currency Code (ISO 4217)
            </label>
            <select
              id={`field-currency-${fieldName}`}
              value={currencyCode}
              onChange={(e) => {
                setCurrencyCode(e.target.value)
                setSaveStatus('idle')
              }}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {CURRENCY_CODES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Save button */}
        {!isSystem && (
          <div className="pt-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        )}
      </fieldset>
    </div>
  )
}
