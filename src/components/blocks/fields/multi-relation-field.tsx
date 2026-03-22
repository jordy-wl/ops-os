'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { FieldComponentProps } from './field-props'

interface BlockOption {
  id: string
  name: string
  type: string
}

/**
 * MultiRelationField renders a chip-based multi-select for block relations.
 * Reads x-relation-target from the field definition to determine which block
 * type to fetch. Stores an array of block IDs (UUID strings) as the value.
 */
export function MultiRelationField({
  name,
  value,
  onChange,
  fieldDef,
  mode,
  required,
}: FieldComponentProps) {
  const label = (fieldDef.description as string) ?? name.replace(/_/g, ' ')
  const id = `field-${name}`
  const targetType = (fieldDef['x-relation-target'] as string) ?? ''

  const [options, setOptions] = useState<BlockOption[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = Array.isArray(value) ? (value as string[]) : []

  const fetchOptions = useCallback(async () => {
    setLoading(true)
    try {
      const url = targetType
        ? `/api/blocks?type=${targetType}&limit=50`
        : '/api/blocks?limit=50'
      const res = await fetch(url)
      if (res.ok) {
        const body = await res.json()
        setOptions(body.data ?? [])
      }
    } catch {
      // ignore fetch errors in field
    } finally {
      setLoading(false)
    }
  }, [targetType])

  useEffect(() => {
    fetchOptions()
  }, [fetchOptions])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getBlockName = (blockId: string): string => {
    const match = options.find((o) => o.id === blockId)
    return match?.name ?? blockId.slice(0, 8) + '...'
  }

  const handleAdd = (blockId: string) => {
    if (!selected.includes(blockId)) {
      const next = [...selected, blockId]
      onChange(next.length > 0 ? next : undefined)
    }
    setSearch('')
    setDropdownOpen(false)
  }

  const handleRemove = (blockId: string) => {
    const next = selected.filter((id) => id !== blockId)
    onChange(next.length > 0 ? next : undefined)
  }

  // Filter options: exclude already-selected, match search query
  const filteredOptions = options.filter((opt) => {
    if (selected.includes(opt.id)) return false
    if (search && !opt.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // -- View mode --
  if (mode === 'view') {
    if (selected.length === 0) {
      return <span className="text-sm text-muted-foreground">&mdash;</span>
    }
    return (
      <div className="flex flex-wrap gap-1.5">
        {selected.map((blockId) => (
          <a
            key={blockId}
            href={`/blocks/${blockId}`}
            className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
          >
            {getBlockName(blockId)}
          </a>
        ))}
      </div>
    )
  }

  // -- Edit mode --
  return (
    <div ref={containerRef}>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-muted-foreground mb-1 capitalize"
      >
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
        {targetType && (
          <span className="ml-1 text-xs text-muted-foreground/60">({targetType})</span>
        )}
      </label>

      {/* Selected chips */}
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {selected.map((blockId) => (
          <span
            key={blockId}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-1 text-xs font-medium text-primary"
          >
            <a
              href={`/blocks/${blockId}`}
              className="hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {getBlockName(blockId)}
            </a>
            <button
              type="button"
              onClick={() => handleRemove(blockId)}
              className="ml-0.5 hover:text-destructive transition-colors"
              aria-label={`Remove ${getBlockName(blockId)}`}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </span>
        ))}
      </div>

      {/* Search input + dropdown */}
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setDropdownOpen(true)
          }}
          onFocus={() => setDropdownOpen(true)}
          placeholder={loading ? 'Loading...' : `Search ${targetType || 'blocks'}...`}
          disabled={loading}
          className={cn(
            'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-ring',
            loading && 'opacity-60'
          )}
        />

        {dropdownOpen && !loading && (
          <ul
            className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-input bg-popover shadow-md"
            role="listbox"
            aria-label={`${targetType || 'block'} options`}
          >
            {filteredOptions.length === 0 && (
              <li className="px-3 py-2 text-xs text-muted-foreground">
                {search ? 'No matches found' : 'No options available'}
              </li>
            )}
            {filteredOptions.map((opt) => (
              <li key={opt.id}>
                <button
                  type="button"
                  onClick={() => handleAdd(opt.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors text-left"
                  role="option"
                  aria-selected={false}
                >
                  <span className="flex-1 truncate">{opt.name}</span>
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
                    {opt.type.replace(/_/g, ' ')}
                  </span>
                </button>
              </li>
            ))}
            {targetType && (
              <li className="border-t border-input">
                <a
                  href={`/blocks/new?type=${targetType}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-primary hover:bg-muted transition-colors"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Create new {targetType.replace(/_/g, ' ')}
                </a>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
