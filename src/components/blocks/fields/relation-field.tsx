'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { FieldComponentProps } from './field-props'

interface BlockOption {
  id: string
  name: string
  type: string
}

export function RelationField({ name, value, onChange, fieldDef, mode, required }: FieldComponentProps) {
  const label = (fieldDef.description as string) ?? name.replace(/_/g, ' ')
  const id = `field-${name}`
  const targetType = (fieldDef['x-relation-target'] as string) ?? ''
  const [options, setOptions] = useState<BlockOption[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedName, setSelectedName] = useState<string | null>(null)

  const fetchOptions = useCallback(async () => {
    if (!targetType) return
    setLoading(true)
    try {
      const res = await fetch(`/api/blocks?type=${targetType}&limit=50`)
      if (res.ok) {
        const body = await res.json()
        setOptions(body.data ?? [])
        // Resolve name of current value
        if (value) {
          const match = (body.data as BlockOption[]).find((b) => b.id === value)
          if (match) setSelectedName(match.name)
        }
      }
    } catch {
      // ignore fetch errors in field
    } finally {
      setLoading(false)
    }
  }, [targetType, value])

  useEffect(() => {
    fetchOptions()
  }, [fetchOptions])

  if (mode === 'view') {
    if (!value) return <span className="text-sm text-muted-foreground">—</span>
    return (
      <a
        href={`/blocks/${String(value)}`}
        className="text-sm text-primary hover:underline inline-flex items-center gap-1"
      >
        {selectedName ?? String(value).slice(0, 8) + '...'}
      </a>
    )
  }

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-muted-foreground mb-1 capitalize">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        {targetType && <span className="ml-1 text-xs text-muted-foreground/60">({targetType})</span>}
      </label>
      <select
        id={id}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value || undefined)}
        disabled={loading}
        className={cn(
          'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-ring',
          loading && 'opacity-60'
        )}
      >
        <option value="">{loading ? 'Loading...' : `Select ${targetType}…`}</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.name}
          </option>
        ))}
      </select>
    </div>
  )
}
