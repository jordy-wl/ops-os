'use client'

import { cn } from '@/lib/utils'
import type { FieldComponentProps } from './field-props'

export function RichTextField({ name, value, onChange, fieldDef, mode, required }: FieldComponentProps) {
  const label = (fieldDef.description as string) ?? name.replace(/_/g, ' ')
  const id = `field-${name}`
  const placeholder = (fieldDef['x-placeholder'] as string) ?? 'Enter text (Markdown supported)...'

  if (mode === 'view') {
    if (!value) return <span className="text-sm text-muted-foreground">—</span>
    return (
      <div className="text-sm text-foreground prose prose-sm max-w-none whitespace-pre-wrap">
        {String(value)}
      </div>
    )
  }

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-muted-foreground mb-1 capitalize">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <textarea
        id={id}
        rows={4}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value || undefined)}
        placeholder={placeholder}
        className={cn(
          'w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y min-h-[80px]',
          'focus:outline-none focus:ring-2 focus:ring-ring'
        )}
      />
      <p className="mt-1 text-xs text-muted-foreground">Markdown supported</p>
    </div>
  )
}
