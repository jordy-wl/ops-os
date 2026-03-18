'use client'

import { FieldLabel, SelectInput, NumberInput } from './form-primitives'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScheduleValue {
  preset?: string
  frequency?: number
  unit?: 'minutes' | 'hours' | 'days' | 'weeks'
  time?: string
  dayOfWeek?: number
  dayOfMonth?: number
  timezone?: string
}

export interface ScheduleConfigProps {
  value: ScheduleValue
  onChange: (value: ScheduleValue) => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRESETS: { value: string; label: string; description: string }[] = [
  { value: 'every_hour', label: 'Every hour', description: 'Runs at the start of every hour' },
  { value: 'every_day', label: 'Every day at...', description: 'Runs once per day at a specific time' },
  { value: 'every_week', label: 'Every week on...', description: 'Runs once per week on a specific day' },
  { value: 'every_month', label: 'Every month on...', description: 'Runs once per month on a specific date' },
  { value: 'every_quarter', label: 'Every quarter', description: 'Runs on the 1st of Jan, Apr, Jul, Oct' },
  { value: 'custom', label: 'Custom interval', description: 'Set a custom frequency' },
]

const TIMEZONES: { value: string; label: string }[] = [
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEST/AEDT)' },
  { value: 'Australia/Brisbane', label: 'Brisbane (AEST)' },
  { value: 'Australia/Perth', label: 'Perth (AWST)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'America/Chicago', label: 'Chicago (CST/CDT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
  { value: 'UTC', label: 'UTC' },
]

const DAYS_OF_WEEK: { value: string; label: string }[] = [
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
  { value: '0', label: 'Sunday' },
]

const UNIT_OPTIONS: { value: string; label: string }[] = [
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
]

const DAY_OF_MONTH_OPTIONS: { value: string; label: string }[] = Array.from(
  { length: 31 },
  (_, i) => {
    const day = i + 1
    const suffix = ordinalSuffix(day)
    return { value: String(day), label: `${day}${suffix}` }
  },
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ordinalSuffix(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return 'th'
  if (mod10 === 1) return 'st'
  if (mod10 === 2) return 'nd'
  if (mod10 === 3) return 'rd'
  return 'th'
}

function formatTime12h(time24: string): string {
  const [hoursStr, minutesStr] = time24.split(':')
  const hours = parseInt(hoursStr, 10)
  const minutes = minutesStr ?? '00'
  if (isNaN(hours)) return time24
  const period = hours >= 12 ? 'PM' : 'AM'
  const display = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  return `${display}:${minutes} ${period}`
}

function dayOfWeekLabel(dow: number): string {
  const match = DAYS_OF_WEEK.find((d) => d.value === String(dow))
  return match?.label ?? 'day'
}

function dayOfMonthLabel(dom: number): string {
  return `${dom}${ordinalSuffix(dom)}`
}

function buildSummary(value: ScheduleValue): string {
  const preset = value.preset ?? 'every_hour'
  const time = value.time ? formatTime12h(value.time) : null

  switch (preset) {
    case 'every_hour':
      return 'Runs every hour'

    case 'every_day':
      return time ? `Runs every day at ${time}` : 'Runs every day'

    case 'every_week': {
      const dow = value.dayOfWeek != null ? dayOfWeekLabel(value.dayOfWeek) : 'Monday'
      return time ? `Runs every ${dow} at ${time}` : `Runs every ${dow}`
    }

    case 'every_month': {
      const dom = value.dayOfMonth != null ? dayOfMonthLabel(value.dayOfMonth) : '1st'
      return time
        ? `Runs on the ${dom} of every month at ${time}`
        : `Runs on the ${dom} of every month`
    }

    case 'every_quarter':
      return time
        ? `Runs quarterly on the 1st at ${time}`
        : 'Runs quarterly on the 1st'

    case 'custom': {
      const freq = value.frequency ?? 1
      const unit = value.unit ?? 'hours'
      const unitLabel = freq === 1 ? unit.slice(0, -1) : unit
      const base = `Runs every ${freq} ${unitLabel}`
      if ((unit === 'days' || unit === 'weeks') && time) {
        return `${base} at ${time}`
      }
      return base
    }

    default:
      return 'Schedule not configured'
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ScheduleConfig({ value, onChange }: ScheduleConfigProps) {
  const preset = value.preset ?? 'every_hour'
  const timezone = value.timezone ?? 'Australia/Sydney'

  const selectedPreset = PRESETS.find((p) => p.value === preset)

  function patch(partial: Partial<ScheduleValue>) {
    onChange({ ...value, ...partial })
  }

  function handlePresetChange(next: string) {
    // Reset conditional fields when switching presets to avoid stale data
    const reset: ScheduleValue = {
      preset: next,
      timezone,
    }
    if (next === 'every_day') {
      reset.time = value.time ?? '09:00'
    } else if (next === 'every_week') {
      reset.dayOfWeek = value.dayOfWeek ?? 1
      reset.time = value.time ?? '09:00'
    } else if (next === 'every_month') {
      reset.dayOfMonth = value.dayOfMonth ?? 1
      reset.time = value.time ?? '09:00'
    } else if (next === 'every_quarter') {
      reset.time = value.time ?? '09:00'
    } else if (next === 'custom') {
      reset.frequency = value.frequency ?? 1
      reset.unit = value.unit ?? 'hours'
      if (value.unit === 'days' || value.unit === 'weeks') {
        reset.time = value.time ?? '09:00'
      }
    }
    onChange(reset)
  }

  const showTimePicker =
    preset === 'every_day' ||
    preset === 'every_week' ||
    preset === 'every_month' ||
    preset === 'every_quarter' ||
    (preset === 'custom' && (value.unit === 'days' || value.unit === 'weeks'))

  return (
    <div className="space-y-3">
      {/* ---- Preset selector ---- */}
      <div>
        <FieldLabel htmlFor="schedule-preset">Schedule</FieldLabel>
        <SelectInput
          id="schedule-preset"
          value={preset}
          onChange={handlePresetChange}
          options={PRESETS.map((p) => ({ value: p.value, label: p.label }))}
        />
        {selectedPreset && (
          <p className="text-xs text-muted-foreground mt-1">{selectedPreset.description}</p>
        )}
      </div>

      {/* ---- Day of week (every_week) ---- */}
      {preset === 'every_week' && (
        <div>
          <FieldLabel htmlFor="schedule-dow">Day of Week</FieldLabel>
          <SelectInput
            id="schedule-dow"
            value={String(value.dayOfWeek ?? 1)}
            onChange={(v) => patch({ dayOfWeek: parseInt(v, 10) })}
            options={DAYS_OF_WEEK}
          />
        </div>
      )}

      {/* ---- Day of month (every_month) ---- */}
      {preset === 'every_month' && (
        <div>
          <FieldLabel htmlFor="schedule-dom">Day of Month</FieldLabel>
          <SelectInput
            id="schedule-dom"
            value={String(value.dayOfMonth ?? 1)}
            onChange={(v) => patch({ dayOfMonth: parseInt(v, 10) })}
            options={DAY_OF_MONTH_OPTIONS}
          />
        </div>
      )}

      {/* ---- Custom interval (frequency + unit) ---- */}
      {preset === 'custom' && (
        <div>
          <FieldLabel htmlFor="schedule-freq">Repeat every</FieldLabel>
          <div className="flex items-start gap-2">
            <div className="w-24">
              <NumberInput
                id="schedule-freq"
                value={value.frequency ?? 1}
                onChange={(v) => patch({ frequency: Math.max(1, v) })}
                min={1}
                max={999}
                placeholder="1"
              />
            </div>
            <div className="flex-1">
              <SelectInput
                id="schedule-unit"
                value={value.unit ?? 'hours'}
                onChange={(v) => {
                  const unit = v as ScheduleValue['unit']
                  const updates: Partial<ScheduleValue> = { unit }
                  // Add or remove time field based on the new unit
                  if (unit === 'days' || unit === 'weeks') {
                    updates.time = value.time ?? '09:00'
                  } else {
                    updates.time = undefined
                  }
                  patch(updates)
                }}
                options={UNIT_OPTIONS}
              />
            </div>
          </div>
        </div>
      )}

      {/* ---- Time picker ---- */}
      {showTimePicker && (
        <div>
          <FieldLabel htmlFor="schedule-time">Time</FieldLabel>
          <input
            id="schedule-time"
            type="time"
            value={value.time ?? '09:00'}
            onChange={(e) => patch({ time: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Schedule time"
          />
        </div>
      )}

      {/* ---- Human-readable summary ---- */}
      <p className="text-xs text-muted-foreground mt-2 italic">{buildSummary(value)}</p>

      {/* ---- Timezone (always shown) ---- */}
      <div>
        <FieldLabel htmlFor="schedule-tz">Timezone</FieldLabel>
        <SelectInput
          id="schedule-tz"
          value={timezone}
          onChange={(v) => patch({ timezone: v })}
          options={TIMEZONES}
        />
      </div>
    </div>
  )
}
