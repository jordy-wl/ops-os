/**
 * Auto Task Generator — evaluates DeltaResult against configurable thresholds
 * and produces GeneratedTask objects for issues that need attention.
 *
 * Pure function — no database access, no side effects.
 * The caller (API layer) is responsible for persisting task_queue_items
 * and routing through the routing engine.
 */

import type { DeltaResult, OverdueStep } from './delta-types'
import { logger } from '../logger'

// ─── Constants (default thresholds) ──────────────────────────────────────────

/** Health score below this triggers a task */
const DEFAULT_HEALTH_THRESHOLD = 50

/** Health score below this escalates to critical priority */
const DEFAULT_CRITICAL_HEALTH_THRESHOLD = 25

/** Steps overdue by more than this many hours trigger a task */
const DEFAULT_OVERDUE_HOURS_THRESHOLD = 24

// ─── Types ───────────────────────────────────────────────────────────────────

export type TaskTriggerType =
  | 'health_critical'
  | 'step_overdue'
  | 'workflow_stalled'
  | 'workflow_failed'

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'

export type GeneratedTask = {
  title: string
  description: string
  priority: TaskPriority
  triggerType: TaskTriggerType
  relatedStepIndex: number | null
  relatedStepName: string | null
  recommendation: string
  deduplicationKey: string
}

export type TaskGenerationThresholds = {
  healthScoreMin: number
  criticalHealthScore: number
  overdueHoursMax: number
}

// ─── Default Thresholds ──────────────────────────────────────────────────────

export const DEFAULT_THRESHOLDS: TaskGenerationThresholds = {
  healthScoreMin: DEFAULT_HEALTH_THRESHOLD,
  criticalHealthScore: DEFAULT_CRITICAL_HEALTH_THRESHOLD,
  overdueHoursMax: DEFAULT_OVERDUE_HOURS_THRESHOLD,
}

// ─── Main Function ───────────────────────────────────────────────────────────

/**
 * Evaluate a DeltaResult and generate tasks for any issues that exceed
 * the configured thresholds.
 *
 * @param delta      - The delta calculation result
 * @param orgId      - The org that owns this workflow instance
 * @param thresholds - Optional per-org threshold overrides (falls back to defaults)
 * @returns Array of GeneratedTask objects (may be empty if workflow is healthy)
 */
export function generateTasksFromDelta(
  delta: DeltaResult,
  orgId: string,
  thresholds: TaskGenerationThresholds = DEFAULT_THRESHOLDS
): GeneratedTask[] {
  const tasks: GeneratedTask[] = []

  // 1. Health critical (score below threshold)
  if (delta.healthScore.score < thresholds.healthScoreMin) {
    const isCritical = delta.healthScore.score < thresholds.criticalHealthScore
    tasks.push({
      title: `Review workflow health: ${delta.instanceId}`,
      description: buildHealthDescription(delta),
      priority: isCritical ? 'critical' : 'high',
      triggerType: 'health_critical',
      relatedStepIndex: null,
      relatedStepName: null,
      recommendation: buildHealthRecommendation(delta),
      deduplicationKey: `health_${delta.instanceId}_${isCritical ? 'critical' : 'high'}`,
    })
  }

  // 2. Overdue steps (exceeding threshold)
  for (const step of delta.gapAnalysis.overdueSteps) {
    if (step.overdueByHours > thresholds.overdueHoursMax) {
      tasks.push({
        title: `Step "${step.stepName}" overdue by ${Math.round(step.overdueByHours)}h`,
        description: buildOverdueDescription(step, delta),
        priority: step.overdueByHours > thresholds.overdueHoursMax * 2 ? 'critical' : 'high',
        triggerType: 'step_overdue',
        relatedStepIndex: step.stepIndex,
        relatedStepName: step.stepName,
        recommendation: buildOverdueRecommendation(step, delta),
        deduplicationKey: `overdue_${delta.instanceId}_${step.stepName}`,
      })
    }
  }

  // 3. Failed workflow
  if (delta.status === 'failed') {
    const failedStep = delta.completedSteps.find((s) => s.status === 'failed')
    tasks.push({
      title: `Workflow failed: ${delta.instanceId}`,
      description: buildFailedDescription(delta, failedStep?.stepName ?? null),
      priority: 'critical',
      triggerType: 'workflow_failed',
      relatedStepIndex: failedStep?.stepIndex ?? null,
      relatedStepName: failedStep?.stepName ?? null,
      recommendation: buildFailedRecommendation(delta, failedStep?.stepName ?? null),
      deduplicationKey: `failed_${delta.instanceId}`,
    })
  }

  // 4. Stalled workflow (running but no progress — all remaining steps pending,
  //    current step has been in_progress for a long time but not yet flagged overdue)
  if (delta.status === 'running' && isStalledWorkflow(delta, thresholds)) {
    const currentStep = delta.timelineDeltas[delta.currentStepIndex]
    tasks.push({
      title: `Workflow stalled: ${delta.instanceId}`,
      description: buildStalledDescription(delta),
      priority: 'high',
      triggerType: 'workflow_stalled',
      relatedStepIndex: currentStep?.stepIndex ?? null,
      relatedStepName: currentStep?.stepName ?? null,
      recommendation: buildStalledRecommendation(delta),
      deduplicationKey: `stalled_${delta.instanceId}`,
    })
  }

  if (tasks.length > 0) {
    logger.info('auto-task-generator', 'tasks.generated', {
      instance_id: delta.instanceId,
      org_id: orgId,
      task_count: tasks.length,
      trigger_types: tasks.map((t) => t.triggerType),
    })
  }

  return tasks
}

