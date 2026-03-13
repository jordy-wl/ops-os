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
      <span className="inline-flex items-center gap-1.5 text-[11px] text-success">
        <span className="w-2 h-2 rounded-full bg-success" />
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
            'inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full',
            'bg-destructive/10 text-destructive'
          )}
          title={`Overdue by ${Math.round(step.overdueByHours)}h`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
          {step.stepName.replace(/_/g, ' ')} overdue
        </span>
      ))}

      {/* Skipped badges */}
      {gapAnalysis.skippedSteps.map((step) => (
        <span
          key={`skipped-${step.stepIndex}`}
          className={cn(
            'inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full',
            'bg-muted text-muted-foreground'
          )}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
          {step.stepName.replace(/_/g, ' ')} skipped
        </span>
      ))}

      {/* Out-of-order badges */}
      {gapAnalysis.outOfOrderSteps.map((step) => (
        <span
          key={`ooo-${step.stepIndex}`}
          className={cn(
            'inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full',
            'bg-warning/10 text-warning'
          )}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-warning" />
          {step.stepName.replace(/_/g, ' ')} out of order
        </span>
      ))}
    </div>
  )
}

function HealthBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? 'bg-success/10 text-success'
      : score >= 50
        ? 'bg-warning/10 text-warning'
        : 'bg-destructive/10 text-destructive'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full',
        color
      )}
    >
      Health: {score}/100
    </span>
  )
}
