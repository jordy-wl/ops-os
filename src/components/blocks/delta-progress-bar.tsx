'use client'

import { cn } from '@/lib/utils'
import type { StepDelta } from '@/lib/ai/delta-types'

interface DeltaProgressBarProps {
  steps: StepDelta[]
  currentStepIndex: number
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-500',
  in_progress: 'bg-blue-500',
  pending: 'bg-muted',
  failed: 'bg-red-500',
  overdue: 'bg-amber-500',
  skipped: 'bg-gray-400',
}

const STATUS_LABELS: Record<string, string> = {
  completed: 'Completed',
  in_progress: 'In progress',
  pending: 'Pending',
  failed: 'Failed',
  overdue: 'Overdue',
  skipped: 'Skipped',
}

/**
 * DeltaProgressBar — visual progress indicator with step markers.
 * Each step is a segment colored by its status.
 */
export function DeltaProgressBar({ steps, currentStepIndex }: DeltaProgressBarProps) {
  if (steps.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">No steps defined</div>
    )
  }

  const completedCount = steps.filter(
    (s) => s.status === 'completed'
  ).length
  const percentage = Math.round((completedCount / steps.length) * 100)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Step {Math.min(currentStepIndex + 1, steps.length)} of {steps.length}
        </span>
        <span className="font-medium text-foreground">{percentage}%</span>
      </div>

      {/* Progress bar segments */}
      <div className="flex gap-0.5 h-2 rounded-full overflow-hidden">
        {steps.map((step) => (
          <div
            key={step.stepIndex}
            className={cn(
              'flex-1 transition-colors',
              STATUS_COLORS[step.status] ?? 'bg-muted'
            )}
            title={`${step.stepName}: ${STATUS_LABELS[step.status] ?? step.status}`}
          />
        ))}
      </div>

      {/* Step markers */}
      <div className="flex gap-1 flex-wrap">
        {steps.map((step) => (
          <span
            key={step.stepIndex}
            className={cn(
              'inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded',
              step.stepIndex === currentStepIndex
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 font-medium'
                : 'text-muted-foreground'
            )}
          >
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                STATUS_COLORS[step.status] ?? 'bg-muted'
              )}
            />
            {step.stepName.replace(/_/g, ' ')}
          </span>
        ))}
      </div>
    </div>
  )
}
