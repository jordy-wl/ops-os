'use client'

import { useMemo, useId } from 'react'
import { FieldLabel, NumberInput, SelectInput } from './form-primitives'

type TimeUnit = 'minutes' | 'hours' | 'days' | 'weeks'

interface DurationPickerProps {
  value: number // seconds
  onChange: (seconds: number) => void
  label?: string // optional label override, defaults to "Duration"
}

const UNIT_OPTIONS: { value: string; label: string }[] = [
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
]

const SECONDS_PER_UNIT: Record<TimeUnit, number> = {
  minutes: 60,
  hours: 3600,
  days: 86400,
  weeks: 604800,
}

/** Ordered largest-first so we pick the biggest unit that divides evenly. */
const DECOMPOSE_ORDER: TimeUnit[] = ['weeks', 'days', 'hours', 'minutes']

const DEFAULT_SECONDS = 3600 // 1 hour
const MIN_AMOUNT = 1
const MAX_AMOUNT = 99

/**
 * Decompose a seconds value into an amount + largest fitting unit.
 * Prefers the largest unit that divides evenly. Falls back to minutes
 * if nothing divides evenly (rounds down).
 */
function secondsToAmountUnit(seconds: number): { amount: number; unit: TimeUnit } {
  if (seconds <= 0) {
    return { amount: 1, unit: 'hours' }
  }

  for (const unit of DECOMPOSE_ORDER) {
    const factor = SECONDS_PER_UNIT[unit]
    if (seconds % factor === 0) {
      const amount = Math.floor(seconds / factor)
      if (amount >= MIN_AMOUNT && amount <= MAX_AMOUNT) {
        return { amount, unit }
      }
    }
  }

  // No unit divides evenly within 1-99 range. Try each unit and pick the
  // largest one that produces an amount in range.
  for (const unit of DECOMPOSE_ORDER) {
    const factor = SECONDS_PER_UNIT[unit]
    const amount = Math.round(seconds / factor)
    if (amount >= MIN_AMOUNT && amount <= MAX_AMOUNT) {
      return { amount, unit }
    }
  }

  // Absolute fallback: express in minutes, clamped to valid range
  const rawMinutes = Math.max(MIN_AMOUNT, Math.min(MAX_AMOUNT, Math.round(seconds / 60)))
  return { amount: rawMinutes, unit: 'minutes' }
}

function amountUnitToSeconds(amount: number, unit: TimeUnit): number {
  const clamped = Math.max(MIN_AMOUNT, Math.min(MAX_AMOUNT, Math.floor(amount)))
  return clamped * SECONDS_PER_UNIT[unit]
}

function formatSummary(amount: number, unit: TimeUnit): string {
  const unitLabel = amount === 1 ? unit.slice(0, -1) : unit // "hour" vs "hours"
  return `This step will wait ${amount} ${unitLabel}`
}

export function DurationPicker({ value, onChange, label = 'Duration' }: DurationPickerProps) {
  const reactId = useId()
  const amountId = `${reactId}-amount`
  const unitId = `${reactId}-unit`

  // Normalise: treat 0 or negative as the default
  const effectiveSeconds = value > 0 ? value : DEFAULT_SECONDS

  const { amount, unit } = useMemo(
    () => secondsToAmountUnit(effectiveSeconds),
    [effectiveSeconds],
  )

  // If the incoming value was 0 or negative, push the default upstream once
  // so parent state stays in sync.
  if (value <= 0 && effectiveSeconds !== value) {
    // Deferred to avoid calling onChange during render
    queueMicrotask(() => onChange(DEFAULT_SECONDS))
  }

  function handleAmountChange(next: number) {
    if (next < MIN_AMOUNT || next > MAX_AMOUNT) return
    onChange(amountUnitToSeconds(next, unit))
  }

  function handleUnitChange(next: string) {
    const nextUnit = next as TimeUnit
    onChange(amountUnitToSeconds(amount, nextUnit))
  }

  return (
    <div>
      <FieldLabel htmlFor={amountId}>{label}</FieldLabel>
      <div className="flex items-start gap-2">
        <div className="w-24">
          <NumberInput
            id={amountId}
            value={amount}
            onChange={handleAmountChange}
            min={MIN_AMOUNT}
            max={MAX_AMOUNT}
            placeholder="1"
          />
        </div>
        <div className="flex-1">
          <SelectInput
            id={unitId}
            value={unit}
            onChange={handleUnitChange}
            options={UNIT_OPTIONS}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        {formatSummary(amount, unit)}
      </p>
    </div>
  )
}
