'use client'

import { useCallback, useEffect, useState } from 'react'
import { Clock, DollarSign, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ManualTimeEntryForm } from './manual-time-entry-form'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TimeEntry {
  id: string
  block_id: string | null
  description: string
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  is_billable: boolean
}

interface DaySummary {
  date: string
  label: string
  totalSeconds: number
  billableSeconds: number
  entries: TimeEntry[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getWeekDates(): { from: string; to: string } {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((day + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { from: monday.toISOString(), to: sunday.toISOString() }
}

function groupByDay(entries: TimeEntry[]): DaySummary[] {
  const grouped = new Map<string, TimeEntry[]>()
  for (const entry of entries) {
    const date = new Date(entry.started_at).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const existing = grouped.get(date) ?? []
    existing.push(entry)
    grouped.set(date, existing)
  }

  const days: DaySummary[] = []
  for (const [date, dayEntries] of grouped) {
    const totalSeconds = dayEntries.reduce((sum, e) => sum + (e.duration_seconds ?? 0), 0)
    const billableSeconds = dayEntries
      .filter((e) => e.is_billable)
      .reduce((sum, e) => sum + (e.duration_seconds ?? 0), 0)

    const d = new Date(dayEntries[0].started_at)
    const label = d.toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' })

    days.push({ date, label, totalSeconds, billableSeconds, entries: dayEntries })
  }

  return days
}

// ─── Week Summary Bar Chart ─────────────────────────────────────────────────

function WeekBarChart({ days }: { days: DaySummary[] }) {
  const maxSeconds = Math.max(...days.map((d) => d.totalSeconds), 1)
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  // Build full week with zeros for missing days
  const now = new Date()
  const dayOfWeek = (now.getDay() + 6) % 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - dayOfWeek)
  monday.setHours(0, 0, 0, 0)

  const fullWeek = weekDays.map((label, i) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + i)
    const dateStr = date.toLocaleDateString('en-AU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const day = days.find((d) => d.date === dateStr)
    return {
      label,
      totalSeconds: day?.totalSeconds ?? 0,
      billableSeconds: day?.billableSeconds ?? 0,
    }
  })

  return (
    <div className="flex items-end gap-1.5 h-24 px-1">
      {fullWeek.map((day) => {
        const height = maxSeconds > 0 ? Math.max((day.totalSeconds / maxSeconds) * 100, 2) : 2
        const billableHeight =
          day.totalSeconds > 0
            ? (day.billableSeconds / day.totalSeconds) * height
            : 0

        return (
          <div key={day.label} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full relative" style={{ height: '80px' }}>
              <div className="absolute bottom-0 w-full flex flex-col">
                <div
                  className="w-full rounded-t bg-primary/20"
                  style={{ height: `${height * 0.8}px` }}
                />
                {billableHeight > 0 && (
                  <div
                    className="w-full rounded-t bg-primary absolute bottom-0"
                    style={{ height: `${billableHeight * 0.8}px` }}
                  />
                )}
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground">{day.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function TimeTab() {
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const fetchEntries = useCallback(async () => {
    try {
      const { from, to } = getWeekDates()
      const params = new URLSearchParams({ from, to, limit: '200' })
      const res = await fetch(`/api/time-entries?${params}`)
      if (!res.ok) return
      const { data } = await res.json()
      setEntries(data ?? [])
    } catch {
      // Non-critical
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-[13px] text-muted-foreground">
        Loading time entries...
      </div>
    )
  }

  const days = groupByDay(entries.filter((e) => e.ended_at))
  const weekTotal = entries
    .filter((e) => e.ended_at)
    .reduce((sum, e) => sum + (e.duration_seconds ?? 0), 0)
  const weekBillable = entries
    .filter((e) => e.ended_at && e.is_billable)
    .reduce((sum, e) => sum + (e.duration_seconds ?? 0), 0)

  return (
    <div>
      {/* Week Summary */}
      <div className="px-3 py-3 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-[13px] font-medium text-foreground">This Week</span>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[12px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> {formatDuration(weekTotal)} total
              </span>
              <span className="text-[12px] text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> {formatDuration(weekBillable)} billable
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5',
              'text-[12px] font-medium bg-primary text-primary-foreground',
              'hover:bg-primary/90 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Entry
          </button>
        </div>
        <WeekBarChart days={days} />
      </div>

      {/* Manual Entry Form */}
      {showForm && (
        <div className="px-3 py-3 border-b border-border bg-muted/30">
          <ManualTimeEntryForm
            onSaved={() => {
              setShowForm(false)
              fetchEntries()
            }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Daily Entries List */}
      {days.length === 0 && !showForm ? (
        <div className="text-center py-10 text-[13px] text-muted-foreground">
          No time tracked this week. Start the timer or add a manual entry.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {days.map((day) => (
            <div key={day.date}>
              <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
                <span className="text-[12px] font-medium text-foreground">{day.label}</span>
                <span className="text-[12px] text-muted-foreground tabular-nums">
                  {formatDuration(day.totalSeconds)}
                </span>
              </div>
              <div className="divide-y divide-border/50">
                {day.entries.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-2 px-3 py-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-[13px] text-foreground flex-1 min-w-0 truncate">
                      {entry.description || 'Untitled'}
                    </span>
                    {entry.is_billable && (
                      <DollarSign className="h-3 w-3 text-primary shrink-0" />
                    )}
                    <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                      {formatTime(entry.started_at)}
                      {entry.ended_at ? ` – ${formatTime(entry.ended_at)}` : ' (running)'}
                    </span>
                    <span className="text-[12px] font-medium text-foreground tabular-nums shrink-0 w-14 text-right">
                      {entry.duration_seconds ? formatDuration(entry.duration_seconds) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