// ─── Stalled Detection ───────────────────────────────────────────────────────

/**
 * A workflow is considered stalled when:
 * - Status is 'running'
 * - There are completed steps (workflow made progress at some point)
 * - The current step has been in_progress longer than the overdue threshold
 *   but is not yet counted in overdueSteps (edge case: step not yet classified
 *   as overdue by gap analysis because expected duration is very long)
 *
 * We do NOT generate a stalled task if health_critical or step_overdue already
 * covers the same issue — the caller deduplicates via deduplicationKey.
 */
function isStalledWorkflow(
  delta: DeltaResult,
  thresholds: TaskGenerationThresholds
): boolean {
  if (delta.completedSteps.length === 0) {
    return false // freshly started, not stalled
  }

  const currentStep = delta.timelineDeltas[delta.currentStepIndex]
  if (!currentStep) {
    return false
  }

  // Check if the current step has been going for longer than the overdue threshold
  // but may not have been flagged as overdue (e.g., expected duration is > threshold)
  if (
    currentStep.status === 'in_progress' &&
    currentStep.actualDurationHours !== null &&
    currentStep.actualDurationHours > thresholds.overdueHoursMax
  ) {
    return true
  }

  return false
}

// ─── Description Builders ────────────────────────────────────────────────────

function buildHealthDescription(delta: DeltaResult): string {
  const { score, overduePenalty, skipPenalty, variancePenalty } = delta.healthScore
  const parts = [
    `Workflow health is ${score}/100.`,
    `Template: ${delta.templateId}.`,
    `Progress: ${delta.completedSteps.length}/${delta.totalSteps} steps completed.`,
  ]
  if (overduePenalty > 0) {
    parts.push(`Overdue penalty: -${overduePenalty} points.`)
  }
  if (skipPenalty > 0) {
    parts.push(`Skip penalty: -${skipPenalty} points.`)
  }
  if (variancePenalty > 0) {
    parts.push(`Variance penalty: -${variancePenalty} points.`)
  }
  return parts.join(' ')
}

function buildOverdueDescription(step: OverdueStep, delta: DeltaResult): string {
  return (
    `Step "${step.stepName}" (index ${step.stepIndex}) in workflow ${delta.instanceId} ` +
    `is overdue by ${Math.round(step.overdueByHours)} hours. ` +
    `Workflow template: ${delta.templateId}. ` +
    `Overall health: ${delta.healthScore.score}/100.`
  )
}

function buildFailedDescription(
  delta: DeltaResult,
  failedStepName: string | null
): string {
  const stepInfo = failedStepName
    ? ` Failed at step: "${failedStepName}".`
    : ''
  return (
    `Workflow ${delta.instanceId} has failed.${stepInfo} ` +
    `Template: ${delta.templateId}. ` +
    `${delta.completedSteps.length}/${delta.totalSteps} steps were processed before failure.`
  )
}

