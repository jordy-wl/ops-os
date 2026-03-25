'use client'

import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WIZARD_STEPS, type WizardStep } from './wizard-types'

interface WizardChromeProps {
  currentStep: WizardStep
  completedSteps: Set<number>
  canAdvance: boolean
  creating: boolean
  onStepClick: (step: WizardStep) => void
  onBack: () => void
  onNext: () => void
  onSkip: () => void
  children: React.ReactNode
}

export function WizardChrome({
  currentStep,
  completedSteps,
  canAdvance,
  creating,
  onStepClick,
  onBack,
  onNext,
  onSkip,
  children,
}: WizardChromeProps) {
  return (
    <div className="space-y-8">
      {/* Step indicator */}
      <nav aria-label="Portal creation progress">
        {/* Desktop: full step indicators */}
        <ol className="hidden sm:flex items-center gap-0">
          {WIZARD_STEPS.map(({ step, label }, idx) => {
            const isCompleted = completedSteps.has(step)
            const isCurrent = currentStep === step
            const isClickable = isCompleted || step < currentStep

            return (
              <li key={step} className="flex items-center flex-1 last:flex-initial">
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick(step)}
                  disabled={!isClickable && !isCurrent}
                  className={`flex items-center gap-2 group ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  <span
                    className={`
                      flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors
                      ${isCurrent ? 'bg-primary text-primary-foreground' : ''}
                      ${isCompleted && !isCurrent ? 'bg-primary/10 text-primary' : ''}
                      ${!isCurrent && !isCompleted ? 'bg-muted text-muted-foreground' : ''}
                      ${isClickable ? 'group-hover:ring-2 group-hover:ring-ring/30' : ''}
                    `}
                  >
                    {isCompleted && !isCurrent ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      step
                    )}
                  </span>
                  <span
                    className={`text-sm whitespace-nowrap ${
                      isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {label}
                  </span>
                </button>
                {idx < WIZARD_STEPS.length - 1 && (
                  <div
                    className={`mx-3 h-px flex-1 min-w-8 ${
                      completedSteps.has(step) ? 'bg-primary/30' : 'bg-border'
                    }`}
                  />
                )}
              </li>
            )
          })}
        </ol>

        {/* Mobile: compact step label */}
        <div className="sm:hidden flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Step {currentStep} of {WIZARD_STEPS.length}
          </p>
          <p className="text-sm font-medium text-foreground">
            {WIZARD_STEPS[currentStep - 1].label}
          </p>
        </div>
      </nav>

      {/* Step content */}
      <div className="min-h-[300px]">{children}</div>

      {/* Navigation footer */}
      {currentStep < 5 && (
        <div className="flex items-center justify-between border-t border-border pt-5">
          <div>
            {currentStep > 1 && (
              <Button variant="outline" onClick={onBack} disabled={creating}>
                Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {currentStep >= 2 && currentStep <= 4 && (
              <Button variant="ghost" onClick={onSkip} disabled={creating}>
                Skip
              </Button>
            )}
            <Button onClick={onNext} disabled={!canAdvance || creating}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
