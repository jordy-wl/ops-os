'use client'

import { cn } from '@/lib/utils'

/**
 * Event shape as returned by the /api/events endpoint.
 * Matches the Event type from @/lib/context-assembly.
 */
export interface AuditEvent {
  id: string
  org_id: string
  block_id: string
  type: string
  actor_id: string
  actor_type: string
  payload: Record<string, unknown>
  occurred_at: string
}

/**
 * Badge display configuration for common event types.
 * Maps raw event type to a label and Tailwind color classes.
 */
const EVENT_TYPE_BADGES: Record<string, { label: string; className: string }> = {
  'block.created': {
    label: 'Created',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  'block.updated': {
    label: 'Updated',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  },
  'workflow.started': {
    label: 'Workflow Started',
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  },
  'workflow.completed': {
    label: 'Workflow Done',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  'task.assigned': {
    label: 'Task Assigned',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  },
  'api_key.created': {
    label: 'Key Created',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  },
  'api_key.revoked': {
    label: 'Key Revoked',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },
}

export interface AuditLogTableProps {
  events: AuditEvent[]
  isLoading: boolean
  hasMore: boolean
  onLoadMore: () => void
  isLoadingMore: boolean
}

/**
 * Formats an ISO timestamp into a human-readable date/time string.
 */
function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleString('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * Extracts a summary string from the event payload.
 * Looks for common payload keys that contain useful summary info.
 */
function extractSummary(payload: Record<string, unknown>): string {
  if (payload.summary && typeof payload.summary === 'string') {
    return payload.summary
  }
  if (payload.message && typeof payload.message === 'string') {
    return payload.message
  }
  if (payload.name && typeof payload.name === 'string') {
    return payload.name
  }
  if (payload.changes && typeof payload.changes === 'object') {
    const keys = Object.keys(payload.changes as object)
    if (keys.length > 0) {
      return `Changed: ${keys.join(', ')}`
    }
  }
  // Fallback: show first key-value pair if payload is non-empty
  const keys = Object.keys(payload)
  if (keys.length > 0) {
    const firstVal = payload[keys[0]]
    const displayVal = typeof firstVal === 'string' ? firstVal : JSON.stringify(firstVal)
    const truncated = displayVal && displayVal.length > 60 ? displayVal.slice(0, 60) + '...' : displayVal
    return `${keys[0]}: ${truncated}`
  }
  return '--'
}

/**
 * Renders a badge for the event type.
 * Known types get colored labels; unknown types show the raw type string.
 */
function EventTypeBadge({ type }: { type: string }) {
  const config = EVENT_TYPE_BADGES[type]

  if (config) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
          config.className
        )}
      >
        {config.label}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-800 dark:text-gray-300">
      {type}
    </span>
  )
}

/**
 * AuditLogTable — paginated event table for the audit log viewer.
 *
 * Displays events in a responsive table with columns for timestamp, actor,
 * event type (as a badge), block ID, and a payload summary.
 * Supports horizontal scroll on mobile and cursor-based pagination via
 * a "Load More" button.
 */
export function AuditLogTable({
  events,
  isLoading,
  hasMore,
  onLoadMore,
  isLoadingMore,
}: AuditLogTableProps) {
  // Loading state — skeleton rows
  if (isLoading) {
    return (
      <div role="status" aria-label="Loading audit log">
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  // Empty state
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/50 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No events found matching your filters.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Horizontal scroll wrapper for mobile */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Timestamp</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actor</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Event Type</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Block</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Summary</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr
                key={event.id}
                className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
              >
                <td className="whitespace-nowrap px-4 py-3 text-foreground">
                  {formatTimestamp(event.occurred_at)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-foreground">
                  <span className="font-mono text-xs" title={event.actor_id}>
                    {event.actor_id.slice(0, 12)}...
                  </span>
                </td>
                <td className="px-4 py-3">
                  <EventTypeBadge type={event.type} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="font-mono text-xs text-muted-foreground" title={event.block_id}>
                    {event.block_id.slice(0, 8)}...
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                  {extractSummary(event.payload)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Load More button */}
      {hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className={cn(
              'rounded-md border border-input px-6 py-2 text-sm font-medium transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ring',
              isLoadingMore
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-background text-foreground hover:bg-muted cursor-pointer'
            )}
          >
            {isLoadingMore ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  )
}
