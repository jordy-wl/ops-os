'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { ALL_PORTAL_BLOCK_TYPES } from '@/lib/portal-constants'
import type { ExposedBlockTypeConfig } from '@/lib/portal-constants'
import { SYSTEM_BLOCK_TYPES } from '@/lib/block-types/system-types'
import { AiSuggestBar } from '../ai-assist/ai-suggest-bar'
import { AiFieldNudge } from '../ai-assist/ai-field-nudge'

interface Step2ContentProps {
  exposedBlockTypeConfig: ExposedBlockTypeConfig
  onTypeToggle: (typeName: string, enabled: boolean) => void
  onFieldToggle: (typeName: string, fieldKey: string, visible: boolean) => void
}

function getSystemType(typeName: string) {
  return SYSTEM_BLOCK_TYPES.find((t) => t.type_name === typeName)
}

function getFieldEntries(typeName: string): { key: string; label: string; order: number }[] {
  const def = getSystemType(typeName)
  if (!def?.field_schema?.properties) return []

  const props = def.field_schema.properties as Record<
    string,
    { description?: string; 'x-display-order'?: number }
  >

  return Object.entries(props)
    .map(([key, schema]) => ({
      key,
      label: schema.description ?? formatFieldKey(key),
      order: schema['x-display-order'] ?? 999,
    }))
    .sort((a, b) => a.order - b.order)
}

function formatFieldKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function Step2Content({
  exposedBlockTypeConfig,
  onTypeToggle,
  onFieldToggle,
}: Step2ContentProps) {
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set())

  const toggleExpanded = (typeName: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(typeName)) next.delete(typeName)
      else next.add(typeName)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Dashboard Content</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Choose which record types and fields are visible to clients in the portal dashboard.
        </p>
      </div>

      <AiSuggestBar
        stepId="content"
        suggestions={[]}
        disabled
        placeholderText="AI will suggest relevant data types based on client relationships"
      />

      <div className="rounded-lg border border-border divide-y divide-border">
        {ALL_PORTAL_BLOCK_TYPES.map((bt) => {
          const typeEnabled = exposedBlockTypeConfig[bt.value]?.enabled ?? false
          const isExpanded = expandedTypes.has(bt.value)
          const fields = getFieldEntries(bt.value)
          const fieldConfig = exposedBlockTypeConfig[bt.value]?.fields ?? {}

          return (
            <div key={bt.value}>
              {/* Type row */}
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={typeEnabled}
                  aria-label={`Toggle ${bt.label}`}
                  onClick={() => onTypeToggle(bt.value, !typeEnabled)}
                  className={`
                    relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full
                    border-2 border-transparent shadow-sm transition-colors
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                    ${typeEnabled ? 'bg-primary' : 'bg-input'}
                  `}
                >
                  <span
                    className={`
                      pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform
                      ${typeEnabled ? 'translate-x-4' : 'translate-x-0'}
                    `}
                  />
                </button>
                <span className={`text-sm flex-1 ${typeEnabled ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                  {bt.label}
                </span>
                {typeEnabled && fields.length > 0 && (
                  <button
                    type="button"
                    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${bt.label} fields`}
                    onClick={() => toggleExpanded(bt.value)}
                    className="p-1 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>

              {/* Field checkboxes */}
              {typeEnabled && isExpanded && fields.length > 0 && (
                <div className="px-4 pb-3 pl-16">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground">
                      Uncheck fields to hide them from the portal.
                    </p>
                    <AiFieldNudge fieldKey={bt.value} disabled />
                  </div>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {fields.map((field) => {
                      const hasExplicitConfig = Object.keys(fieldConfig).length > 0
                      const isVisible = hasExplicitConfig
                        ? fieldConfig[field.key] !== false
                        : true

                      return (
                        <label
                          key={field.key}
                          className="flex items-center gap-2 rounded px-2 py-1.5 cursor-pointer hover:bg-muted/30 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isVisible}
                            onChange={(e) => onFieldToggle(bt.value, field.key, e.target.checked)}
                            className="rounded border-input w-3.5 h-3.5"
                          />
                          <span className="text-xs text-foreground">
                            {formatFieldKey(field.key)}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
