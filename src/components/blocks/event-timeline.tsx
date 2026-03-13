import { cn } from '@/lib/utils'
import type { Event } from '@/lib/context-assembly'

interface EventTimelineProps {
  events: Event[]
}

// ─── Actor labels ────────────────────────────────────────────────────────────

const ACTOR_LABELS: Record<string, string> = {
  human:  'User',
  ai:     'AI',
  system: 'System',
}

// ─── Date grouping helpers ──────────────────────────────────────────────────

function dateLabel(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const eventDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (eventDay.getTime() === today.getTime()) return 'Today'
  if (eventDay.getTime() === yesterday.getTime()) return 'Yesterday'
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function groupByDate(events: Event[]): Map<string, Event[]> {
  const groups = new Map<string, Event[]>()
  for (const event of events) {
    const label = dateLabel(event.occurred_at)
    const existing = groups.get(label)
    if (existing) {
      existing.push(event)
    } else {
      groups.set(label, [event])
    }
  }
  return groups
}

function payloadOneLiner(payload: Record<string, unknown>): string {
  const entries = Object.entries(payload)
  if (entries.length === 0) return ''
  const parts = entries
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(', ')
  return parts.length > 80 ? parts.slice(0, 77) + '...' : parts
}

// ─── Component ──────────────────────────────────────────────────────────────

export function EventTimeline({ events }: EventTimelineProps) {
  // Empty state
  if (!events || events.length === 0) {
    return (
      <section aria-label="Event timeline">
        <h2 className="text-[13px] font-medium text-foreground mb-3">Event Timeline</h2>
        <p className="text-[13px] text-muted-foreground py-6 text-center">
          No events recorded yet.
        </p>
      </section>
    )
  }

  const groups = groupByDate(events)

  return (
    <section aria-label="Event timeline">
      <h2 className="text-[13px] font-medium text-foreground mb-3">Event Timeline</h2>

      <div className="max-h-[500px] overflow-y-auto">
        {[...groups.entries()].map(([label, groupEvents]) => (
          <div key={label} className="mb-4 last:mb-0">
            {/* Date divider */}
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="divide-y divide-border">
              {groupEvents.map((event) => {
                const summary = payloadOneLiner(event.payload)
                const actorLabel = ACTOR_LABELS[event.actor_type] ?? 'System'

                return (
                  <div key={event.id} className="flex items-start gap-3 py-2 px-1">
                    {/* Time gutter */}
                    <time
                      dateTime={event.occurred_at}
                      title={event.occurred_at}
                      className="shrink-0 w-12 text-[12px] text-muted-foreground tabular-nums pt-0.5"
                    >
                      {formatTime(event.occurred_at)}
                    </time>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn(
                          'inline-flex items-center rounded-full bg-muted text-foreground px-2 py-0.5 text-[11px] font-medium'
                        )}>
                          {event.type}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{actorLabel}</span>
                      </div>

                      {/* Payload summary */}
                      {summary && (
                        <p className="mt-0.5 text-[12px] text-muted-foreground truncate">
                          {summary}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
