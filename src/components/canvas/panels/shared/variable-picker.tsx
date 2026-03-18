'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Variable {
  path: string
  label: string
  type?: string
}

export interface VariableGroup {
  label: string
  variables: Variable[]
}

export interface VariablePickerButtonProps {
  variables: VariableGroup[]
  onSelect: (variable: Variable) => void
}

export interface VariablePickerInputProps {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  variables: VariableGroup[]
  autoSuggestion?: string
}

// ---------------------------------------------------------------------------
// Default variable groups
// ---------------------------------------------------------------------------

const DEFAULT_GROUPS: VariableGroup[] = [
  {
    label: 'Source Record',
    variables: [
      { path: 'block.name', label: 'Name', type: 'string' },
      { path: 'block.type', label: 'Type', type: 'string' },
      { path: 'block.status', label: 'Status', type: 'string' },
      { path: 'block.email', label: 'Email', type: 'string' },
      { path: 'block.metadata', label: 'Metadata', type: 'object' },
    ],
  },
  {
    label: 'Workflow Context',
    variables: [
      { path: 'context.trigger_event', label: 'Trigger Event', type: 'object' },
      { path: 'context.current_user', label: 'Current User', type: 'string' },
      { path: 'context.timestamp', label: 'Timestamp', type: 'date' },
    ],
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveGroups(groups: VariableGroup[]): VariableGroup[] {
  return groups.length > 0 ? groups : DEFAULT_GROUPS
}

function filterGroups(groups: VariableGroup[], query: string): VariableGroup[] {
  if (!query.trim()) return groups
  const lower = query.toLowerCase()
  return groups
    .map((group) => ({
      ...group,
      variables: group.variables.filter(
        (v) =>
          v.label.toLowerCase().includes(lower) ||
          v.path.toLowerCase().includes(lower),
      ),
    }))
    .filter((group) => group.variables.length > 0)
}

// ---------------------------------------------------------------------------
// VariablePickerDropdown (internal)
// ---------------------------------------------------------------------------

interface DropdownProps {
  groups: VariableGroup[]
  onSelect: (variable: Variable) => void
  onClose: () => void
}

function VariablePickerDropdown({ groups, onSelect, onClose }: DropdownProps) {
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const filtered = filterGroups(groups, search)

  // Focus the search input when the dropdown opens
  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleSelect(variable: Variable) {
    onSelect(variable)
    onClose()
  }

  return (
    <div
      ref={dropdownRef}
      className="absolute z-50 mt-1 w-64 rounded-md border bg-popover shadow-lg"
      role="listbox"
      aria-label="Variable picker"
    >
      <input
        ref={searchRef}
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search variables..."
        className="w-full border-b px-3 py-2 text-xs bg-transparent outline-none"
        aria-label="Search variables"
      />
      <div className="max-h-60 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="px-3 py-3 text-xs text-muted-foreground text-center">
            No variables match your search
          </div>
        )}
        {filtered.map((group) => (
          <div key={group.label}>
            <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
              {group.label}
            </div>
            {group.variables.map((variable) => (
              <button
                key={variable.path}
                type="button"
                role="option"
                aria-label={`Insert variable ${variable.label} (${variable.path})`}
                className="w-full px-3 py-1.5 text-xs cursor-pointer hover:bg-accent flex justify-between items-center text-left"
                onClick={() => handleSelect(variable)}
              >
                <span className="text-foreground">{variable.label}</span>
                <span className="text-muted-foreground font-mono text-[10px] ml-2 truncate max-w-[120px]">
                  {variable.path}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// VariablePickerButton
// ---------------------------------------------------------------------------

export function VariablePickerButton({
  variables,
  onSelect,
}: VariablePickerButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const groups = resolveGroups(variables)

  const handleClose = useCallback(() => {
    setIsOpen(false)
  }, [])

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        aria-label="Insert variable"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent hover:border-border cursor-pointer"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {'{ }'}
      </button>
      {isOpen && (
        <VariablePickerDropdown
          groups={groups}
          onSelect={onSelect}
          onClose={handleClose}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// VariablePickerInput
// ---------------------------------------------------------------------------

export function VariablePickerInput({
  id,
  value,
  onChange,
  placeholder,
  variables,
  autoSuggestion,
}: VariablePickerInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const groups = resolveGroups(variables)

  // Determine the displayed placeholder: prefer autoSuggestion formatted as
  // a template expression, otherwise fall back to the caller's placeholder.
  const displayPlaceholder = autoSuggestion
    ? `{{${autoSuggestion}}}`
    : placeholder

  function handleVariableSelect(variable: Variable) {
    const input = inputRef.current
    const insertion = `{{${variable.path}}}`

    if (input) {
      const start = input.selectionStart ?? value.length
      const end = input.selectionEnd ?? value.length
      const before = value.slice(0, start)
      const after = value.slice(end)
      const next = before + insertion + after
      onChange(next)

      // Move cursor to the end of the inserted text after React re-renders
      const cursorPos = start + insertion.length
      requestAnimationFrame(() => {
        input.focus()
        input.setSelectionRange(cursorPos, cursorPos)
      })
    } else {
      // Fallback: append
      onChange(value + insertion)
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={displayPlaceholder}
        className="w-full rounded-md border border-border px-2.5 py-1.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="absolute right-1 top-1/2 -translate-y-1/2">
        <VariablePickerButton
          variables={groups}
          onSelect={handleVariableSelect}
        />
      </div>
    </div>
  )
}
