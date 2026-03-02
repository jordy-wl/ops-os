'use client'

import type { Event } from '@/lib/context-assembly'

interface EventTimelineProps {
  events: Event[]
}

/** Maps actor_type to a simple display label */
const ACTOR_LABELS: Record<string, string> = {
  human:  'User',
  ai:     'AI',
  system: 'System',
}

/** Maps event type prefix to a short category label for display */
function eventCategory(type: string): string {
  if (type.startsWith('block.')) return type.replace('block.', '')
  return type
}

/**
 * Formats an ISO timestamp as a human-readable relative string ("2h ago").
 * Shown as the visible label; full ISO date shown on hover via title attribute.
 */
function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()

  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMs < 0) return 'just now' // clock skew guard
  if (diffDays >= 30) return date.toLocaleDateString()
  if (diffDays >= 1) return `${diffDays}d ago`
  if (diffHours >= 1) return `${diffHours}h ago`
  if (diffMins >= 1) return `${diffMins}m ago`
  return 'just now'
}

/**
 * EventTimeline — shows the block's immutable event log, newest first.
 * Each event displays: type, actor, relative timestamp (with ISO date on hover),
 * and a short payload summary.
 *
 * @param events - Sorted array of events (newest first) to display
 */
export function EventTimeline({ events }: EventTimelineProps) {
  return (
    <section aria-label="Event timeline">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Event Timeline</h2>

      {events.length === 0 ? (
        <p className="text-sm text-gray-400 italic py-4 text-center">
          No events recorded yet.
        </p>
      ) : (
        <ol className="relative border-l border-gray-200 ml-3 space-y-4">
          {events.map((event) => {
            const payloadSummary = JSON.stringify(event.payload).slice(0, 80)
            const actor = ACTOR_LABELS[event.actor_type] ?? event.actor_type
            const relative = formatRelativeTime(event.occurred_at)

            return (
              <li key={event.id} className="ml-4 pl-4">
                {/* Timeline dot */}
                <span
                  className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-white bg-gray-300"
                  aria-hidden="true"
                />

                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-0.5">
                  {/* Event type */}
                  <span className="text-sm font-medium text-gray-900">
                    {eventCategory(event.type)}
                  </span>

                  {/* Relative timestamp — full ISO date on hover */}
                  <time
                    dateTime={event.occurred_at}
                    title={event.occurred_at}
                    className="text-xs text-gray-400 shrink-0 cursor-default"
                  >
                    {relative}
                  </time>
                </div>

                {/* Actor */}
                <p className="text-xs text-gray-500 mt-0.5">
                  by {actor} · {event.actor_id}
                </p>

                {/* Payload summary */}
                {payloadSummary && payloadSummary !== '{}' && (
                  <p className="mt-1 text-xs text-gray-400 font-mono truncate">
                    {payloadSummary}
                  </p>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
