'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CalendarEvent } from './calendar-tab'

interface CalendarEventModalProps {
  event: CalendarEvent | null
  onSaved: () => void
  onClose: () => void
}

const COLORS = [
  { value: 'primary', label: 'Indigo' },
  { value: 'blue', label: 'Blue' },
  { value: 'green', label: 'Green' },
  { value: 'red', label: 'Red' },
  { value: 'orange', label: 'Orange' },
]

const COLOR_SWATCHES: Record<string, string> = {
  primary: 'bg-primary',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  red: 'bg-red-500',
  orange: 'bg-orange-500',
}

function toDateTimeLocal(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function CalendarEventModal({ event, onSaved, onClose }: CalendarEventModalProps) {
  const isEditing = !!event

  const now = new Date()
  const defaultStart = toDateTimeLocal(now.toISOString())
  const defaultEnd = toDateTimeLocal(new Date(now.getTime() + 60 * 60 * 1000).toISOString())

  const [title, setTitle] = useState(event?.title ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [startAt, setStartAt] = useState(event ? toDateTimeLocal(event.start_at) : defaultStart)
  const [endAt, setEndAt] = useState(event ? toDateTimeLocal(event.end_at) : defaultEnd)
  const [allDay, setAllDay] = useState(event?.all_day ?? false)
  const [color, setColor] = useState(event?.color ?? 'primary')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!title.trim()) {
      setError('Title is required')
      return
    }

    const startIso = new Date(startAt).toISOString()
    const endIso = new Date(endAt).toISOString()

    if (new Date(endIso) <= new Date(startIso)) {
      setError('End must be after start')
      return
    }

    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        start_at: startIso,
        end_at: endIso,
        all_day: allDay,
        color,
      }

      let res: Response
      if (isEditing) {
        res = await fetch(`/api/calendar-events?id=${event!.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch('/api/calendar-events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (!res.ok) {
        const { error: apiErr } = await res.json()
        setError(apiErr?.message ?? 'Failed to save')
        return
      }

      onSaved()
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-[14px] font-semibold text-foreground">
            {isEditing ? 'Edit Event' : 'New Event'}
          </h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-4 py-3 space-y-3">
          <input
            type="text"
            placeholder="Event title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            className={cn(
              'w-full rounded-md border border-border bg-background px-2.5 py-2',
              'text-[14px] text-foreground placeholder:text-muted-foreground',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
            )}
          />

          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={cn(
              'w-full rounded-md border border-border bg-background px-2.5 py-2',
              'text-[13px] text-foreground placeholder:text-muted-foreground resize-none',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
            )}
          />

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="rounded border-border"
              />
              All day
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Start</label>
              <input
                type={allDay ? 'date' : 'datetime-local'}
                value={allDay ? startAt.slice(0, 10) : startAt}
                onChange={(e) => setStartAt(allDay ? `${e.target.value}T00:00` : e.target.value)}
                className={cn(
                  'w-full rounded-md border border-border bg-background px-2.5 py-1.5',
                  'text-[13px] text-foreground',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
                )}
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">End</label>
              <input
                type={allDay ? 'date' : 'datetime-local'}
                value={allDay ? endAt.slice(0, 10) : endAt}
                onChange={(e) => setEndAt(allDay ? `${e.target.value}T23:59` : e.target.value)}
                className={cn(
                  'w-full rounded-md border border-border bg-background px-2.5 py-1.5',
                  'text-[13px] text-foreground',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
                )}
              />
            </div>
          </div>

          {/* Color picker */}
          <div>
            <label className="text-[11px] text-muted-foreground block mb-1">Color</label>
            <div className="flex items-center gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={cn(
                    'w-6 h-6 rounded-full transition-all',
                    COLOR_SWATCHES[c.value],
                    color === c.value ? 'ring-2 ring-offset-2 ring-ring' : 'opacity-60 hover:opacity-100'
                  )}
                  aria-label={c.label}
                />
              ))}
            </div>
          </div>

          {error && (
            <p className="text-[12px] text-destructive">{error}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={cn(
                'rounded-md px-4 py-1.5 text-[12px] font-medium',
                'bg-primary text-primary-foreground hover:bg-primary/90',
                'disabled:opacity-50 transition-colors'
              )}
            >
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
