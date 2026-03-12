'use client'

import { cn } from '@/lib/utils'
import type { GapAnalysis } from '@/lib/ai/delta-types'

interface RiskIndicatorsProps {
  gapAnalysis: GapAnalysis
  healthScore: number
}

/**
 * RiskIndicators — colored badges for overdue, at-risk, and skipped steps.
 */
export function RiskIndicators({ gapAnalysis, healthScore }: RiskIndicatorsProps) {
  const hasRisks =
    gapAnalysis.overdueSteps.length > 0 ||
    gapAnalysis.skippedSteps.length > 0 ||
    gapAnalysis.outOfOrderSteps.length > 0

  if (!hasRisks && healthScore >= 80) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
        <span className="w-2 h-2 rounded-full bg-green-500" />
        On track
      </span>
    )
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {/* Health badge */}
      <HealthBadge score={healthScore} />

      {/* Overdue badges */}
      {gapAnalysis.overdueSteps.map((step) => (
        <span
          key={`overdue-${step.stepIndex}`}
          className={cn(
            'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full',
            'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
          )}
          title={`Overdue by ${Math.round(step.overdueByHours)}h`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          {step.stepName.replace(/_/g, ' ')} overdue
        </span>
      ))}

      {/* Skipped badges */}
      {gapAnalysis.skippedSteps.map((step) => (
        <span
          key={`skipped-${step.stepIndex}`}
          className={cn(
            'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full',
            'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
          )}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
          {step.stepName.replace(/_/g, ' ')} skipped
        </span>
      ))}

      {/* Out-of-order badges */}
      {gapAnalysis.outOfOrderSteps.map((step) => (
        <span
          key={`ooo-${step.stepIndex}`}
          className={cn(
            'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full',
            'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
          )}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          {step.stepName.replace(/_/g, ' ')} out of order
        </span>
      ))}
    </div>
  )
}

function HealthBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
      : score >= 50
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
        : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
        color
      )}
    >
      Health: {score}/100
    </span>
  )
}
