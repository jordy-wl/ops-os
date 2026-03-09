'use client'

import { cn } from '@/lib/utils'

/** A single property from a JSON Schema `properties` object */
interface FieldDef {
  type?: string
  enum?: string[]
  description?: string
  format?: string
  minimum?: number
}

interface DynamicFieldRendererProps {
  /** JSON Schema field_schema from block_type_definitions */
  fieldSchema: {
    type?: string
    properties?: Record<string, FieldDef>
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
 * DynamicFieldRenderer — renders form inputs or read-only values
 * based on a JSON Schema field_schema from block_type_definitions.
 *
 * Supported field types: text, number, select (enum), boolean.
 */
export function DynamicFieldRenderer({
  fieldSchema,
  values,
  onChange,
  readOnly = false,
}: DynamicFieldRendererProps) {
  const properties = fieldSchema.properties ?? {}
  const required = new Set(fieldSchema.required ?? [])
  const fields = Object.entries(properties)

  if (fields.length === 0) return null

  if (readOnly) {
    return (
      <dl className="divide-y divide-gray-100 rounded-lg border text-sm">
        {fields.map(([name, def]) => (
          <div key={name} className="flex gap-4 px-4 py-2.5">
            <dt className="w-36 shrink-0 font-medium text-gray-600 capitalize">
              {def.description ?? name.replace(/_/g, ' ')}
            </dt>
            <dd className="flex-1 text-gray-900 break-words">
              {formatValue(values[name])}
            </dd>
          </div>
        ))}
      </dl>
    )
  }

  return (
    <div className="space-y-3">
      {fields.map(([name, def]) => (
        <FieldInput
          key={name}
          name={name}
          def={def}
          value={values[name]}
          required={required.has(name)}
          onChange={(v) => onChange?.(name, v)}
        />
      ))}
    </div>
  )
}

function FieldInput({
  name,
  def,
  value,
  required,
  onChange,
}: {
  name: string
  def: FieldDef
  value: unknown
  required: boolean
  onChange: (v: unknown) => void
}) {
  const label = name.replace(/_/g, ' ')
  const id = `field-${name}`

  const inputClass = cn(
    'w-full rounded-md border border-gray-200 px-3 py-2 text-sm',
    'focus:outline-none focus:ring-2 focus:ring-gray-900'
  )

  // Select (enum)
  if (def.enum && def.enum.length > 0) {
    return (
      <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1 capitalize">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <select
          id={id}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={cn(inputClass, 'capitalize')}
        >
          <option value="">Select…</option>
          {def.enum.map((opt) => (
            <option key={opt} value={opt} className="capitalize">
              {opt.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>
    )
  }

  // Boolean
  if (def.type === 'boolean') {
    return (
      <label htmlFor={id} className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
        />
        <span className="font-medium text-gray-700 capitalize">{label}</span>
      </label>
    )
  }

  // Number
  if (def.type === 'number' || def.type === 'integer') {
    return (
      <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1 capitalize">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <input
          id={id}
          type="number"
          value={value != null ? String(value) : ''}
          min={def.minimum}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
          placeholder={def.description}
          className={inputClass}
        />
      </div>
    )
  }

  // Default: text
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1 capitalize">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        id={id}
        type={def.format === 'email' ? 'email' : 'text'}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value || undefined)}
        placeholder={def.description}
        className={inputClass}
      />
    </div>
  )
}

function formatValue(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
