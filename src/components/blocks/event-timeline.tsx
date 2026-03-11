import { cn } from '@/lib/utils'
import type { Event } from '@/lib/context-assembly'

interface EventTimelineProps {
  events: Event[]
}

// ─── Badge colours by event category ────────────────────────────────────────

const BADGE_STYLES: Record<string, string> = {
  workflow: 'bg-blue-100 text-blue-800',
  onboarding: 'bg-blue-100 text-blue-800',
  action: 'bg-green-100 text-green-800',
  block: 'bg-green-100 text-green-800',
  ai: 'bg-purple-100 text-purple-800',
  system: 'bg-gray-100 text-gray-700',
}

function getBadgeStyle(event: Event): string {
  if (event.actor_type === 'ai') return BADGE_STYLES.ai
  const prefix = event.type.split('.')[0]
  return BADGE_STYLES[prefix] ?? BADGE_STYLES.system
}

// ─── Actor icons ────────────────────────────────────────────────────────────

const ACTOR_ICONS: Record<string, { icon: string; label: string }> = {
  human:  { icon: '\u{1F464}', label: 'User action' },
  ai:     { icon: '\u2726',    label: 'AI action' },
  system: { icon: '\u2699\uFE0F',    label: 'System action' },
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
        <h2 className="text-sm font-semibold text-foreground mb-3">Event Timeline</h2>
        <p className="text-sm text-muted-foreground italic py-4 text-center">
          No events recorded yet.
        </p>
      </section>
    )
  }

  const groups = groupByDate(events)

  return (
    <section aria-label="Event timeline">
      <h2 className="text-sm font-semibold text-foreground mb-3">Event Timeline</h2>

      <div className="space-y-4">
        {[...groups.entries()].map(([label, groupEvents]) => (
          <div key={label}>
            {/* Date divider */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-muted-foreground">{label}</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <ol className="relative border-l border-border ml-3 space-y-3">
              {groupEvents.map((event) => {
                const summary = payloadOneLiner(event.payload)
                const badgeStyle = getBadgeStyle(event)
                const actorInfo = ACTOR_ICONS[event.actor_type] ?? ACTOR_ICONS.system

                return (
                  <li key={event.id} className="ml-4 pl-4">
                    {/* Timeline dot — coloured by category */}
                    <span
                      className={cn(
                        'absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-background',
                        event.actor_type === 'ai' ? 'bg-purple-400' :
                        event.type.startsWith('workflow') || event.type.startsWith('onboarding') ? 'bg-blue-400' :
                        event.type.startsWith('block') || event.type.startsWith('action') ? 'bg-green-400' :
                        'bg-muted-foreground'
                      )}
                      aria-hidden="true"
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Type badge */}
                      <span className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        badgeStyle
                      )}>
                        {event.type}
                      </span>

                      {/* Actor icon */}
                      <span
                        className="text-xs"
                        title={actorInfo.label}
                        aria-label={actorInfo.label}
                      >
                        {actorInfo.icon}
                      </span>

                      {/* Timestamp */}
                      <time
                        dateTime={event.occurred_at}
                        title={event.occurred_at}
                        className="ml-auto text-xs text-muted-foreground shrink-0"
                      >
                        {formatTime(event.occurred_at)}
                      </time>
                    </div>

                    {/* Payload summary */}
                    {summary && (
                      <p className="mt-1 text-xs text-muted-foreground truncate">
                        {summary}
                      </p>
                    )}
                  </li>
                )
              })}
            </ol>
          </div>
        ))}
      </div>
    </section>
  )
}
