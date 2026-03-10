'use client'

import { cn } from '@/lib/utils'
import { inferFieldType, type FieldType } from '@/lib/block-types/field-types'
import { DateField } from './fields/date-field'
import { MultiSelectField } from './fields/multi-select-field'
import { CurrencyField } from './fields/currency-field'
import { UrlField } from './fields/url-field'
import { PhoneField } from './fields/phone-field'
import { RichTextField } from './fields/rich-text-field'
import { RelationField } from './fields/relation-field'
import type { FieldComponentProps } from './fields/field-props'

interface DynamicFieldRendererProps {
  /** JSON Schema field_schema from block_type_definitions */
  fieldSchema: {
    type?: string
    properties?: Record<string, Record<string, unknown>>
    required?: string[]
  }
  /** Current values keyed by field name */
  values: Record<string, unknown>
  /** Called when a field value changes (required when readOnly is false) */
  onChange?: (field: string, value: unknown) => void
  /** If true, render as read-only display instead of inputs */
  readOnly?: boolean
}

/**
 * DynamicFieldRenderer V2 — dispatches to per-type field components.
 * Supports 12 field types via x-field-type extensions and type inference.
 */
export function DynamicFieldRenderer({
  fieldSchema,
  values,
  onChange,
  readOnly = false,
}: DynamicFieldRendererProps) {
  const properties = fieldSchema.properties ?? {}
  const requiredSet = new Set(fieldSchema.required ?? [])

  // Sort by x-display-order, then by property name as fallback
  const fields = Object.entries(properties).sort((a, b) => {
    const orderA = (a[1]['x-display-order'] as number) ?? 999
    const orderB = (b[1]['x-display-order'] as number) ?? 999
    if (orderA !== orderB) return orderA - orderB
    return a[0].localeCompare(b[0])
  })

  if (fields.length === 0) return null

  const mode = readOnly ? 'view' : 'edit'

  if (readOnly) {
    return (
      <dl className="divide-y divide-border rounded-lg border text-sm">
        {fields.map(([name, def]) => (
          <div key={name} className="flex gap-4 px-4 py-2.5">
            <dt className="w-36 shrink-0 font-medium text-muted-foreground capitalize">
              {(def.description as string) ?? name.replace(/_/g, ' ')}
            </dt>
            <dd className="flex-1 text-foreground break-words">
              <FieldDispatcher
                name={name}
                value={values[name]}
                onChange={() => {}}
                fieldDef={def}
                mode={mode}
                required={requiredSet.has(name)}
              />
            </dd>
          </div>
        ))}
      </dl>
    )
  }

  return (
    <div className="space-y-3">
      {fields.map(([name, def]) => (
        <FieldDispatcher
          key={name}
          name={name}
          value={values[name]}
          onChange={(v) => onChange?.(name, v)}
          fieldDef={def}
          mode={mode}
          required={requiredSet.has(name)}
        />
      ))}
    </div>
  )
}

/** Dispatches to the correct field component based on inferred type */
function FieldDispatcher(props: FieldComponentProps) {
  const fieldType = inferFieldType(props.fieldDef)

  switch (fieldType) {
    case 'date':
      return <DateField {...props} />
    case 'multi-select':
      return <MultiSelectField {...props} />
    case 'currency':
      return <CurrencyField {...props} />
    case 'url':
      return <UrlField {...props} />
    case 'phone':
      return <PhoneField {...props} />
    case 'rich-text':
      return <RichTextField {...props} />
    case 'relation':
      return <RelationField {...props} />
    default:
      return <DefaultField {...props} fieldType={fieldType} />
  }
}

/** Handles text, email, number, boolean, select — the original field types */
function DefaultField({
  name,
  value,
  onChange,
  fieldDef,
  mode,
  required,
  fieldType,
}: FieldComponentProps & { fieldType: FieldType }) {
  const label = (fieldDef.description as string) ?? name.replace(/_/g, ' ')
  const id = `field-${name}`
  const placeholder = (fieldDef['x-placeholder'] as string) ?? (fieldDef.description as string) ?? ''

  const inputClass = cn(
    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
    'focus:outline-none focus:ring-2 focus:ring-ring'
  )

  // ─── View mode ──────────────────────────────────────────────────────────
  if (mode === 'view') {
    return <span className="text-sm text-foreground">{formatValue(value)}</span>
  }

  // ─── Select (enum) ──────────────────────────────────────────────────────
  if (fieldType === 'select' || (fieldDef.enum && (fieldDef.enum as string[]).length > 0)) {
    const enumValues = (fieldDef.enum as string[]) ?? []
    return (
      <div>
        <label htmlFor={id} className="block text-sm font-medium text-muted-foreground mb-1 capitalize">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <select
          id={id}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={cn(inputClass, 'capitalize')}
        >
          <option value="">Select…</option>
          {enumValues.map((opt) => (
            <option key={opt} value={opt} className="capitalize">
              {opt.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>
    )
  }

  // ─── Boolean ────────────────────────────────────────────────────────────
  if (fieldType === 'boolean') {
    return (
      <label htmlFor={id} className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="rounded border-input text-primary focus:ring-ring"
        />
        <span className="font-medium text-muted-foreground capitalize">{label}</span>
      </label>
    )
  }

  // ─── Number ─────────────────────────────────────────────────────────────
  if (fieldType === 'number') {
    return (
      <div>
        <label htmlFor={id} className="block text-sm font-medium text-muted-foreground mb-1 capitalize">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <input
          id={id}
          type="number"
          value={value != null ? String(value) : ''}
          min={fieldDef.minimum as number | undefined}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
          placeholder={placeholder}
          className={inputClass}
        />
      </div>
    )
  }

  // ─── Text / Email (default) ─────────────────────────────────────────────
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-muted-foreground mb-1 capitalize">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        id={id}
        type={fieldType === 'email' ? 'email' : 'text'}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value || undefined)}
        placeholder={placeholder}
        className={inputClass}
      />
    </div>
  )
}

function formatValue(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