function buildStalledDescription(delta: DeltaResult): string {
  const currentStep = delta.timelineDeltas[delta.currentStepIndex]
  const durationInfo = currentStep?.actualDurationHours
    ? ` Current step has been in progress for ${Math.round(currentStep.actualDurationHours)} hours.`
    : ''
  return (
    `Workflow ${delta.instanceId} appears stalled.${durationInfo} ` +
    `${delta.completedSteps.length}/${delta.totalSteps} steps completed. ` +
    `Template: ${delta.templateId}.`
  )
}

// ─── Recommendation Builders ─────────────────────────────────────────────────

/**
 * Generate actionable text based on the specific health score penalties.
 */
export function buildHealthRecommendation(delta: DeltaResult): string {
  const parts: string[] = []
  const { overduePenalty, skipPenalty, variancePenalty } = delta.healthScore

  if (overduePenalty > 0 && overduePenalty >= skipPenalty && overduePenalty >= variancePenalty) {
    parts.push(
      'Primary issue: overdue steps. Consider reassigning blocked steps or extending deadlines.'
    )
  }

  if (skipPenalty > 0) {
    const skippedNames = delta.gapAnalysis.skippedSteps.map((s) => s.stepName).join(', ')
    parts.push(
      `Skipped steps detected: ${skippedNames}. Review whether these steps can be completed retroactively or if the workflow needs adjustment.`
    )
  }

  if (variancePenalty > 0) {
    parts.push(
      'High time variance on completed steps. Review step durations and consider adjusting expected timelines in the template.'
    )
  }

  if (delta.gapAnalysis.outOfOrderSteps.length > 0) {
    parts.push(
      'Steps were executed out of order. Verify that the workflow definition matches the intended process.'
    )
  }

  if (parts.length === 0) {
    parts.push(
      'Workflow health is below threshold. Review the workflow instance for potential issues.'
    )
  }

  return parts.join(' ')
}

/**
 * Generate actionable text for an overdue step.
 */
export function buildOverdueRecommendation(
  step: OverdueStep,
  delta: DeltaResult
): string {
  const parts: string[] = []

  if (step.overdueByHours > 48) {
    parts.push(
      `Step "${step.stepName}" is significantly overdue (${Math.round(step.overdueByHours)}h). Consider reassigning to another team member or escalating.`
    )
  } else {
    parts.push(
      `Step "${step.stepName}" is overdue by ${Math.round(step.overdueByHours)} hours. Check if the assignee needs assistance or if the deadline should be extended.`
    )
  }

  // Add context about the step type from timeline deltas
  const stepDelta = delta.timelineDeltas.find((d) => d.stepIndex === step.stepIndex)
  if (stepDelta && stepDelta.stepType === 'route_human') {
    parts.push('This is a human-routed step — verify the assignee is available.')
  }

  return parts.join(' ')
}

/**
 * Generate actionable text for a failed workflow.
 */
function buildFailedRecommendation(
  delta: DeltaResult,
  failedStepName: string | null
): string {
  const parts: string[] = []

  if (failedStepName) {
    parts.push(
      `Workflow failed at step "${failedStepName}". Review the step configuration and error details to determine if this is a recoverable failure.`
    )
  } else {
    parts.push(
      'Workflow has failed. Review the instance details and event log to determine the root cause.'
    )
  }

  const completionRate = delta.totalSteps > 0
    ? Math.round((delta.completedSteps.length / delta.totalSteps) * 100)
    : 0

  if (completionRate > 50) {
    parts.push(
      `${completionRate}% of steps completed before failure. Consider restarting from the failed step rather than the beginning.`
    )
  }

  return parts.join(' ')
}

/**
 * Generate actionable text for a stalled workflow.
 */
function buildStalledRecommendation(delta: DeltaResult): string {
  const currentStep = delta.timelineDeltas[delta.currentStepIndex]
  if (!currentStep) {
    return 'Workflow appears stalled. Review the current state and consider restarting or reassigning.'
  }

  return (
    `Workflow is stalled at step "${currentStep.stepName}" (${currentStep.stepType}). ` +
    'Check if the step is waiting on external input or if the assignee needs assistance. ' +
    'Consider reassigning or escalating if no progress is expected.'
  )
}
