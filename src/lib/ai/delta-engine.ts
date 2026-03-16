/**
 * Delta Calculation Engine — compares workflow template design (steps)
 * against instance reality (step_results + events) to compute health,
 * gap analysis, and timeline deltas.
 *
 * Pure function — no database, no side effects, fully testable.
 */

import type {
  DeltaInstanceMeta,
  DeltaTemplateStep,
  DeltaEvent,
  DeltaResult,
  StepDelta,
  StepStatus,
  GapAnalysis,
  HealthScore,
  OverdueStep,
  SkippedStep,
  OutOfOrderStep,
} from './delta-types'

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default expected duration per step when no wait_seconds is specified */
const DEFAULT_EXPECTED_HOURS = 24

/** Penalty weights for health score */
const OVERDUE_PENALTY_PER_RATIO = 20 // penalty per (overdue_hours / expected_hours) ratio
const OVERDUE_PENALTY_CAP = 40
const SKIP_PENALTY_PER_STEP = 15
const SKIP_PENALTY_CAP = 30
const VARIANCE_RATIO_THRESHOLD = 0.5 // only penalize when variance ratio exceeds this
const VARIANCE_PENALTY_PER_EXCESS = 10
const VARIANCE_PENALTY_CAP = 30

// ─── Main Function ────────────────────────────────────────────────────────────

/**
 * Calculate the delta between a workflow template's designed steps
 * and the actual execution state of a workflow instance.
 *
 * @param instanceId - The workflow instance block ID
 * @param meta       - Instance metadata (status, step_results, etc.)
 * @param steps      - Template step definitions (the "design")
 * @param events     - Events recorded for this instance (newest-first or any order)
 */
export function calculateDelta(
  instanceId: string,
  meta: DeltaInstanceMeta,
  steps: DeltaTemplateStep[],
  events: DeltaEvent[]
): DeltaResult {
  const now = new Date().toISOString()

  // Edge case: no steps in template
  if (steps.length === 0) {
    return emptyResult(instanceId, meta, now)
  }

  // Sort events chronologically (oldest first) for timeline analysis
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  )

  // Build step completion map from step_results
  const resultMap = buildResultMap(meta.step_results)

  // Calculate timeline deltas for all steps
  const timelineDeltas = steps.map((step, i) =>
    buildStepDelta(step, i, meta, resultMap, sortedEvents, now)
  )

  const completedSteps = timelineDeltas.filter(
    (d) => d.status === 'completed' || d.status === 'failed'
  )
  const remainingSteps = timelineDeltas.filter(
    (d) => d.status === 'pending' || d.status === 'in_progress' || d.status === 'overdue'
  )

  // Gap analysis
  const gapAnalysis = analyzeGaps(steps, meta, resultMap, timelineDeltas, now)

  // Health score
  const healthScore = computeHealthScore(timelineDeltas, gapAnalysis)

  return {
    instanceId,
    templateId: meta.template_id,
    currentStepIndex: meta.current_step_index,
    totalSteps: steps.length,
    status: meta.status,
    completedSteps,
    remainingSteps,
    timelineDeltas,
    gapAnalysis,
    healthScore,
    calculatedAt: now,
  }
}

// ─── Step Delta Calculation ───────────────────────────────────────────────────

type ResultEntry = {
  status: 'completed' | 'failed' | 'waiting'
  executed_at: string
  orderIndex: number
}

function buildResultMap(
  stepResults: DeltaInstanceMeta['step_results']
): Map<string, ResultEntry> {
  const map = new Map<string, ResultEntry>()
  for (let i = 0; i < stepResults.length; i++) {
    const r = stepResults[i]
    map.set(r.step_name, {
      status: r.status,
      executed_at: r.executed_at,
      orderIndex: i,
    })
  }
  return map
}

function getExpectedDurationHours(step: DeltaTemplateStep): number {
  if (step.type === 'wait' && step.wait_seconds) {
    return step.wait_seconds / 3600
  }
  return DEFAULT_EXPECTED_HOURS
}

