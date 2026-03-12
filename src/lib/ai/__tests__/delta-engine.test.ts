import { describe, it, expect } from 'vitest'
import { calculateDelta } from '../delta-engine'
import type {
  DeltaInstanceMeta,
  DeltaTemplateStep,
  DeltaEvent,
} from '../delta-types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeStep(name: string, type = 'emit_event', wait_seconds?: number): DeltaTemplateStep {
  return { name, type, ...(wait_seconds !== undefined && { wait_seconds }) }
}

function makeResult(
  step_name: string,
  status: 'completed' | 'failed' | 'waiting' = 'completed',
  executed_at = '2026-03-10T12:00:00Z',
  step_type = 'emit_event'
) {
  return { step_name, step_type, status, executed_at }
}

function makeMeta(overrides: Partial<DeltaInstanceMeta> = {}): DeltaInstanceMeta {
  return {
    template_id: 'tmpl-1',
    source_block_id: 'src-1',
    status: 'running',
    current_step_index: 0,
    step_results: [],
    started_at: '2026-03-10T10:00:00Z',
    completed_at: null,
    ...overrides,
  }
}

function makeEvent(
  type: string,
  occurred_at: string,
  payload: Record<string, unknown> = {}
): DeltaEvent {
  return { id: `evt-${Math.random().toString(36).slice(2, 8)}`, type, occurred_at, payload }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('calculateDelta', () => {
  describe('edge cases', () => {
    it('handles empty template (no steps)', () => {
      const result = calculateDelta('inst-1', makeMeta(), [], [])

      expect(result.totalSteps).toBe(0)
      expect(result.completedSteps).toHaveLength(0)
      expect(result.remainingSteps).toHaveLength(0)
      expect(result.healthScore.score).toBe(100)
    })

    it('handles fresh instance (no events, no step results)', () => {
      const steps = [makeStep('step_one'), makeStep('step_two')]
      const recentStart = new Date(Date.now() - 60_000).toISOString() // 1 min ago
      const meta = makeMeta({ status: 'running', current_step_index: 0, started_at: recentStart })

      const result = calculateDelta('inst-1', meta, steps, [])

      expect(result.totalSteps).toBe(2)
      expect(result.completedSteps).toHaveLength(0)
      expect(result.remainingSteps).toHaveLength(2)
      expect(result.currentStepIndex).toBe(0)
      expect(result.status).toBe('running')
      // First step should be in_progress (just started, not overdue yet)
      expect(result.timelineDeltas[0].status).toBe('in_progress')
      expect(result.timelineDeltas[1].status).toBe('pending')
    })

    it('handles completed workflow', () => {
      const steps = [makeStep('step_one')]
      const meta = makeMeta({
        status: 'done',
        current_step_index: 1,
        step_results: [makeResult('step_one', 'completed', '2026-03-10T11:00:00Z')],
        completed_at: '2026-03-10T11:00:00Z',
      })

      const result = calculateDelta('inst-1', meta, steps, [])

      expect(result.status).toBe('done')
      expect(result.completedSteps).toHaveLength(1)
      expect(result.remainingSteps).toHaveLength(0)
    })

    it('handles single-step workflow', () => {
      const steps = [makeStep('only_step')]
      const meta = makeMeta({
        status: 'running',
        current_step_index: 0,
        started_at: new Date(Date.now() - 60_000).toISOString(), // 1 min ago
      })

      const result = calculateDelta('inst-1', meta, steps, [])

      expect(result.totalSteps).toBe(1)
      expect(result.timelineDeltas).toHaveLength(1)
      expect(result.timelineDeltas[0].status).toBe('in_progress')
    })

    it('handles pending instance (not yet started)', () => {
      const steps = [makeStep('step_one')]
      const meta = makeMeta({
        status: 'pending',
        current_step_index: 0,
        started_at: null,
      })

      const result = calculateDelta('inst-1', meta, steps, [])

      expect(result.status).toBe('pending')
      expect(result.timelineDeltas[0].status).toBe('pending')
    })
  })

  describe('timeline deltas', () => {
    it('calculates actual duration for completed steps', () => {
      const steps = [makeStep('step_one'), makeStep('step_two')]
      const meta = makeMeta({
        current_step_index: 2,
        status: 'done',
        step_results: [
          // step_one completed 1 hour after start
          makeResult('step_one', 'completed', '2026-03-10T11:00:00Z'),
          // step_two completed 2 hours after step_one
          makeResult('step_two', 'completed', '2026-03-10T13:00:00Z'),
        ],
        started_at: '2026-03-10T10:00:00Z',
        completed_at: '2026-03-10T13:00:00Z',
      })

      const result = calculateDelta('inst-1', meta, steps, [])

      // Step one: started at 10:00, completed at 11:00 = 1 hour
      expect(result.timelineDeltas[0].actualDurationHours).toBe(1)
      // Expected is 24h, so variance = 1 - 24 = -23
      expect(result.timelineDeltas[0].varianceHours).toBe(-23)

      // Step two: started at 11:00 (step_one completion), completed at 13:00 = 2 hours
      expect(result.timelineDeltas[1].actualDurationHours).toBe(2)
      expect(result.timelineDeltas[1].varianceHours).toBe(-22)
    })

    it('uses wait_seconds for expected duration on wait steps', () => {
      const steps = [makeStep('wait_step', 'wait', 3600)] // 1 hour wait
      const meta = makeMeta({
        current_step_index: 0,
        started_at: '2026-03-10T10:00:00Z',
      })

      const result = calculateDelta('inst-1', meta, steps, [])

      expect(result.timelineDeltas[0].expectedDurationHours).toBe(1)
    })

    it('defaults to 24h expected duration for non-wait steps', () => {
      const steps = [makeStep('action_step', 'run_action')]
      const meta = makeMeta()

      const result = calculateDelta('inst-1', meta, steps, [])

      expect(result.timelineDeltas[0].expectedDurationHours).toBe(24)
    })
  })

  describe('gap analysis — overdue detection', () => {
    it('detects overdue in-progress step', () => {
      // Step started 25 hours ago with 24h expected
      const startedAt = new Date(Date.now() - 25 * 3_600_000).toISOString()
      const steps = [makeStep('slow_step')]
      const meta = makeMeta({
        current_step_index: 0,
        started_at: startedAt,
      })

      const result = calculateDelta('inst-1', meta, steps, [])

      expect(result.timelineDeltas[0].status).toBe('overdue')
      expect(result.gapAnalysis.overdueSteps).toHaveLength(1)
      expect(result.gapAnalysis.overdueSteps[0].stepName).toBe('slow_step')
      expect(result.gapAnalysis.overdueSteps[0].overdueByHours).toBeGreaterThan(0)
    })

    it('does not flag in-progress step within expected duration', () => {
      // Step started 1 hour ago with 24h expected
      const startedAt = new Date(Date.now() - 1 * 3_600_000).toISOString()
      const steps = [makeStep('fast_step')]
      const meta = makeMeta({
        current_step_index: 0,
        started_at: startedAt,
      })

      const result = calculateDelta('inst-1', meta, steps, [])

      expect(result.timelineDeltas[0].status).toBe('in_progress')
      expect(result.gapAnalysis.overdueSteps).toHaveLength(0)
    })
  })

  describe('gap analysis — skipped steps', () => {
    it('detects skipped steps', () => {
      // current_step_index is 2, but only step_two has a result (step_one was skipped)
      const steps = [makeStep('step_one'), makeStep('step_two'), makeStep('step_three')]
      const meta = makeMeta({
        current_step_index: 2,
        step_results: [
          makeResult('step_two', 'completed', '2026-03-10T12:00:00Z'),
        ],
      })

      const result = calculateDelta('inst-1', meta, steps, [])

      expect(result.gapAnalysis.skippedSteps).toHaveLength(1)
      expect(result.gapAnalysis.skippedSteps[0]).toEqual({
        stepIndex: 0,
        stepName: 'step_one',
      })
    })

    it('returns no skipped steps when all prior steps completed', () => {
      const steps = [makeStep('step_one'), makeStep('step_two')]
      const meta = makeMeta({
        current_step_index: 1,
        step_results: [makeResult('step_one', 'completed')],
      })

      const result = calculateDelta('inst-1', meta, steps, [])

      expect(result.gapAnalysis.skippedSteps).toHaveLength(0)
    })
  })

  describe('gap analysis — out-of-order execution', () => {
    it('detects out-of-order step execution', () => {
      const steps = [makeStep('step_one'), makeStep('step_two'), makeStep('step_three')]
      const meta = makeMeta({
        current_step_index: 3,
        status: 'done',
        step_results: [
          // Executed step_two before step_one
          makeResult('step_two', 'completed', '2026-03-10T11:00:00Z'),
          makeResult('step_one', 'completed', '2026-03-10T12:00:00Z'),
          makeResult('step_three', 'completed', '2026-03-10T13:00:00Z'),
        ],
      })

      const result = calculateDelta('inst-1', meta, steps, [])

      expect(result.gapAnalysis.outOfOrderSteps.length).toBeGreaterThan(0)
    })

    it('returns no out-of-order when steps executed in template order', () => {
      const steps = [makeStep('step_one'), makeStep('step_two')]
      const meta = makeMeta({
        current_step_index: 2,
        status: 'done',
        step_results: [
          makeResult('step_one', 'completed', '2026-03-10T11:00:00Z'),
          makeResult('step_two', 'completed', '2026-03-10T12:00:00Z'),
        ],
      })

      const result = calculateDelta('inst-1', meta, steps, [])

      expect(result.gapAnalysis.outOfOrderSteps).toHaveLength(0)
    })
  })

  describe('health score', () => {
    it('returns 100 for a healthy workflow', () => {
      const steps = [makeStep('step_one')]
      const meta = makeMeta({
        current_step_index: 1,
        status: 'done',
        step_results: [
          // Completed in 1 hour (well within 24h expected)
          makeResult('step_one', 'completed', '2026-03-10T11:00:00Z'),
        ],
        started_at: '2026-03-10T10:00:00Z',
        completed_at: '2026-03-10T11:00:00Z',
      })

      const result = calculateDelta('inst-1', meta, steps, [])

      expect(result.healthScore.score).toBe(100)
      expect(result.healthScore.overduePenalty).toBe(0)
      expect(result.healthScore.skipPenalty).toBe(0)
      expect(result.healthScore.variancePenalty).toBe(0)
    })

    it('penalizes skipped steps', () => {
      const steps = [makeStep('step_one'), makeStep('step_two')]
      const meta = makeMeta({
        current_step_index: 1,
        step_results: [], // step_one has no result but we're past it
      })

      const result = calculateDelta('inst-1', meta, steps, [])

      expect(result.healthScore.skipPenalty).toBe(15)
      expect(result.healthScore.score).toBeLessThan(100)
    })

    it('caps skip penalty at 30', () => {
      const steps = [
        makeStep('s1'), makeStep('s2'), makeStep('s3'),
        makeStep('s4'), makeStep('s5'),
      ]
      const meta = makeMeta({
        current_step_index: 5,
        status: 'done',
        step_results: [], // all 5 skipped
      })

      const result = calculateDelta('inst-1', meta, steps, [])

      // 5 * 15 = 75, but capped at 30
      expect(result.healthScore.skipPenalty).toBe(30)
    })

    it('penalizes overdue steps', () => {
      // Step started 49 hours ago with 24h expected — overdue by ~25h
      const startedAt = new Date(Date.now() - 49 * 3_600_000).toISOString()
      const steps = [makeStep('overdue_step')]
      const meta = makeMeta({
        current_step_index: 0,
        started_at: startedAt,
      })

      const result = calculateDelta('inst-1', meta, steps, [])

      expect(result.healthScore.overduePenalty).toBeGreaterThan(0)
      expect(result.healthScore.score).toBeLessThan(100)
    })

    it('clamps score to 0 minimum', () => {
      // Multiple severe penalties
      const steps = [makeStep('s1'), makeStep('s2'), makeStep('s3')]
      const startedAt = new Date(Date.now() - 200 * 3_600_000).toISOString()
      const meta = makeMeta({
        current_step_index: 2,
        started_at: startedAt,
        step_results: [], // s1 and s2 skipped
      })

      const result = calculateDelta('inst-1', meta, steps, [])

      expect(result.healthScore.score).toBeGreaterThanOrEqual(0)
    })
  })

  describe('failed steps', () => {
    it('marks failed steps correctly', () => {
      const steps = [makeStep('failing_step')]
      const meta = makeMeta({
        current_step_index: 0,
        status: 'failed',
        step_results: [makeResult('failing_step', 'failed', '2026-03-10T11:00:00Z')],
      })

      const result = calculateDelta('inst-1', meta, steps, [])

      expect(result.timelineDeltas[0].status).toBe('failed')
      expect(result.completedSteps).toHaveLength(1) // failed counts as "completed" (done processing)
      expect(result.status).toBe('failed')
    })
  })

  describe('event-based timeline inference', () => {
    it('uses step.completed events for start time inference when step_results gap exists', () => {
      const steps = [makeStep('step_one'), makeStep('step_two')]
      const meta = makeMeta({
        current_step_index: 1,
        started_at: '2026-03-10T10:00:00Z',
        step_results: [
          // step_one result is missing from step_results but event exists
        ],
      })

      const events: DeltaEvent[] = [
        makeEvent('workflow.step.completed', '2026-03-10T11:00:00Z', { step_index: 0 }),
      ]

      const result = calculateDelta('inst-1', meta, steps, events)

      // step_two should use step 0's event completion time as start
      expect(result.timelineDeltas[1].startedAt).toBe('2026-03-10T11:00:00Z')
    })
  })

  describe('result structure', () => {
    it('returns all required fields', () => {
      const steps = [makeStep('step_one'), makeStep('step_two')]
      const meta = makeMeta({
        current_step_index: 1,
        step_results: [makeResult('step_one', 'completed', '2026-03-10T11:00:00Z')],
      })

      const result = calculateDelta('inst-1', meta, steps, [])

      expect(result).toHaveProperty('instanceId', 'inst-1')
      expect(result).toHaveProperty('templateId', 'tmpl-1')
      expect(result).toHaveProperty('currentStepIndex', 1)
      expect(result).toHaveProperty('totalSteps', 2)
      expect(result).toHaveProperty('status', 'running')
      expect(result).toHaveProperty('completedSteps')
      expect(result).toHaveProperty('remainingSteps')
      expect(result).toHaveProperty('timelineDeltas')
      expect(result).toHaveProperty('gapAnalysis')
      expect(result).toHaveProperty('healthScore')
      expect(result).toHaveProperty('calculatedAt')
    })

    it('partitions steps into completed and remaining', () => {
      const steps = [makeStep('s1'), makeStep('s2'), makeStep('s3')]
      const meta = makeMeta({
        current_step_index: 1,
        step_results: [makeResult('s1', 'completed', '2026-03-10T11:00:00Z')],
      })

      const result = calculateDelta('inst-1', meta, steps, [])

      expect(result.completedSteps).toHaveLength(1)
      expect(result.remainingSteps).toHaveLength(2) // in_progress + pending
      expect(result.timelineDeltas).toHaveLength(3)
    })
  })
})
