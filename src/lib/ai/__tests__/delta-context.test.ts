import { describe, it, expect } from 'vitest'
import { buildDeltaContextString } from '../delta-context'
import type { DeltaResult, StepDelta, GapAnalysis, HealthScore } from '../delta-types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeStepDelta(
  overrides: Partial<StepDelta> = {}
): StepDelta {
  return {
    stepIndex: 0,
    stepName: 'test_step',
    stepType: 'emit_event',
    status: 'completed',
    expectedDurationHours: 24,
    actualDurationHours: 1,
    varianceHours: -23,
    startedAt: '2026-03-10T10:00:00Z',
    completedAt: '2026-03-10T11:00:00Z',
    ...overrides,
  }
}

function makeGapAnalysis(
  overrides: Partial<GapAnalysis> = {}
): GapAnalysis {
  return {
    overdueSteps: [],
    skippedSteps: [],
    outOfOrderSteps: [],
    ...overrides,
  }
}

function makeHealthScore(
  overrides: Partial<HealthScore> = {}
): HealthScore {
  return {
    score: 100,
    overduePenalty: 0,
    skipPenalty: 0,
    variancePenalty: 0,
    ...overrides,
  }
}

function makeDeltaResult(
  overrides: Partial<DeltaResult> = {}
): DeltaResult {
  return {
    instanceId: 'inst-1',
    templateId: 'tmpl-1',
    currentStepIndex: 0,
    totalSteps: 3,
    status: 'running',
    completedSteps: [],
    remainingSteps: [],
    timelineDeltas: [],
    gapAnalysis: makeGapAnalysis(),
    healthScore: makeHealthScore(),
    calculatedAt: '2026-03-12T12:00:00Z',
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildDeltaContextString', () => {
  describe('basic formatting', () => {
    it('wraps output in [WORKFLOW DELTA] and [END WORKFLOW DELTA] markers', () => {
      const result = buildDeltaContextString(makeDeltaResult())
      expect(result).toMatch(/^\[WORKFLOW DELTA\]/)
      expect(result).toMatch(/\[END WORKFLOW DELTA\]$/)
    })

    it('includes health score', () => {
      const delta = makeDeltaResult({
        healthScore: makeHealthScore({ score: 75 }),
      })
      const result = buildDeltaContextString(delta)
      expect(result).toContain('Health: 75/100')
    })
  })

  describe('running workflow', () => {
    it('formats a running workflow with completed and remaining steps', () => {
      const completedStep = makeStepDelta({
        stepIndex: 0,
        stepName: 'step_one',
        status: 'completed',
        actualDurationHours: 1,
      })
      const currentStep = makeStepDelta({
        stepIndex: 1,
        stepName: 'step_two',
        status: 'in_progress',
        actualDurationHours: 3,
        expectedDurationHours: 24,
        completedAt: null,
      })
      const pendingStep = makeStepDelta({
        stepIndex: 2,
        stepName: 'step_three',
        status: 'pending',
        actualDurationHours: null,
        completedAt: null,
        startedAt: null,
      })

      const delta = makeDeltaResult({
        totalSteps: 3,
        currentStepIndex: 1,
        status: 'running',
        completedSteps: [completedStep],
        remainingSteps: [currentStep, pendingStep],
        timelineDeltas: [completedStep, currentStep, pendingStep],
        healthScore: makeHealthScore({ score: 75 }),
      })

      const result = buildDeltaContextString(delta)

      expect(result).toContain('Health: 75/100')
      expect(result).toContain('Status: running (step 2 of 3)')
      expect(result).toContain('Completed: step_one (1h)')
      expect(result).toContain('Current: step_two (in_progress')
      expect(result).toContain('3h elapsed')
      expect(result).toContain('expected 24h')
      expect(result).toContain('Remaining: step_three')
      expect(result).toContain('At Risk: none')
      expect(result).toContain('Skipped: none')
    })

    it('shows OVERDUE note for overdue current step', () => {
      const overdueStep = makeStepDelta({
        stepIndex: 0,
        stepName: 'slow_step',
        status: 'overdue',
        actualDurationHours: 30,
        expectedDurationHours: 24,
        completedAt: null,
      })

      const delta = makeDeltaResult({
        totalSteps: 1,
        currentStepIndex: 0,
        status: 'running',
        completedSteps: [],
        remainingSteps: [overdueStep],
        timelineDeltas: [overdueStep],
        gapAnalysis: makeGapAnalysis({
          overdueSteps: [{ stepIndex: 0, stepName: 'slow_step', overdueByHours: 6 }],
        }),
        healthScore: makeHealthScore({ score: 60 }),
      })

      const result = buildDeltaContextString(delta)

      expect(result).toContain('Current: slow_step (overdue')
      expect(result).toContain('OVERDUE')
      expect(result).toContain('At Risk: slow_step (overdue by 6h)')
    })
  })

  describe('completed workflow', () => {
    it('formats a completed workflow correctly', () => {
      const step1 = makeStepDelta({
        stepIndex: 0,
        stepName: 'step_one',
        status: 'completed',
        actualDurationHours: 2,
      })
      const step2 = makeStepDelta({
        stepIndex: 1,
        stepName: 'step_two',
        status: 'completed',
        actualDurationHours: 4,
      })

      const delta = makeDeltaResult({
        totalSteps: 2,
        currentStepIndex: 2,
        status: 'done',
        completedSteps: [step1, step2],
        remainingSteps: [],
        timelineDeltas: [step1, step2],
      })

      const result = buildDeltaContextString(delta)

      expect(result).toContain('Status: completed (2 steps)')
      expect(result).toContain('Completed: step_one (2h), step_two (4h)')
      expect(result).toContain('Remaining: none')
      expect(result).not.toContain('Current:')
    })
  })

  describe('pending workflow (not yet started)', () => {
    it('formats a pending workflow correctly', () => {
      const pending1 = makeStepDelta({
        stepIndex: 0,
        stepName: 'first_step',
        status: 'pending',
        actualDurationHours: null,
        completedAt: null,
        startedAt: null,
      })
      const pending2 = makeStepDelta({
        stepIndex: 1,
        stepName: 'second_step',
        status: 'pending',
        actualDurationHours: null,
        completedAt: null,
        startedAt: null,
      })

      const delta = makeDeltaResult({
        totalSteps: 2,
        currentStepIndex: 0,
        status: 'pending',
        completedSteps: [],
        remainingSteps: [pending1, pending2],
        timelineDeltas: [pending1, pending2],
      })

      const result = buildDeltaContextString(delta)

      expect(result).toContain('Status: pending (not yet started, 2 steps)')
      expect(result).toContain('Completed: none')
      expect(result).toContain('Remaining: first_step, second_step')
      expect(result).not.toContain('Current:')
    })
  })

  describe('empty workflow (no steps)', () => {
    it('handles a workflow with zero steps', () => {
      const delta = makeDeltaResult({
        totalSteps: 0,
        currentStepIndex: 0,
        status: 'done',
        completedSteps: [],
        remainingSteps: [],
        timelineDeltas: [],
      })

      const result = buildDeltaContextString(delta)

      expect(result).toContain('Health: 100/100')
      expect(result).toContain('Completed: none')
      expect(result).toContain('Remaining: none')
      expect(result).toContain('At Risk: none')
      expect(result).toContain('Skipped: none')
    })
  })

  describe('risk information', () => {
    it('includes overdue steps in At Risk section', () => {
      const delta = makeDeltaResult({
        gapAnalysis: makeGapAnalysis({
          overdueSteps: [
            { stepIndex: 0, stepName: 'document_review', overdueByHours: 12 },
            { stepIndex: 2, stepName: 'compliance_check', overdueByHours: 48 },
          ],
        }),
      })

      const result = buildDeltaContextString(delta)

      expect(result).toContain('At Risk: document_review (overdue by 12h), compliance_check (overdue by 48h)')
    })

    it('includes out-of-order steps in At Risk section', () => {
      const delta = makeDeltaResult({
        gapAnalysis: makeGapAnalysis({
          outOfOrderSteps: [
            { stepIndex: 1, stepName: 'step_two', expectedOrder: 1, actualOrder: 0 },
          ],
        }),
      })

      const result = buildDeltaContextString(delta)

      expect(result).toContain('At Risk: step_two (executed out of order)')
    })

    it('includes skipped steps in Skipped section', () => {
      const delta = makeDeltaResult({
        gapAnalysis: makeGapAnalysis({
          skippedSteps: [
            { stepIndex: 0, stepName: 'skipped_step_a' },
            { stepIndex: 1, stepName: 'skipped_step_b' },
          ],
        }),
      })

      const result = buildDeltaContextString(delta)

      expect(result).toContain('Skipped: skipped_step_a, skipped_step_b')
    })

    it('shows "none" for At Risk when no risks exist', () => {
      const delta = makeDeltaResult({
        gapAnalysis: makeGapAnalysis(),
      })

      const result = buildDeltaContextString(delta)

      expect(result).toContain('At Risk: none')
    })
  })

  describe('duration formatting', () => {
    it('formats sub-hour durations as minutes', () => {
      const step = makeStepDelta({
        stepName: 'quick_step',
        status: 'completed',
        actualDurationHours: 0.5,
      })
      const delta = makeDeltaResult({
        completedSteps: [step],
      })

      const result = buildDeltaContextString(delta)

      expect(result).toContain('quick_step (30m)')
    })

    it('formats multi-day durations as days and hours', () => {
      const delta = makeDeltaResult({
        gapAnalysis: makeGapAnalysis({
          overdueSteps: [
            { stepIndex: 0, stepName: 'stuck_step', overdueByHours: 72 },
          ],
        }),
      })

      const result = buildDeltaContextString(delta)

      expect(result).toContain('stuck_step (overdue by 3d)')
    })
  })

  describe('overflow handling', () => {
    it('truncates long completed step lists with "+N more"', () => {
      const steps = Array.from({ length: 8 }, (_, i) =>
        makeStepDelta({
          stepIndex: i,
          stepName: `step_${i + 1}`,
          status: 'completed',
          actualDurationHours: i + 1,
        })
      )

      const delta = makeDeltaResult({
        completedSteps: steps,
      })

      const result = buildDeltaContextString(delta)

      // Should show first 5 then "+3 more"
      expect(result).toContain('step_1')
      expect(result).toContain('step_5')
      expect(result).toContain('+3 more')
      expect(result).not.toContain('step_6 (')
    })
  })

  describe('failed workflow', () => {
    it('formats a failed workflow status correctly', () => {
      const delta = makeDeltaResult({
        totalSteps: 3,
        currentStepIndex: 1,
        status: 'failed',
      })

      const result = buildDeltaContextString(delta)

      expect(result).toContain('Status: failed (at step 2 of 3)')
    })
  })
})
