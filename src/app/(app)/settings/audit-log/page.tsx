'use client'

import { useState, useEffect, useCallback } from 'react'
import { AuditLogFilters } from '@/components/settings/audit-log-filters'
import { AuditLogTable, type AuditEvent } from '@/components/settings/audit-log-table'

const PAGE_SIZE = 50

/**
 * AuditLogSettingsPage — paginated, filterable, read-only event viewer.
 *
 * Fetches events from /api/events with filter params and cursor-based pagination.
 * Events are immutable — this page is read-only with no edit/delete actions.
 */
export default function AuditLogSettingsPage() {
  // Filter state
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [blockSearch, setBlockSearch] = useState('')

  // Data state
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Build the query string for the events API based on current filters.
   */
  const buildQueryParams = useCallback(
    (paginationCursor?: string | null) => {
      const params = new URLSearchParams()
      // org_id is required by the API to allow org-wide queries
      params.set('org_id', 'current')
      params.set('limit', String(PAGE_SIZE))

      if (selectedTypes.length > 0) {
        params.set('type', selectedTypes.join(','))
      }
      if (fromDate) {
        params.set('from', fromDate)
      }
      if (toDate) {
        params.set('to', toDate)
      }
      if (blockSearch.trim()) {
        params.set('block_id', blockSearch.trim())
      }
      if (paginationCursor) {
        params.set('cursor', paginationCursor)
      }

      return params.toString()
    },
    [selectedTypes, fromDate, toDate, blockSearch]
  )

  /**
   * Fetch events from the API. Resets to page 1 when called without a cursor.
   */
  const fetchEvents = useCallback(
    async (paginationCursor?: string | null) => {
      const isInitial = !paginationCursor
      if (isInitial) {
        setIsLoading(true)
      } else {
        setIsLoadingMore(true)
      }
      setError(null)

      try {
        const qs = buildQueryParams(paginationCursor)
        const res = await fetch(`/api/events?${qs}`)

        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new Error(body?.error?.message ?? `Request failed with status ${res.status}`)
        }

        const body = await res.json()
        const { events: newEvents, cursor: nextCursor } = body.data

        if (isInitial) {
          setEvents(newEvents ?? [])
        } else {
          setEvents((prev) => [...prev, ...(newEvents ?? [])])
        }
        setCursor(nextCursor ?? null)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load events'
        setError(message)
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    },
    [buildQueryParams]
  )

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  function handleLoadMore() {
    if (cursor) {
      fetchEvents(cursor)
    }
  }

  function handleClearFilters() {
    setSelectedTypes([])
    setFromDate('')
    setToDate('')
    setBlockSearch('')
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Audit Log</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Read-only view of all events across your organisation.
        </p>
      </div>

      <AuditLogFilters
        selectedTypes={selectedTypes}
        fromDate={fromDate}
        toDate={toDate}
        blockSearch={blockSearch}
        onTypesChange={setSelectedTypes}
        onFromDateChange={setFromDate}
        onToDateChange={setToDate}
        onBlockSearchChange={setBlockSearch}
        onClearFilters={handleClearFilters}
      />

      {/* Error state with retry */}
      {error && !isLoading && (
        <div
          className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400"
          role="alert"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => fetchEvents()}
            className="mt-2 text-sm font-medium text-red-800 underline hover:no-underline dark:text-red-300 focus:outline-none focus:ring-2 focus:ring-ring rounded"
          >
            Try again
          </button>
        </div>
      )}

      <AuditLogTable
        events={events}
        isLoading={isLoading}
        hasMore={cursor !== null}
        onLoadMore={handleLoadMore}
        isLoadingMore={isLoadingMore}
      />
    </div>
  )
}
