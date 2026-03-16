import { describe, it, expect } from 'vitest'
import { evaluateDeltaTriggers, type NotificationPayload } from '../delta-triggers'
import type { DeltaResult } from '@/lib/ai/delta-types'

// ─── Test Helpers ───────────────────────────────────────────────────────────

function buildDelta(overrides: Partial<DeltaResult> = {}): DeltaResult {
  return {
    instanceId: 'inst-001',
    templateId: 'tmpl-001',
    currentStepIndex: 2,
    totalSteps: 5,
    status: 'running',
    completedSteps: [],
    remainingSteps: [],
    timelineDeltas: [],
    gapAnalysis: {
      overdueSteps: [],
      skippedSteps: [],
      outOfOrderSteps: [],
    },
    healthScore: {
      score: 85,
      overduePenalty: 5,
      skipPenalty: 0,
      variancePenalty: 10,
    },
    calculatedAt: '2026-03-12T10:00:00Z',
    ...overrides,
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('evaluateDeltaTriggers', () => {
  describe('healthy workflow — no notifications', () => {
    it('returns empty array when health score is above threshold and no issues', () => {
      const delta = buildDelta({
        healthScore: { score: 85, overduePenalty: 5, skipPenalty: 0, variancePenalty: 10 },
      })

      const result = evaluateDeltaTriggers(delta)

      expect(result).toEqual([])
    })

    it('returns empty array when health score is exactly 50', () => {
      const delta = buildDelta({
        healthScore: { score: 50, overduePenalty: 20, skipPenalty: 10, variancePenalty: 20 },
      })

      const result = evaluateDeltaTriggers(delta)

      expect(result).toEqual([])
    })

    it('returns empty array when overdue steps are within 24h threshold', () => {
      const delta = buildDelta({
        gapAnalysis: {
          overdueSteps: [
            { stepIndex: 1, stepName: 'KYC Review', overdueByHours: 12 },
            { stepIndex: 2, stepName: 'AML Check', overdueByHours: 24 },
          ],
          skippedSteps: [],
          outOfOrderSteps: [],
        },
      })

      const result = evaluateDeltaTriggers(delta)

      expect(result).toEqual([])
    })
  })

  describe('health score critical — below 50', () => {
    it('generates a delta_alert when health score drops below 50', () => {
      const delta = buildDelta({
        healthScore: { score: 30, overduePenalty: 40, skipPenalty: 20, variancePenalty: 10 },
      })

      const result = evaluateDeltaTriggers(delta)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: 'delta_alert',
        title: 'Workflow health critical (30/100)',
        block_id: 'inst-001',
      })
    })

    it('includes penalty breakdown in body', () => {
      const delta = buildDelta({
        healthScore: { score: 25, overduePenalty: 40, skipPenalty: 15, variancePenalty: 20 },
      })

      const result = evaluateDeltaTriggers(delta)

      expect(result[0].body).toContain('overdue penalty: -40')
      expect(result[0].body).toContain('skip penalty: -15')
      expect(result[0].body).toContain('variance penalty: -20')
    })

    it('includes progress info in body', () => {
      const delta = buildDelta({
        currentStepIndex: 1,
        totalSteps: 8,
        healthScore: { score: 10, overduePenalty: 50, skipPenalty: 30, variancePenalty: 10 },
      })

      const result = evaluateDeltaTriggers(delta)

      expect(result[0].body).toContain('step 2 of 8')
    })

    it('handles zero health score', () => {
      const delta = buildDelta({
        healthScore: { score: 0, overduePenalty: 50, skipPenalty: 30, variancePenalty: 20 },
      })

      const result = evaluateDeltaTriggers(delta)

      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Workflow health critical (0/100)')
    })
  })

  describe('overdue steps — beyond 24h threshold', () => {
    it('generates one notification per overdue step exceeding 24h', () => {
      const delta = buildDelta({
        gapAnalysis: {
          overdueSteps: [
            { stepIndex: 0, stepName: 'KYC Review', overdueByHours: 48 },
            { stepIndex: 2, stepName: 'Legal Review', overdueByHours: 72 },
          ],
          skippedSteps: [],
          outOfOrderSteps: [],
        },
      })

      const result = evaluateDeltaTriggers(delta)

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        type: 'delta_alert',
        title: 'Step "KYC Review" overdue by 48h',
        block_id: 'inst-001',
      })
      expect(result[1]).toMatchObject({
        type: 'delta_alert',
        title: 'Step "Legal Review" overdue by 72h',
        block_id: 'inst-001',
      })
    })

    it('rounds fractional overdue hours in the title', () => {
      const delta = buildDelta({
        gapAnalysis: {
          overdueSteps: [
            { stepIndex: 0, stepName: 'Review', overdueByHours: 36.7 },
          ],
          skippedSteps: [],
          outOfOrderSteps: [],
        },
      })

      const result = evaluateDeltaTriggers(delta)

      expect(result[0].title).toBe('Step "Review" overdue by 37h')
    })

    it('does not generate notification for step overdue by exactly 24h', () => {
      const delta = buildDelta({
        gapAnalysis: {
          overdueSteps: [
            { stepIndex: 0, stepName: 'AML Check', overdueByHours: 24 },
          ],
          skippedSteps: [],
          outOfOrderSteps: [],
        },
      })

      const result = evaluateDeltaTriggers(delta)

      expect(result).toEqual([])
    })

    it('includes step index in body', () => {
      const delta = buildDelta({
        gapAnalysis: {
          overdueSteps: [
            { stepIndex: 3, stepName: 'Compliance', overdueByHours: 30 },
          ],
          skippedSteps: [],
          outOfOrderSteps: [],
        },
      })

      const result = evaluateDeltaTriggers(delta)

      expect(result[0].body).toContain('Step 4')
    })
  })

  describe('failed workflow status', () => {
    it('generates a delta_alert when workflow status is failed', () => {
      const delta = buildDelta({ status: 'failed' })

      const result = evaluateDeltaTriggers(delta)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: 'delta_alert',
        title: 'Workflow instance failed',
        block_id: 'inst-001',
      })
    })

    it('includes instance and template IDs in body', () => {
      const delta = buildDelta({
        status: 'failed',
        instanceId: 'my-instance',
        templateId: 'my-template',
      })

      const result = evaluateDeltaTriggers(delta)

      expect(result[0].body).toContain('my-instance')
      expect(result[0].body).toContain('my-template')
    })

    it('includes step progress in body', () => {
      const delta = buildDelta({
        status: 'failed',
        currentStepIndex: 3,
        totalSteps: 7,
      })

      const result = evaluateDeltaTriggers(delta)

      expect(result[0].body).toContain('step 4 of 7')
    })

    it('does not trigger for done status', () => {
      const delta = buildDelta({ status: 'done' })

      const result = evaluateDeltaTriggers(delta)

      expect(result).toEqual([])
    })

    it('does not trigger for running status', () => {
      const delta = buildDelta({ status: 'running' })

      const result = evaluateDeltaTriggers(delta)

      expect(result).toEqual([])
    })

    it('does not trigger for pending status', () => {
      const delta = buildDelta({ status: 'pending' })

      const result = evaluateDeltaTriggers(delta)

      expect(result).toEqual([])
    })
  })

  describe('combined triggers — multiple conditions at once', () => {
    it('generates notifications for all breached conditions', () => {
      const delta = buildDelta({
        status: 'failed',
        healthScore: { score: 20, overduePenalty: 40, skipPenalty: 20, variancePenalty: 20 },
        gapAnalysis: {
          overdueSteps: [
            { stepIndex: 0, stepName: 'Step A', overdueByHours: 48 },
            { stepIndex: 1, stepName: 'Step B', overdueByHours: 36 },
          ],
          skippedSteps: [],
          outOfOrderSteps: [],
        },
      })

      const result = evaluateDeltaTriggers(delta)

      // health (1) + overdue steps (2) + failed (1) = 4
      expect(result).toHaveLength(4)

      const types = result.map((n: NotificationPayload) => n.title)
      expect(types).toContain('Workflow health critical (20/100)')
      expect(types).toContain('Step "Step A" overdue by 48h')
      expect(types).toContain('Step "Step B" overdue by 36h')
      expect(types).toContain('Workflow instance failed')
    })

    it('all notifications have type delta_alert', () => {
      const delta = buildDelta({
        status: 'failed',
        healthScore: { score: 10, overduePenalty: 50, skipPenalty: 20, variancePenalty: 20 },
        gapAnalysis: {
          overdueSteps: [
            { stepIndex: 0, stepName: 'Step A', overdueByHours: 100 },
          ],
          skippedSteps: [],
          outOfOrderSteps: [],
        },
      })

      const result = evaluateDeltaTriggers(delta)

      for (const notification of result) {
        expect(notification.type).toBe('delta_alert')
      }
    })

    it('all notifications reference the instance ID as block_id', () => {
      const delta = buildDelta({
        instanceId: 'specific-instance-id',
        status: 'failed',
        healthScore: { score: 10, overduePenalty: 50, skipPenalty: 20, variancePenalty: 20 },
      })

      const result = evaluateDeltaTriggers(delta)

      for (const notification of result) {
        expect(notification.block_id).toBe('specific-instance-id')
      }
    })
  })

  describe('edge cases', () => {
    it('handles empty overdue steps array', () => {
      const delta = buildDelta({
        gapAnalysis: {
          overdueSteps: [],
          skippedSteps: [],
          outOfOrderSteps: [],
        },
      })

      const result = evaluateDeltaTriggers(delta)

      expect(result).toEqual([])
    })

    it('handles health score of exactly 49 (just below threshold)', () => {
      const delta = buildDelta({
        healthScore: { score: 49, overduePenalty: 30, skipPenalty: 10, variancePenalty: 11 },
      })

      const result = evaluateDeltaTriggers(delta)

      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Workflow health critical (49/100)')
    })

    it('handles overdue step at 24.01 hours (just over threshold)', () => {
      const delta = buildDelta({
        gapAnalysis: {
          overdueSteps: [
            { stepIndex: 0, stepName: 'Barely Overdue', overdueByHours: 24.01 },
          ],
          skippedSteps: [],
          outOfOrderSteps: [],
        },
      })

      const result = evaluateDeltaTriggers(delta)

      expect(result).toHaveLength(1)
    })

    it('health body omits zero penalties', () => {
      const delta = buildDelta({
        healthScore: { score: 40, overduePenalty: 60, skipPenalty: 0, variancePenalty: 0 },
      })

      const result = evaluateDeltaTriggers(delta)

      expect(result[0].body).toContain('overdue penalty: -60')
      expect(result[0].body).not.toContain('skip penalty')
      expect(result[0].body).not.toContain('variance penalty')
    })
  })
})
