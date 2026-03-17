'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CalendarWeekView } from './calendar-week-view'
import { CalendarMonthView } from './calendar-month-view'
import { CalendarEventModal } from './calendar-event-modal'

export interface CalendarEvent {
  id: string
  title: string
  description: string
  start_at: string
  end_at: string
  all_day: boolean
  source: 'local' | 'google'
  external_link: string | null
  color: string
  block_id: string | null
}

type ViewMode = 'week' | 'month'

function getWeekRange(date: Date): { from: Date; to: Date } {
  const day = (date.getDay() + 6) % 7
  const monday = new Date(date)
  monday.setDate(date.getDate() - day)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { from: monday, to: sunday }
}

function getMonthRange(date: Date): { from: Date; to: Date } {
  const from = new Date(date.getFullYear(), date.getMonth(), 1)
  const to = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
  return { from, to }
}

function formatWeekLabel(date: Date): string {
  const { from, to } = getWeekRange(date)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${from.toLocaleDateString('en-AU', opts)} – ${to.toLocaleDateString('en-AU', opts)}`
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
}

export function CalendarTab() {
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [hasGoogleConnector, setHasGoogleConnector] = useState<boolean | null>(null)

  const fetchEvents = useCallback(async () => {
    const range = viewMode === 'week' ? getWeekRange(currentDate) : getMonthRange(currentDate)
    try {
      const params = new URLSearchParams({
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      })
      // Fetch calendar events + task deadlines in parallel (FE-04)
      const [eventsRes, deadlinesRes] = await Promise.all([
        fetch(`/api/calendar-events?${params}`),
        fetch('/api/blocks?type=task_queue_item&limit=100'),
      ])

      const calEvents: CalendarEvent[] = eventsRes.ok ? (await eventsRes.json()).data ?? [] : []

      // Convert task deadlines to calendar event markers
      if (deadlinesRes.ok) {
        const { data: tasks } = await deadlinesRes.json()
        for (const task of tasks ?? []) {
          const meta = (task.metadata ?? {}) as Record<string, unknown>
          const deadline = meta.deadline as string | undefined
          if (!deadline) continue
          const dl = new Date(deadline)
          if (dl >= range.from && dl <= range.to) {
            calEvents.push({
              id: `deadline-${task.id}`,
              title: `Deadline: ${task.name}`,
              description: 'Task deadline',
              start_at: deadline,
              end_at: deadline,
              all_day: true,
              source: 'local',
              external_link: null,
              color: 'red',
              block_id: task.id,
            })
          }
        }
      }

      setEvents(calEvents)
    } catch {
      // Non-critical
    } finally {
      setLoading(false)
    }
  }, [viewMode, currentDate])

  // Check if Google connector exists
  useEffect(() => {
    async function checkConnector() {
      try {
        const res = await fetch('/api/integrations')
        if (!res.ok) return
        const { data } = await res.json()
        const hasGoogle = (data ?? []).some(
          (c: Record<string, unknown>) => c.provider === 'google' && c.status === 'active'
        )
        setHasGoogleConnector(hasGoogle)
      } catch {
        setHasGoogleConnector(false)
      }
    }
    checkConnector()
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const navigate = (direction: -1 | 1) => {
    const next = new Date(currentDate)
    if (viewMode === 'week') {
      next.setDate(next.getDate() + direction * 7)
    } else {
      next.setMonth(next.getMonth() + direction)
    }
    setCurrentDate(next)
  }

  const goToday = () => setCurrentDate(new Date())

  const handleSync = async () => {
    setSyncing(true)
    try {
      // Find Google connector
      const intRes = await fetch('/api/integrations')
      if (!intRes.ok) return
      const { data: connectors } = await intRes.json()
      const google = (connectors ?? []).find(
        (c: Record<string, unknown>) => c.provider === 'google' && c.status === 'active'
      )
      if (!google) return

      await fetch('/api/calendar-events/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connector_id: google.id }),
      })
      await fetchEvents()
    } catch {
      // Best-effort
    } finally {
      setSyncing(false)
    }
  }

  const handleEventClick = (event: CalendarEvent) => {
    if (event.source === 'google' && event.external_link) {
      window.open(event.external_link, '_blank')
    } else {
      setEditEvent(event)
      setShowModal(true)
    }
  }

  const handleSaved = () => {
    setShowModal(false)
    setEditEvent(null)
    fetchEvents()
  }

  // Connect Google Calendar CTA (FE-05)
  if (hasGoogleConnector === false) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <svg className="h-8 w-8 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </div>
        <h3 className="text-[15px] font-semibold text-foreground mb-1">Connect Google Calendar</h3>
        <p className="text-[13px] text-muted-foreground mb-4 max-w-xs">
          Sync your Google Calendar events to see meetings, deadlines, and milestones alongside your work.
        </p>
        <a
          href="/api/auth/google"
          className={cn(
            'inline-flex items-center gap-2 rounded-md px-4 py-2',
            'bg-primary text-primary-foreground text-[13px] font-medium',
            'hover:bg-primary/90 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
        >
          Connect Google Calendar
        </a>
        <button
          onClick={() => setHasGoogleConnector(true)}
          className="mt-3 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip — use local events only
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Calendar Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <button
          onClick={() => navigate(-1)}
          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Previous"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => navigate(1)}
          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Next"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="text-[13px] font-medium text-foreground">
          {viewMode === 'week' ? formatWeekLabel(currentDate) : formatMonthLabel(currentDate)}
        </span>
        <button
          onClick={goToday}
          className="rounded-md px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground border border-border transition-colors"
        >
          Today
        </button>

        <div className="ml-auto flex items-center gap-1">
          {hasGoogleConnector && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              aria-label="Sync Google Calendar"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', syncing && 'animate-spin')} />
            </button>
          )}
          <button
            onClick={() => { setEditEvent(null); setShowModal(true) }}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2 py-1',
              'text-[12px] font-medium bg-primary text-primary-foreground',
              'hover:bg-primary/90 transition-colors'
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            Event
          </button>
          <div className="flex rounded-md border border-border overflow-hidden ml-1">
            {(['week', 'month'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  'px-2 py-0.5 text-[11px] font-medium transition-colors capitalize',
                  viewMode === mode
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-[13px] text-muted-foreground">
          Loading calendar...
        </div>
      ) : viewMode === 'week' ? (
        <CalendarWeekView
          events={events}
          currentDate={currentDate}
          onEventClick={handleEventClick}
        />
      ) : (
        <CalendarMonthView
          events={events}
          currentDate={currentDate}
          onEventClick={handleEventClick}
        />
      )}

      {/* Event Modal */}
      {showModal && (
        <CalendarEventModal
          event={editEvent}
          onSaved={handleSaved}
          onClose={() => { setShowModal(false); setEditEvent(null) }}
        />
      )}
    </div>
  )
}
