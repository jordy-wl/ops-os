'use client'

import { cn } from '@/lib/utils'
import type { FieldComponentProps } from './field-props'

export function UrlField({ name, value, onChange, fieldDef, mode, required }: FieldComponentProps) {
  const label = (fieldDef.description as string) ?? name.replace(/_/g, ' ')
  const id = `field-${name}`
  const placeholder = (fieldDef['x-placeholder'] as string) ?? 'https://...'

  if (mode === 'view') {
    if (!value) return <span className="text-sm text-muted-foreground">—</span>
    const href = String(value)
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-primary hover:underline truncate block max-w-xs"
      >
        {href.replace(/^https?:\/\//, '')}
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
        type="url"
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