function buildStepDelta(
  step: DeltaTemplateStep,
  index: number,
  meta: DeltaInstanceMeta,
  resultMap: Map<string, ResultEntry>,
  sortedEvents: DeltaEvent[],
  now: string
): StepDelta {
  const expectedHours = getExpectedDurationHours(step)
  const result = resultMap.get(step.name)

  // Determine when this step started
  const startedAt = inferStepStartTime(index, meta, resultMap, sortedEvents)

  if (result) {
    // Step has a result
    const completedAt = result.executed_at
    const actualHours = startedAt
      ? (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 3_600_000
      : null
    const varianceHours = actualHours !== null ? actualHours - expectedHours : null

    const status: StepStatus = result.status === 'completed'
      ? 'completed'
      : result.status === 'failed'
        ? 'failed'
        : 'in_progress' // 'waiting' maps to in_progress

    return {
      stepIndex: index,
      stepName: step.name,
      stepType: step.type,
      status,
      expectedDurationHours: expectedHours,
      actualDurationHours: actualHours !== null ? round2(actualHours) : null,
      varianceHours: varianceHours !== null ? round2(varianceHours) : null,
      startedAt,
      completedAt,
    }
  }

  // No result yet — pending or in_progress or overdue
  if (index === meta.current_step_index && meta.status === 'running') {
    // Currently active step
    const elapsedHours = startedAt
      ? (new Date(now).getTime() - new Date(startedAt).getTime()) / 3_600_000
      : 0
    const isOverdue = elapsedHours > expectedHours

    return {
      stepIndex: index,
      stepName: step.name,
      stepType: step.type,
      status: isOverdue ? 'overdue' : 'in_progress',
      expectedDurationHours: expectedHours,
      actualDurationHours: round2(elapsedHours),
      varianceHours: round2(elapsedHours - expectedHours),
      startedAt,
      completedAt: null,
    }
  }

  // Future step — pending
  return {
    stepIndex: index,
    stepName: step.name,
    stepType: step.type,
    status: 'pending',
    expectedDurationHours: expectedHours,
    actualDurationHours: null,
    varianceHours: null,
    startedAt: null,
    completedAt: null,
  }
}

/**
 * Infer when a step started:
 * - Step 0: instance started_at
 * - Step N: previous step's executed_at (completion time)
 * - Fallback: look for workflow.step.completed events
 */
function inferStepStartTime(
  stepIndex: number,
  meta: DeltaInstanceMeta,
  resultMap: Map<string, ResultEntry>,
  sortedEvents: DeltaEvent[]
): string | null {
  if (stepIndex === 0) {
    return meta.started_at
  }

  // Find the previous step's completion time from step_results
  // We need the step that was executed just before this one
  for (const [, entry] of resultMap) {
    if (entry.orderIndex === stepIndex - 1) {
      return entry.executed_at
    }
  }

  // Fallback: look for step.completed event with matching step_index
  const stepEvent = sortedEvents.find(
    (e) =>
      e.type === 'workflow.step.completed' &&
      (e.payload as Record<string, unknown>)?.step_index === stepIndex - 1
  )
  if (stepEvent) {
    return stepEvent.occurred_at
  }

  return meta.started_at
}

// ─── Gap Analysis ─────────────────────────────────────────────────────────────

function analyzeGaps(
  steps: DeltaTemplateStep[],
  meta: DeltaInstanceMeta,
  resultMap: Map<string, ResultEntry>,
  timelineDeltas: StepDelta[],
  now: string
): GapAnalysis {
  const overdueSteps: OverdueStep[] = []
  const skippedSteps: SkippedStep[] = []
  const outOfOrderSteps: OutOfOrderStep[] = []

  // Detect overdue steps
  for (const delta of timelineDeltas) {
    if (delta.status === 'overdue' && delta.varianceHours !== null && delta.varianceHours > 0) {
      overdueSteps.push({
        stepIndex: delta.stepIndex,
        stepName: delta.stepName,
        overdueByHours: round2(delta.varianceHours),
      })
    }
    // Also check completed steps that exceeded expected time significantly
    if (
      delta.status === 'completed' &&
      delta.varianceHours !== null &&
      delta.varianceHours > delta.expectedDurationHours
    ) {
      overdueSteps.push({
        stepIndex: delta.stepIndex,
        stepName: delta.stepName,
        overdueByHours: round2(delta.varianceHours),
      })
    }
  }

  // Detect skipped steps: steps before current_step_index with no result
  for (let i = 0; i < meta.current_step_index && i < steps.length; i++) {
    if (!resultMap.has(steps[i].name)) {
      skippedSteps.push({
        stepIndex: i,
        stepName: steps[i].name,
      })
    }
  }

  // Detect out-of-order execution
  const executedOrder = meta.step_results
    .map((r) => {
      const templateIndex = steps.findIndex((s) => s.name === r.step_name)
      return { stepName: r.step_name, templateIndex }
    })
    .filter((e) => e.templateIndex >= 0)

  for (let actual = 0; actual < executedOrder.length; actual++) {
    const entry = executedOrder[actual]
    // Check if any later-executed step has a lower template index
    if (actual > 0) {
      const prevEntry = executedOrder[actual - 1]
      if (entry.templateIndex < prevEntry.templateIndex) {
        outOfOrderSteps.push({
          stepIndex: entry.templateIndex,
          stepName: entry.stepName,
          expectedOrder: entry.templateIndex,
          actualOrder: actual,
        })
      }
    }
  }

  return { overdueSteps, skippedSteps, outOfOrderSteps }
}

// ─── Health Score ─────────────────────────────────────────────────────────────

function computeHealthScore(
  timelineDeltas: StepDelta[],
  gapAnalysis: GapAnalysis
): HealthScore {
  // Overdue penalty: sum of (overdue_hours / expected_hours) * weight, capped
  let overduePenalty = 0
  for (const step of gapAnalysis.overdueSteps) {
    const delta = timelineDeltas.find((d) => d.stepIndex === step.stepIndex)
    if (delta && delta.expectedDurationHours > 0) {
      overduePenalty += (step.overdueByHours / delta.expectedDurationHours) * OVERDUE_PENALTY_PER_RATIO
    }
  }
  overduePenalty = Math.min(overduePenalty, OVERDUE_PENALTY_CAP)

  // Skip penalty
  const skipPenalty = Math.min(
    gapAnalysis.skippedSteps.length * SKIP_PENALTY_PER_STEP,
    SKIP_PENALTY_CAP
  )

  // Variance penalty: penalize completed steps with high variance
  let variancePenalty = 0
  for (const delta of timelineDeltas) {
    if (
      delta.status === 'completed' &&
      delta.varianceHours !== null &&
      delta.expectedDurationHours > 0
    ) {
      const ratio = delta.varianceHours / delta.expectedDurationHours
      if (ratio > VARIANCE_RATIO_THRESHOLD) {
        variancePenalty += (ratio - VARIANCE_RATIO_THRESHOLD) * VARIANCE_PENALTY_PER_EXCESS
      }
    }
  }
  variancePenalty = Math.min(variancePenalty, VARIANCE_PENALTY_CAP)

  const score = Math.max(0, Math.min(100, 100 - overduePenalty - skipPenalty - variancePenalty))

  return {
    score: round2(score),
    overduePenalty: round2(overduePenalty),
    skipPenalty: round2(skipPenalty),
    variancePenalty: round2(variancePenalty),
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function emptyResult(
  instanceId: string,
  meta: DeltaInstanceMeta,
  now: string
): DeltaResult {
  return {
    instanceId,
    templateId: meta.template_id,
    currentStepIndex: 0,
    totalSteps: 0,
    status: meta.status,
    completedSteps: [],
    remainingSteps: [],
    timelineDeltas: [],
    gapAnalysis: { overdueSteps: [], skippedSteps: [], outOfOrderSteps: [] },
    healthScore: { score: 100, overduePenalty: 0, skipPenalty: 0, variancePenalty: 0 },
    calculatedAt: now,
  }
}
