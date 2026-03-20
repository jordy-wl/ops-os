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
 * RelationField renders a searchable dropdown for selecting a single block
 * reference. Reads x-relation-target from the field definition to determine
 * which block type to fetch. For polymorphic fields (empty target), fetches
 * all blocks and groups them by type in the dropdown.
 */
export function RelationField({ name, value, onChange, fieldDef, mode, required }: FieldComponentProps) {
  const label = (fieldDef.description as string) ?? name.replace(/_/g, ' ')
  const id = `field-${name}`
  const targetType = (fieldDef['x-relation-target'] as string) ?? ''

  const [options, setOptions] = useState<BlockOption[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isPolymorphic = !targetType

  const fetchOptions = useCallback(async () => {
    setLoading(true)
    try {
      const url = targetType
        ? `/api/blocks?type=${targetType}&limit=50`
        : '/api/blocks?limit=50'
      const res = await fetch(url)
      if (res.ok) {
        const body = await res.json()
        const data = (body.data ?? []) as BlockOption[]
        setOptions(data)
        // Resolve name of current value
        if (value) {
          const match = data.find((b) => b.id === value)
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

  const handleSelect = (blockId: string, blockName: string) => {
    onChange(blockId)
    setSelectedName(blockName)
    setDropdownOpen(false)
    setSearch('')
  }

  const handleClear = () => {
    onChange(undefined)
    setSelectedName(null)
    setSearch('')
  }

  // Filter options by search query
  const filteredOptions = options.filter((opt) => {
    if (!search) return true
    return opt.name.toLowerCase().includes(search.toLowerCase())
  })

  // Group options by type for polymorphic fields
  const groupedOptions = isPolymorphic
    ? filteredOptions.reduce<Record<string, BlockOption[]>>((acc, opt) => {
        const group = opt.type || 'other'
        if (!acc[group]) acc[group] = []
        acc[group].push(opt)
        return acc
      }, {})
    : null

  // -- View mode --
  if (mode === 'view') {
    if (!value) return <span className="text-sm text-muted-foreground">&mdash;</span>
    return (
      <a
        href={`/blocks/${String(value)}`}
        className="text-sm text-primary hover:underline inline-flex items-center gap-1"
      >
        {selectedName ?? String(value).slice(0, 8) + '...'}
      </a>
    )
  }

  // -- Edit mode --
  return (
    <div ref={containerRef}>
      <label htmlFor={id} className="block text-sm font-medium text-muted-foreground mb-1 capitalize">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
        {targetType && <span className="ml-1 text-xs text-muted-foreground/60">({targetType})</span>}
      </label>

      <div className="relative">
        {/* Selected value display or search input */}
        {value && !dropdownOpen ? (
          <div
            className={cn(
              'flex items-center justify-between w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
              'cursor-pointer hover:bg-muted/50 transition-colors'
            )}
            onClick={() => {
              setDropdownOpen(true)
              setTimeout(() => inputRef.current?.focus(), 0)
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setDropdownOpen(true)
                setTimeout(() => inputRef.current?.focus(), 0)
              }
            }}
          >
            <span className="truncate">{selectedName ?? String(value).slice(0, 8) + '...'}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleClear()
              }}
              className="ml-2 shrink-0 text-muted-foreground hover:text-destructive transition-colors"
              aria-label={`Clear ${label}`}
            >
              <svg
                width="14"
                height="14"
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
          </div>
        ) : (
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
            placeholder={loading ? 'Loading...' : `Search ${targetType ? targetType.replace(/_/g, ' ') : 'blocks'}...`}
            disabled={loading}
            className={cn(
              'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
              'focus:outline-none focus:ring-2 focus:ring-ring',
              loading && 'opacity-60'
            )}
          />
        )}

        {/* Dropdown list */}
        {dropdownOpen && !loading && (
          <ul
            className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-input bg-popover shadow-md"
            role="listbox"
            aria-label={`${targetType || 'block'} options`}
          >
            {/* Unset option */}
            {!!value && (
              <li>
                <button
                  type="button"
                  onClick={() => handleClear()}
                  className="flex w-full items-center px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors text-left italic"
                  role="option"
                  aria-selected={false}
                >
                  Clear selection
                </button>
              </li>
            )}

            {/* Grouped display for polymorphic relations */}
            {groupedOptions ? (
              Object.keys(groupedOptions).length === 0 ? (
                <li className="px-3 py-2 text-xs text-muted-foreground">
                  {search ? 'No matches found' : 'No options available'}
                </li>
              ) : (
                Object.entries(groupedOptions).map(([groupType, groupItems]) => (
                  <li key={groupType}>
                    <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {groupType.replace(/_/g, ' ')}
                    </div>
                    <ul>
                      {groupItems.map((opt) => (
                        <li key={opt.id}>
                          <button
                            type="button"
                            onClick={() => handleSelect(opt.id, opt.name)}
                            className={cn(
                              'flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors text-left',
                              String(value) === opt.id && 'bg-primary/5 font-medium'
                            )}
                            role="option"
                            aria-selected={String(value) === opt.id}
                          >
                            <span className="flex-1 truncate">{opt.name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))
              )
            ) : (
              /* Flat display for typed relations */
              <>
                {filteredOptions.length === 0 && (
                  <li className="px-3 py-2 text-xs text-muted-foreground">
                    {search ? 'No matches found' : 'No options available'}
                  </li>
                )}
                {filteredOptions.map((opt) => (
                  <li key={opt.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(opt.id, opt.name)}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors text-left',
                        String(value) === opt.id && 'bg-primary/5 font-medium'
                      )}
                      role="option"
                      aria-selected={String(value) === opt.id}
                    >
                      <span className="flex-1 truncate">{opt.name}</span>
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
                        {opt.type.replace(/_/g, ' ')}
                      </span>
                    </button>
                  </li>
                ))}
              </>
            )}

            {/* Create new link */}
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
