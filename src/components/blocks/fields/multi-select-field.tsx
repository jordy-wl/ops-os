'use client'

import { cn } from '@/lib/utils'
import type { FieldComponentProps } from './field-props'

export function MultiSelectField({ name, value, onChange, fieldDef, mode, required }: FieldComponentProps) {
  const label = (fieldDef.description as string) ?? name.replace(/_/g, ' ')
  const id = `field-${name}`
  const items = fieldDef.items as Record<string, unknown> | undefined
  const options = (items?.enum as string[]) ?? []
  const selected = Array.isArray(value) ? (value as string[]) : []

  if (mode === 'view') {
    if (selected.length === 0) return <span className="text-sm text-muted-foreground">—</span>
    return (
      <div className="flex flex-wrap gap-1">
        {selected.map((v) => (
          <span key={v} className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize">
            {v.replace(/_/g, ' ')}
          </span>
        ))}
      </div>
    )
  }

  const toggle = (opt: string) => {
    const next = selected.includes(opt)
      ? selected.filter((s) => s !== opt)
      : [...selected, opt]
    onChange(next.length > 0 ? next : undefined)
  }

  return (
    <div>
      <label className="block text-sm font-medium text-muted-foreground mb-1 capitalize">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby={id}>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={cn(
              'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-colors',
              selected.includes(opt)
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-input bg-background text-muted-foreground hover:bg-muted'
            )}
          >
            {opt.replace(/_/g, ' ')}
          </button>
        ))}
      </div>
    </div>
  )
}
