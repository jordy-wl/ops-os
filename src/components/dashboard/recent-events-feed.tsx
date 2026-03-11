'use client'

import Link from 'next/link'
import type { RecentEvent } from '@/app/api/dashboard/summary/route'

interface RecentEventsFeedProps {
  events: RecentEvent[]
}

const ACTOR_LABELS: Record<string, string> = {
  human: 'User',
  ai: 'AI',
  system: 'System',
  workflow: 'Workflow',
}

function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMs < 0) return 'just now'
  if (diffDays >= 30) return date.toLocaleDateString()
  if (diffDays >= 1) return `${diffDays}d ago`
  if (diffHours >= 1) return `${diffHours}h ago`
  if (diffMins >= 1) return `${diffMins}m ago`
  return 'just now'
}

/**
 * RecentEventsFeed — shows the last 20 org-wide events.
 * Each row is clickable and navigates to the block detail view.
 * Empty state shown when there are no events yet.
 *
 * @param events - Last 20 events across the org (from dashboard summary API)
 */
export function RecentEventsFeed({ events }: RecentEventsFeedProps) {
  return (
    <section aria-label="Recent events">
      <h2 className="text-sm font-semibold text-foreground mb-3">Recent Events</h2>

      {events.length === 0 ? (
        <div className="rounded-lg border bg-background px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">No events recorded yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Events appear here when blocks are created or workflows run.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-background divide-y">
          {events.map((event) => {
            const relative = formatRelativeTime(event.occurred_at)
            const actor = ACTOR_LABELS[event.actor_type] ?? event.actor_type

            const row = (
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{event.type}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {event.block_name ?? 'Org-level'} · {actor}
                  </p>
                </div>
                <time
                  dateTime={event.occurred_at}
                  title={event.occurred_at}
                  className="text-xs text-muted-foreground shrink-0 cursor-default"
                >
                  {relative}
                </time>
              </div>
            )

            return event.block_id ? (
              <Link
                key={event.id}
                href={`/blocks/${event.block_id}`}
                className="block hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                aria-label={`${event.type} on ${event.block_name ?? 'org'} — ${relative}`}
              >
                {row}
              </Link>
            ) : (
              <div key={event.id}>{row}</div>
            )
          })}
        </div>
      )}
    </section>
  )
}
