'use client'

import { cn } from '@/lib/utils'
import type { FieldComponentProps } from './field-props'

const CURRENCY_SYMBOLS: Record<string, string> = {
  AUD: 'A$', USD: '$', GBP: '£', EUR: '€', SGD: 'S$', HKD: 'HK$',
  NZD: 'NZ$', JPY: '¥', CAD: 'C$', CHF: 'CHF',
}

export function CurrencyField({ name, value, onChange, fieldDef, mode, required }: FieldComponentProps) {
  const label = (fieldDef.description as string) ?? name.replace(/_/g, ' ')
  const id = `field-${name}`
  const currencyCode = (fieldDef['x-currency-code'] as string) ?? 'AUD'
  const symbol = CURRENCY_SYMBOLS[currencyCode] ?? currencyCode

  if (mode === 'view') {
    if (value == null) return <span className="text-sm text-muted-foreground">—</span>
    return (
      <span className="text-sm font-medium text-foreground tabular-nums">
        {symbol}{Number(value).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    )
  }

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-muted-foreground mb-1 capitalize">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{symbol}</span>
        <input
          id={id}
          type="number"
          min={0}
          step="0.01"
          value={value != null ? String(value) : ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
          placeholder="0.00"
          className={cn(
            'w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm tabular-nums',
            'focus:outline-none focus:ring-2 focus:ring-ring'
          )}
        />
      </div>
    </div>
  )
}
