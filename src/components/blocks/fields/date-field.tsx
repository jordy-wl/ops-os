'use client'

import { cn } from '@/lib/utils'
import type { FieldComponentProps } from './field-props'

export function DateField({ name, value, onChange, fieldDef, mode, required }: FieldComponentProps) {
  const label = (fieldDef.description as string) ?? name.replace(/_/g, ' ')
  const id = `field-${name}`

  if (mode === 'view') {
    const dateStr = value ? formatDate(String(value)) : '—'
    return <span className="text-sm text-foreground">{dateStr}</span>
  }

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-muted-foreground mb-1 capitalize">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        id={id}
        type="date"
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value || undefined)}
        className={cn(
          'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-ring'
        )}
      />
    </div>
  )
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-AU', {
      year: 'numeric', month: 'short', day: 'numeric',
    })
  } catch {
    return iso
  }
}
