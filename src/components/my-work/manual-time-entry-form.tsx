'use client'

import { useState } from 'react'
import { DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ManualTimeEntryFormProps {
  onSaved: () => void
  onCancel: () => void
}

export function ManualTimeEntryForm({ onSaved, onCancel }: ManualTimeEntryFormProps) {
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [isBillable, setIsBillable] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const startedAt = new Date(`${date}T${startTime}:00`).toISOString()
    const endedAt = new Date(`${date}T${endTime}:00`).toISOString()

    if (new Date(endedAt) <= new Date(startedAt)) {
      setError('End time must be after start time')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          started_at: startedAt,
          ended_at: endedAt,
          is_billable: isBillable,
        }),
      })

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
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <input
          type="text"
          placeholder="What did you work on?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={cn(
            'w-full rounded-md border border-border bg-background px-2.5 py-1.5',
            'text-[13px] text-foreground placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
          )}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={cn(
            'flex-1 rounded-md border border-border bg-background px-2.5 py-1.5',
            'text-[13px] text-foreground',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
          )}
        />
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className={cn(
            'w-24 rounded-md border border-border bg-background px-2.5 py-1.5',
            'text-[13px] text-foreground',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
          )}
        />
        <span className="text-[13px] text-muted-foreground">–</span>
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className={cn(
            'w-24 rounded-md border border-border bg-background px-2.5 py-1.5',
            'text-[13px] text-foreground',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
          )}
        />
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsBillable(!isBillable)}
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium transition-colors',
            isBillable
              ? 'bg-primary/10 text-primary'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          <DollarSign className="h-3 w-3" />
          Billable
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className={cn(
              'rounded-md px-3 py-1.5 text-[12px] font-medium',
              'bg-primary text-primary-foreground hover:bg-primary/90',
              'disabled:opacity-50 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            )}
          >
            {saving ? 'Saving...' : 'Save Entry'}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-[12px] text-destructive">{error}</p>
      )}
    </form>
  )
}
