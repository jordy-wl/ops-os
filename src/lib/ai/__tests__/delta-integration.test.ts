/**
 * Delta Integration Tests — exercises the full pipeline:
 * calculateDelta → buildFallbackInsights → generateTasksFromDelta → evaluateDeltaTriggers
 *
 * Validates that modules compose correctly end-to-end with realistic workflow data.
 */

import { describe, it, expect } from 'vitest'
import { calculateDelta } from '../delta-engine'
import { buildFallbackInsights } from '../insights-generator'
import { generateTasksFromDelta } from '../auto-task-generator'
import { evaluateDeltaTriggers } from '@/lib/notifications/delta-triggers'
import type {
  DeltaInstanceMeta,
  DeltaTemplateStep,
  DeltaEvent,
} from '../delta-types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString()
}

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString()
}

const ORG_ID = 'org-integration-test'

const FIVE_STEP_TEMPLATE: DeltaTemplateStep[] = [
  { name: 'client_intake', type: 'emit_event' },
  { name: 'kyc_review', type: 'route_human' },
  { name: 'aml_check', type: 'run_action' },
  { name: 'compliance_sign_off', type: 'route_human' },
  { name: 'onboarding_complete', type: 'emit_event' },
]

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Delta Pipeline Integration', () => {
  describe('healthy workflow — green path', () => {
    it('produces healthy delta → positive insights → no tasks → no notifications', () => {
      const meta: DeltaInstanceMeta = {
        template_id: 'tmpl-healthy',
        source_block_id: 'block-src',
        status: 'running',
        current_step_index: 2,
        step_results: [
          { step_name: 'client_intake', step_type: 'emit_event', status: 'completed', executed_at: hoursAgo(20) },
          { step_name: 'kyc_review', step_type: 'route_human', status: 'completed', executed_at: hoursAgo(2) },
        ],
        started_at: hoursAgo(22),
        completed_at: null,
      }
      const events: DeltaEvent[] = []

      // 1. Delta
      const delta = calculateDelta('inst-healthy', meta, FIVE_STEP_TEMPLATE, events)
      expect(delta.status).toBe('running')
      expect(delta.completedSteps).toHaveLength(2)
      expect(delta.remainingSteps.length).toBeGreaterThanOrEqual(2)
      expect(delta.healthScore.score).toBeGreaterThanOrEqual(80)

      // 2. Insights (fallback — no Claude call)
      const insights = buildFallbackInsights(delta, {
        blockId: 'inst-healthy',
        blockType: 'workflow_instance',
        blockName: 'Healthy Onboarding',
        lastEventId: 'none',
      })
      expect(insights.whatsDone.length).toBeGreaterThan(0)
      expect(insights.whatsNext.length).toBeGreaterThan(0)
      expect(insights.whatsAtRisk).toContainEqual('No current risks identified.')

      // 3. Auto tasks — none expected
      const tasks = generateTasksFromDelta(delta, ORG_ID)
      expect(tasks).toHaveLength(0)

      // 4. Notifications — none expected
      const notifications = evaluateDeltaTriggers(delta)
      expect(notifications).toHaveLength(0)
    })
  })

  describe('degraded workflow — overdue steps', () => {
    it('overdue step produces correct delta → risk insights → overdue task → notification', () => {
      const meta: DeltaInstanceMeta = {
        template_id: 'tmpl-overdue',
        source_block_id: 'block-src',
        status: 'running',
        current_step_index: 1,
        step_results: [
          { step_name: 'client_intake', step_type: 'emit_event', status: 'completed', executed_at: hoursAgo(50) },
        ],
        started_at: hoursAgo(52),
        completed_at: null,
      }
      const events: DeltaEvent[] = []

      // 1. Delta — step 1 has been in_progress for ~50h (expected 24h)
      const delta = calculateDelta('inst-overdue', meta, FIVE_STEP_TEMPLATE, events)
      expect(delta.healthScore.score).toBeLessThan(100)

      // Check if current step is detected as overdue
      const currentStep = delta.timelineDeltas.find((d) => d.stepIndex === 1)
      expect(currentStep).toBeDefined()
      expect(currentStep!.status).toBe('overdue')

      // 2. Insights should flag risk
      const insights = buildFallbackInsights(delta, {
        blockId: 'inst-overdue',
        blockType: 'workflow_instance',
        blockName: 'Overdue Onboarding',
        lastEventId: 'none',
      })
      expect(insights.whatsAtRisk.some((r) => r.includes('kyc_review'))).toBe(true)

      // 3. Auto tasks — overdue step should generate a task
      const tasks = generateTasksFromDelta(delta, ORG_ID)
      const overdueTasks = tasks.filter((t) => t.triggerType === 'step_overdue')
      expect(overdueTasks.length).toBeGreaterThanOrEqual(1)
      expect(overdueTasks[0].relatedStepName).toBe('kyc_review')

      // 4. Notifications
      const notifications = evaluateDeltaTriggers(delta)
      const overdueNotif = notifications.filter((n) => n.title.includes('kyc_review'))
      expect(overdueNotif.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('failed workflow — critical path', () => {
    it('failed workflow → critical insights → failed+health tasks → multiple notifications', () => {
      const meta: DeltaInstanceMeta = {
        template_id: 'tmpl-failed',
        source_block_id: 'block-src',
        status: 'failed',
        current_step_index: 2,
        step_results: [
          { step_name: 'client_intake', step_type: 'emit_event', status: 'completed', executed_at: hoursAgo(70) },
          { step_name: 'kyc_review', step_type: 'route_human', status: 'completed', executed_at: hoursAgo(40) },
          { step_name: 'aml_check', step_type: 'run_action', status: 'failed', executed_at: hoursAgo(38) },
        ],
        started_at: hoursAgo(72),
        completed_at: null,
      }
      const events: DeltaEvent[] = []

      // 1. Delta
      const delta = calculateDelta('inst-failed', meta, FIVE_STEP_TEMPLATE, events)
      expect(delta.status).toBe('failed')
      expect(delta.completedSteps.some((s) => s.status === 'failed')).toBe(true)

      // 2. Insights should reference failure
      const insights = buildFallbackInsights(delta, {
        blockId: 'inst-failed',
        blockType: 'workflow_instance',
        blockName: 'Failed Onboarding',
        lastEventId: 'none',
      })
      expect(insights.whatsDone.length).toBeGreaterThan(0)

      // 3. Auto tasks — should produce workflow_failed task
      const tasks = generateTasksFromDelta(delta, ORG_ID)
      const failedTasks = tasks.filter((t) => t.triggerType === 'workflow_failed')
      expect(failedTasks).toHaveLength(1)
      expect(failedTasks[0].priority).toBe('critical')

      // 4. Notifications
      const notifications = evaluateDeltaTriggers(delta)
      expect(notifications.some((n) => n.title === 'Workflow instance failed')).toBe(true)
    })
  })

  describe('completed workflow — no action needed', () => {
    it('completed workflow produces clean delta → positive insights → no tasks', () => {
      const meta: DeltaInstanceMeta = {
        template_id: 'tmpl-done',
        source_block_id: 'block-src',
        status: 'done',
        current_step_index: 5,
        step_results: FIVE_STEP_TEMPLATE.map((s, i) => ({
          step_name: s.name,
          step_type: s.type,
          status: 'completed' as const,
          executed_at: hoursAgo(50 - i * 10),
        })),
        started_at: hoursAgo(60),
        completed_at: hoursAgo(5),
      }
      const events: DeltaEvent[] = []

      const delta = calculateDelta('inst-done', meta, FIVE_STEP_TEMPLATE, events)
      expect(delta.status).toBe('done')
      expect(delta.completedSteps).toHaveLength(5)
      expect(delta.remainingSteps).toHaveLength(0)
      expect(delta.healthScore.score).toBeGreaterThanOrEqual(80)

      const insights = buildFallbackInsights(delta, {
        blockId: 'inst-done',
        blockType: 'workflow_instance',
        blockName: 'Complete Onboarding',
        lastEventId: 'none',
      })
      expect(insights.whatsNext).toContainEqual('All steps completed.')

      const tasks = generateTasksFromDelta(delta, ORG_ID)
      expect(tasks).toHaveLength(0)

      const notifications = evaluateDeltaTriggers(delta)
      expect(notifications).toHaveLength(0)
    })
  })

  describe('edge cases', () => {
    it('single-step workflow — runs full pipeline correctly', () => {
      const singleStep: DeltaTemplateStep[] = [
        { name: 'only_step', type: 'emit_event' },
      ]
      const meta: DeltaInstanceMeta = {
        template_id: 'tmpl-single',
        source_block_id: 'block-src',
        status: 'running',
        current_step_index: 0,
        step_results: [],
        started_at: minutesAgo(30),
        completed_at: null,
      }

      const delta = calculateDelta('inst-single', meta, singleStep, [])
      expect(delta.totalSteps).toBe(1)
      expect(delta.remainingSteps).toHaveLength(1)
      expect(delta.remainingSteps[0].status).toBe('in_progress')

      const tasks = generateTasksFromDelta(delta, ORG_ID)
      expect(tasks).toHaveLength(0) // healthy, no issues

      const notifications = evaluateDeltaTriggers(delta)
      expect(notifications).toHaveLength(0)
    })

    it('large workflow (50 steps) — pipeline handles scale', () => {
      const manySteps: DeltaTemplateStep[] = Array.from({ length: 50 }, (_, i) => ({
        name: `step_${i}`,
        type: i % 3 === 0 ? 'emit_event' : i % 3 === 1 ? 'route_human' : 'run_action',
      }))

      const completedResults = Array.from({ length: 25 }, (_, i) => ({
        step_name: `step_${i}`,
        step_type: manySteps[i].type,
        status: 'completed' as const,
        executed_at: hoursAgo(500 - i * 20),
      }))

      const meta: DeltaInstanceMeta = {
        template_id: 'tmpl-large',
        source_block_id: 'block-src',
        status: 'running',
        current_step_index: 25,
        step_results: completedResults,
        started_at: hoursAgo(510),
        completed_at: null,
      }

      const delta = calculateDelta('inst-large', meta, manySteps, [])
      expect(delta.totalSteps).toBe(50)
      expect(delta.completedSteps).toHaveLength(25)
      expect(delta.remainingSteps.length).toBeGreaterThanOrEqual(24) // 24 pending + 1 in_progress
      expect(delta.timelineDeltas).toHaveLength(50)

      // Pipeline should not throw
      const insights = buildFallbackInsights(delta, {
        blockId: 'inst-large',
        blockType: 'workflow_instance',
        blockName: 'Large Workflow',
        lastEventId: 'none',
      })
      expect(insights.whatsDone.length).toBeGreaterThan(0)

      const tasks = generateTasksFromDelta(delta, ORG_ID)
      // May or may not generate tasks depending on health — no crash
      expect(Array.isArray(tasks)).toBe(true)
    })

    it('pending workflow (not yet started) — all steps pending', () => {
      const meta: DeltaInstanceMeta = {
        template_id: 'tmpl-pending',
        source_block_id: 'block-src',
        status: 'pending',
        current_step_index: 0,
        step_results: [],
        started_at: null,
        completed_at: null,
      }

      const delta = calculateDelta('inst-pending', meta, FIVE_STEP_TEMPLATE, [])
      expect(delta.status).toBe('pending')
      expect(delta.completedSteps).toHaveLength(0)
      expect(delta.remainingSteps).toHaveLength(5)
      expect(delta.healthScore.score).toBe(100)

      const tasks = generateTasksFromDelta(delta, ORG_ID)
      expect(tasks).toHaveLength(0)

      const notifications = evaluateDeltaTriggers(delta)
      expect(notifications).toHaveLength(0)
    })

    it('skipped steps produce gap analysis and health penalties', () => {
      const meta: DeltaInstanceMeta = {
        template_id: 'tmpl-skip',
        source_block_id: 'block-src',
        status: 'running',
        current_step_index: 3,
        step_results: [
          { step_name: 'client_intake', step_type: 'emit_event', status: 'completed', executed_at: hoursAgo(48) },
          // kyc_review (index 1) and aml_check (index 2) are SKIPPED
          { step_name: 'compliance_sign_off', step_type: 'route_human', status: 'completed', executed_at: hoursAgo(24) },
        ],
        started_at: hoursAgo(50),
        completed_at: null,
      }

      const delta = calculateDelta('inst-skip', meta, FIVE_STEP_TEMPLATE, [])
      expect(delta.gapAnalysis.skippedSteps).toHaveLength(2)
      expect(delta.gapAnalysis.skippedSteps.map((s) => s.stepName)).toEqual(['kyc_review', 'aml_check'])
      expect(delta.healthScore.skipPenalty).toBeGreaterThan(0)

      // Insights should flag skipped
      const insights = buildFallbackInsights(delta, {
        blockId: 'inst-skip',
        blockType: 'workflow_instance',
        blockName: 'Skip Onboarding',
        lastEventId: 'none',
      })
      expect(insights.whatsAtRisk.some((r) => r.includes('kyc_review'))).toBe(true)
    })

    it('events provide timeline context when step_results have no timing', () => {
      const meta: DeltaInstanceMeta = {
        template_id: 'tmpl-events',
        source_block_id: 'block-src',
        status: 'running',
        current_step_index: 1,
        step_results: [
          { step_name: 'client_intake', step_type: 'emit_event', status: 'completed', executed_at: hoursAgo(20) },
        ],
        started_at: hoursAgo(22),
        completed_at: null,
      }
      const events: DeltaEvent[] = [
        {
          id: 'evt-1',
          type: 'workflow.step.completed',
          occurred_at: hoursAgo(20),
          payload: { step_index: 0 },
        },
      ]

      const delta = calculateDelta('inst-events', meta, FIVE_STEP_TEMPLATE, events)
      // Step 1 should have a startedAt derived from step 0's completion
      const step1 = delta.timelineDeltas.find((d) => d.stepIndex === 1)
      expect(step1?.startedAt).toBeTruthy()
    })

    it('deduplication keys are stable across re-calculation', () => {
      const meta: DeltaInstanceMeta = {
        template_id: 'tmpl-dedup',
        source_block_id: 'block-src',
        status: 'running',
        current_step_index: 1,
        step_results: [
          { step_name: 'client_intake', step_type: 'emit_event', status: 'completed', executed_at: hoursAgo(50) },
        ],
        started_at: hoursAgo(52),
        completed_at: null,
      }

      const delta1 = calculateDelta('inst-dedup', meta, FIVE_STEP_TEMPLATE, [])
      const delta2 = calculateDelta('inst-dedup', meta, FIVE_STEP_TEMPLATE, [])

      const tasks1 = generateTasksFromDelta(delta1, ORG_ID)
      const tasks2 = generateTasksFromDelta(delta2, ORG_ID)

      expect(tasks1.length).toBe(tasks2.length)
      for (let i = 0; i < tasks1.length; i++) {
        expect(tasks1[i].deduplicationKey).toBe(tasks2[i].deduplicationKey)
      }
    })
  })
})
