'use client'

/**
 * RiskMatrix — grid for configuring routing mode and confidence threshold
 * per risk level (low, medium, high, critical).
 *
 * Each row: risk level label, routing mode dropdown, threshold input (0-1).
 */

import type { RoutingMode, RiskLevel, RiskRoutingEntry } from '@/lib/routing/types'
import { RISK_LEVELS, ROUTING_MODES } from '@/lib/routing/types'

interface RiskMatrixProps {
  value: Record<string, RiskRoutingEntry>
  onChange: (value: Record<string, RiskRoutingEntry>) => void
}

const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

const RISK_COLORS: Record<RiskLevel, string> = {
  low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

const MODE_LABELS: Record<RoutingMode, string> = {
  human_only: 'Human Only',
  ai_only: 'AI Only',
  hybrid: 'Hybrid',
  escalation_chain: 'Escalation Chain',
}

/** Routing modes available for risk matrix cells. */
const SELECTABLE_MODES: RoutingMode[] = ['human_only', 'ai_only', 'hybrid']

export function RiskMatrix({ value, onChange }: RiskMatrixProps) {
  function handleModeChange(level: RiskLevel, mode: RoutingMode) {
    onChange({
      ...value,
      [level]: { ...getEntry(level), mode },
    })
  }

  function handleThresholdChange(level: RiskLevel, threshold: number) {
    onChange({
      ...value,
      [level]: { ...getEntry(level), threshold },
    })
  }

  function getEntry(level: RiskLevel): RiskRoutingEntry {
    return value[level] ?? { mode: 'human_only' as RoutingMode, threshold: 0.8 }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground">
        Risk-Based Routing
      </label>
      <p className="text-xs text-muted-foreground mb-3">
        Configure how tasks are routed based on their risk level. The threshold
        sets the minimum AI confidence required for agent routing at each level.
      </p>

      {/* Desktop: table layout */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm" role="grid">
          <thead>
            <tr className="border-b border-input">
              <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                Risk Level
              </th>
              <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                Routing Mode
              </th>
              <th className="text-left py-2 font-medium text-muted-foreground">
                Threshold
              </th>
            </tr>
          </thead>
          <tbody>
            {RISK_LEVELS.map((level) => {
              const entry = getEntry(level)
              return (
                <tr key={level} className="border-b border-input/50">
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${RISK_COLORS[level]}`}
                    >
                      {RISK_LABELS[level]}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <select
                      value={entry.mode}
                      onChange={(e) =>
                        handleModeChange(level, e.target.value as RoutingMode)
                      }
                      aria-label={`Routing mode for ${RISK_LABELS[level]} risk`}
                      className="w-full max-w-[200px] rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {SELECTABLE_MODES.map((m) => (
                        <option key={m} value={m}>
                          {MODE_LABELS[m]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.05}
                        value={entry.threshold}
                        onChange={(e) =>
                          handleThresholdChange(
                            level,
                            Math.min(1, Math.max(0, parseFloat(e.target.value) || 0))
                          )
                        }
                        aria-label={`Threshold for ${RISK_LABELS[level]} risk`}
                        className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground font-mono tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <div className="sm:hidden space-y-3">
        {RISK_LEVELS.map((level) => {
          const entry = getEntry(level)
          return (
            <div
              key={level}
              className="rounded-lg border border-input p-3 space-y-2"
            >
              <span
                className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${RISK_COLORS[level]}`}
              >
                {RISK_LABELS[level]}
              </span>
              <div>
                <label
                  className="block text-xs text-muted-foreground mb-1"
                  htmlFor={`risk-mode-${level}`}
                >
                  Routing Mode
                </label>
                <select
                  id={`risk-mode-${level}`}
                  value={entry.mode}
                  onChange={(e) =>
                    handleModeChange(level, e.target.value as RoutingMode)
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {SELECTABLE_MODES.map((m) => (
                    <option key={m} value={m}>
                      {MODE_LABELS[m]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  className="block text-xs text-muted-foreground mb-1"
                  htmlFor={`risk-threshold-${level}`}
                >
                  Threshold
                </label>
                <input
                  id={`risk-threshold-${level}`}
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={entry.threshold}
                  onChange={(e) =>
                    handleThresholdChange(
                      level,
                      Math.min(1, Math.max(0, parseFloat(e.target.value) || 0))
                    )
                  }
                  className="w-24 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground font-mono tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
