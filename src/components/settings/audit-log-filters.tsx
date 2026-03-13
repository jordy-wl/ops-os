'use client'

import { cn } from '@/lib/utils'

/**
 * Common event types for the multi-select filter.
 * Each entry maps the raw event type string to a human-readable label.
 */
const EVENT_TYPE_OPTIONS = [
  { value: 'block.created', label: 'Block Created' },
  { value: 'block.updated', label: 'Block Updated' },
  { value: 'workflow.started', label: 'Workflow Started' },
  { value: 'workflow.completed', label: 'Workflow Done' },
  { value: 'task.assigned', label: 'Task Assigned' },
  { value: 'api_key.created', label: 'Key Created' },
  { value: 'api_key.revoked', label: 'Key Revoked' },
] as const

export interface AuditLogFiltersProps {
  selectedTypes: string[]
  fromDate: string
  toDate: string
  blockSearch: string
  onTypesChange: (types: string[]) => void
  onFromDateChange: (date: string) => void
  onToDateChange: (date: string) => void
  onBlockSearchChange: (search: string) => void
  onClearFilters: () => void
}

/**
 * AuditLogFilters — filter bar for the audit log viewer.
 *
 * Provides event type multi-select (checkboxes), date range inputs,
 * block search text input, and a clear-all button.
 */
export function AuditLogFilters({
  selectedTypes,
  fromDate,
  toDate,
  blockSearch,
  onTypesChange,
  onFromDateChange,
  onToDateChange,
  onBlockSearchChange,
  onClearFilters,
}: AuditLogFiltersProps) {
  const hasActiveFilters =
    selectedTypes.length > 0 || fromDate !== '' || toDate !== '' || blockSearch !== ''

  function handleTypeToggle(type: string) {
    if (selectedTypes.includes(type)) {
      onTypesChange(selectedTypes.filter((t) => t !== type))
    } else {
      onTypesChange([...selectedTypes, type])
    }
  }

  return (
    <div
      className="mb-6 rounded-lg border border-border bg-card p-4"
      role="search"
      aria-label="Audit log filters"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Event type filter */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground">Event Type</legend>
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {EVENT_TYPE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2 rounded px-1 py-0.5 text-sm text-foreground hover:bg-muted cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedTypes.includes(opt.value)}
                  onChange={() => handleTypeToggle(opt.value)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-ring"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Date range filter */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground">Date Range</legend>
          <div className="space-y-2">
            <div>
              <label htmlFor="audit-from-date" className="sr-only">
                From date
              </label>
              <input
                id="audit-from-date"
                type="date"
                value={fromDate}
                onChange={(e) => onFromDateChange(e.target.value)}
                className={cn(
                  'w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-ring'
                )}
                aria-label="From date"
              />
            </div>
            <div>
              <label htmlFor="audit-to-date" className="sr-only">
                To date
              </label>
              <input
                id="audit-to-date"
                type="date"
                value={toDate}
                onChange={(e) => onToDateChange(e.target.value)}
                className={cn(
                  'w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-ring'
                )}
                aria-label="To date"
              />
            </div>
          </div>
        </fieldset>

        {/* Block search filter */}
        <div className="space-y-2">
          <label htmlFor="audit-block-search" className="text-sm font-medium text-foreground">
            Block
          </label>
          <input
            id="audit-block-search"
            type="text"
            value={blockSearch}
            onChange={(e) => onBlockSearchChange(e.target.value)}
            placeholder="Search by block ID..."
            className={cn(
              'w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-ring'
            )}
          />
        </div>

        {/* Clear filters */}
        <div className="flex items-end">
          <button
            type="button"
            onClick={onClearFilters}
            disabled={!hasActiveFilters}
            className={cn(
              'rounded-md border border-input px-4 py-1.5 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              hasActiveFilters
                ? 'bg-background text-foreground hover:bg-muted cursor-pointer'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
            aria-label="Clear all filters"
          >
            Clear Filters
          </button>
        </div>
      </div>
    </div>
  )
}
