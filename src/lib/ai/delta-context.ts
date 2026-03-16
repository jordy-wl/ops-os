/**
 * Delta-Aware Chat Context — formats a DeltaResult into a human-readable
 * context string for injection into the chat system prompt.
 *
 * Pure formatting function — no database, no AI calls, no side effects.
 * The caller is responsible for computing the DeltaResult via delta-engine.ts.
 *
 * Budget: ~400 tokens per delta context section.
 */

import type { DeltaResult, StepDelta } from './delta-types'

// ─── Constants ──────────────────────────────────────────────────────────────

/** Maximum number of completed steps to list individually */
const MAX_COMPLETED_DISPLAY = 5

/** Maximum number of remaining steps to list individually */
const MAX_REMAINING_DISPLAY = 5

/** Maximum number of risk items to list */
const MAX_RISK_DISPLAY = 5

// ─── Main Function ──────────────────────────────────────────────────────────

/**
 * Build a human-readable delta context string from a DeltaResult.
 *
 * Returns a formatted section that can be appended to the chat system prompt
 * when the user is viewing a workflow_instance block.
 *
 * Format:
 * ```
 * [WORKFLOW DELTA]
 * Health: 75/100
 * Status: running (step 3 of 5)
 * Completed: step_one (1h), step_two (2h)
 * Current: step_three (in progress, 3h elapsed, expected 24h)
 * Remaining: step_four, step_five
 * At Risk: none
 * Skipped: none
 * [END WORKFLOW DELTA]
 * ```
 */
export function buildDeltaContextString(delta: DeltaResult): string {
  const lines: string[] = ['[WORKFLOW DELTA]']

  // Health score
  lines.push(`Health: ${delta.healthScore.score}/100`)

  // Status line with progress
  lines.push(buildStatusLine(delta))

  // Completed steps
  lines.push(buildCompletedLine(delta))

  // Current step (if running)
  const currentLine = buildCurrentStepLine(delta)
  if (currentLine) {
    lines.push(currentLine)
  }

  // Remaining steps (future pending)
  lines.push(buildRemainingLine(delta))

  // At risk
  lines.push(buildAtRiskLine(delta))

  // Skipped
  lines.push(buildSkippedLine(delta))

  lines.push('[END WORKFLOW DELTA]')

  return lines.join('\n')
}

// ─── Line Builders ──────────────────────────────────────────────────────────

function buildStatusLine(delta: DeltaResult): string {
  const stepProgress = `step ${delta.currentStepIndex + 1} of ${delta.totalSteps}`

  switch (delta.status) {
    case 'done':
      return `Status: completed (${delta.totalSteps} steps)`
    case 'failed':
      return `Status: failed (at ${stepProgress})`
    case 'pending':
      return `Status: pending (not yet started, ${delta.totalSteps} steps)`
    case 'running':
      return `Status: running (${stepProgress})`
    default:
      return `Status: ${delta.status}`
  }
}

function buildCompletedLine(delta: DeltaResult): string {
  if (delta.completedSteps.length === 0) {
    return 'Completed: none'
  }

  const display = delta.completedSteps.slice(0, MAX_COMPLETED_DISPLAY)
  const parts = display.map((step) => formatCompletedStep(step))

  const overflow = delta.completedSteps.length - MAX_COMPLETED_DISPLAY
  if (overflow > 0) {
    parts.push(`+${overflow} more`)
  }

  return `Completed: ${parts.join(', ')}`
}

function formatCompletedStep(step: StepDelta): string {
  if (step.actualDurationHours !== null) {
    return `${step.stepName} (${formatDuration(step.actualDurationHours)})`
  }
  return step.stepName
}

function buildCurrentStepLine(delta: DeltaResult): string | null {
  if (delta.status !== 'running') {
    return null
  }

  const current = delta.timelineDeltas.find(
    (s) => s.status === 'in_progress' || s.status === 'overdue'
  )
  if (!current) {
    return null
  }

  const elapsed =
    current.actualDurationHours !== null
      ? `${formatDuration(current.actualDurationHours)} elapsed`
      : 'just started'

  const expected = `expected ${formatDuration(current.expectedDurationHours)}`
  const overdueNote = current.status === 'overdue' ? ', OVERDUE' : ''

  return `Current: ${current.stepName} (${current.status}, ${elapsed}, ${expected}${overdueNote})`
}

function buildRemainingLine(delta: DeltaResult): string {
  // Only show future pending steps (not the current in_progress/overdue one)
  const pending = delta.remainingSteps.filter(
    (s) => s.status === 'pending'
  )

  if (pending.length === 0) {
    return 'Remaining: none'
  }

  const display = pending.slice(0, MAX_REMAINING_DISPLAY)
  const names = display.map((s) => s.stepName)

  const overflow = pending.length - MAX_REMAINING_DISPLAY
  if (overflow > 0) {
    names.push(`+${overflow} more`)
  }

  return `Remaining: ${names.join(', ')}`
}

function buildAtRiskLine(delta: DeltaResult): string {
  const risks: string[] = []

  for (const step of delta.gapAnalysis.overdueSteps.slice(0, MAX_RISK_DISPLAY)) {
    risks.push(`${step.stepName} (overdue by ${formatDuration(step.overdueByHours)})`)
  }

  for (const step of delta.gapAnalysis.outOfOrderSteps.slice(0, MAX_RISK_DISPLAY - risks.length)) {
    risks.push(`${step.stepName} (executed out of order)`)
  }

  if (risks.length === 0) {
    return 'At Risk: none'
  }

  return `At Risk: ${risks.join(', ')}`
}

function buildSkippedLine(delta: DeltaResult): string {
  if (delta.gapAnalysis.skippedSteps.length === 0) {
    return 'Skipped: none'
  }

  const names = delta.gapAnalysis.skippedSteps.map((s) => s.stepName)
  return `Skipped: ${names.join(', ')}`
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Format hours into a human-readable duration string.
 * - Less than 1h: "Xm"
 * - 1-48h: "Xh"
 * - Over 48h: "Xd Yh"
 */
function formatDuration(hours: number): string {
  if (hours < 0) {
    hours = Math.abs(hours)
  }

  if (hours < 1) {
    const minutes = Math.round(hours * 60)
    return `${minutes}m`
  }

  if (hours <= 48) {
    return `${Math.round(hours * 10) / 10}h`
  }

  const days = Math.floor(hours / 24)
  const remainingHours = Math.round(hours % 24)
  if (remainingHours === 0) {
    return `${days}d`
  }
  return `${days}d ${remainingHours}h`
}
