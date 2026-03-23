'use client'

import { STANDARD_EDGE_TYPES } from '@/lib/block-types/field-types'

const EDGE_GROUPS = ['Hierarchy', 'Governance', 'General', 'Workflow'] as const

interface EdgeTypeSelectProps {
  id: string
  value: string
  onChange: (value: string) => void
}

export function EdgeTypeSelect({ id, value, onChange }: EdgeTypeSelectProps) {
  const selected = STANDARD_EDGE_TYPES.find((et) => et.value === value)

  return (
    <div>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="">No edge sync (manual only)</option>
        {EDGE_GROUPS.map((group) => {
          const items = STANDARD_EDGE_TYPES.filter((et) => et.group === group)
          if (items.length === 0) return null
          return (
            <optgroup key={group} label={group}>
              {items.map((et) => (
                <option key={et.value} value={et.value}>
                  {et.label}
                </option>
              ))}
            </optgroup>
          )
        })}
      </select>
      <p className="mt-1 text-xs text-muted-foreground">
        {selected
          ? `${selected.description}. Edge auto-syncs when field changes.`
          : 'Automatically creates a graph edge when this field value changes. Choose the relationship type that best describes how these records connect.'}
      </p>
    </div>
  )
}
