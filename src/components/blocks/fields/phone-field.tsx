'use client'

import { cn } from '@/lib/utils'
import type { FieldComponentProps } from './field-props'

export function PhoneField({ name, value, onChange, fieldDef, mode, required }: FieldComponentProps) {
  const label = (fieldDef.description as string) ?? name.replace(/_/g, ' ')
  const id = `field-${name}`
  const placeholder = (fieldDef['x-placeholder'] as string) ?? '+61 400 000 000'

  if (mode === 'view') {
    if (!value) return <span className="text-sm text-muted-foreground">—</span>
    return (
      <a href={`tel:${String(value)}`} className="text-sm text-primary hover:underline">
        {String(value)}
      </a>
    )
  }

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-muted-foreground mb-1 capitalize">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        id={id}
        type="tel"
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value || undefined)}
        placeholder={placeholder}
        className={cn(
          'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-ring'
        )}
      />
    </div>
  )
}
