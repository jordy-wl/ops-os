'use client'

/**
 * ConfidenceSlider — range input for AI confidence threshold.
 *
 * Range: 0 to 1, step 0.05.
 * Labeled breakpoints at 0.3 (Low), 0.6 (Medium), 0.8 (High).
 * Displays the current value as text.
 */

interface ConfidenceSliderProps {
  value: number
  onChange: (value: number) => void
  id?: string
}

const BREAKPOINTS = [
  { value: 0.3, label: 'Low' },
  { value: 0.6, label: 'Medium' },
  { value: 0.8, label: 'High' },
] as const

export function ConfidenceSlider({
  value,
  onChange,
  id = 'confidence-threshold',
}: ConfidenceSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="block text-sm font-medium text-foreground"
        >
          Confidence Threshold
        </label>
        <span
          className="text-sm font-mono tabular-nums text-foreground"
          aria-live="polite"
        >
          {value.toFixed(2)}
        </span>
      </div>

      <input
        id={id}
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-muted accent-primary"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={value}
        aria-valuetext={`${value.toFixed(2)} confidence threshold`}
      />

      <div className="relative w-full h-5" aria-hidden="true">
        {BREAKPOINTS.map((bp) => (
          <span
            key={bp.value}
            className="absolute text-xs text-muted-foreground -translate-x-1/2"
            style={{ left: `${bp.value * 100}%` }}
          >
            {bp.value} {bp.label}
          </span>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Tasks with AI confidence below this threshold will be routed to humans.
      </p>
    </div>
  )
}
