import type { DeltaResult } from '@/lib/ai/delta-types'

// ─── Types ──────────────────────────────────────────────────────────────────

export type NotificationPayload = {
  type: string
  title: string
  body: string
  block_id: string
}

// ─── Thresholds ─────────────────────────────────────────────────────────────

/** Health score below this triggers a critical alert. */
const HEALTH_CRITICAL_THRESHOLD = 50

/** Steps overdue by more than this many hours trigger an alert. */
const OVERDUE_HOURS_THRESHOLD = 24

// ─── Trigger Evaluation ─────────────────────────────────────────────────────

/**
 * evaluateDeltaTriggers — pure function that examines a DeltaResult and
 * returns zero or more notification payloads when thresholds are breached.
 *
 * Trigger conditions:
 * 1. Health score drops below 50 → delta_alert
 * 2. Any step is overdue by more than 24 hours → delta_alert (one per step)
 * 3. Workflow instance has failed status → delta_alert
 */
export function evaluateDeltaTriggers(delta: DeltaResult): NotificationPayload[] {
  const notifications: NotificationPayload[] = []

  // 1. Health score critical
  if (delta.healthScore.score < HEALTH_CRITICAL_THRESHOLD) {
    notifications.push({
      type: 'delta_alert',
      title: `Workflow health critical (${delta.healthScore.score}/100)`,
      body: buildHealthBody(delta),
      block_id: delta.instanceId,
    })
  }

  // 2. Overdue steps (> 24 hours)
  for (const step of delta.gapAnalysis.overdueSteps) {
    if (step.overdueByHours > OVERDUE_HOURS_THRESHOLD) {
      notifications.push({
        type: 'delta_alert',
        title: `Step "${step.stepName}" overdue by ${Math.round(step.overdueByHours)}h`,
        body: `Step ${step.stepIndex + 1} "${step.stepName}" is overdue by ${Math.round(step.overdueByHours)} hours. Review and take action to keep the workflow on track.`,
        block_id: delta.instanceId,
      })
    }
  }

  // 3. Workflow failed
  if (delta.status === 'failed') {
    notifications.push({
      type: 'delta_alert',
      title: 'Workflow instance failed',
      body: `Workflow instance ${delta.instanceId} (template ${delta.templateId}) has failed at step ${delta.currentStepIndex + 1} of ${delta.totalSteps}. Immediate attention required.`,
      block_id: delta.instanceId,
    })
  }

  return notifications
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildHealthBody(delta: DeltaResult): string {
  const penalties: string[] = []
  if (delta.healthScore.overduePenalty > 0) {
    penalties.push(`overdue penalty: -${delta.healthScore.overduePenalty}`)
  }
  if (delta.healthScore.skipPenalty > 0) {
    penalties.push(`skip penalty: -${delta.healthScore.skipPenalty}`)
  }
  if (delta.healthScore.variancePenalty > 0) {
    penalties.push(`variance penalty: -${delta.healthScore.variancePenalty}`)
  }

  const penaltyStr = penalties.length > 0 ? ` Breakdown: ${penalties.join(', ')}.` : ''
  return `Workflow health score is ${delta.healthScore.score}/100, below the critical threshold of ${HEALTH_CRITICAL_THRESHOLD}.${penaltyStr} Progress: step ${delta.currentStepIndex + 1} of ${delta.totalSteps}.`
}
