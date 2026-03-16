import { describe, it, expect } from 'vitest'
import {
  generateTasksFromDelta,
  buildHealthRecommendation,
  buildOverdueRecommendation,
  DEFAULT_THRESHOLDS,
  type GeneratedTask,
  type TaskGenerationThresholds,
} from '../auto-task-generator'
import type {
  DeltaResult,
  GapAnalysis,
  HealthScore,
  StepDelta,
  OverdueStep,
} from '../delta-types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeStepDelta(
  overrides: Partial<StepDelta> = {}
): StepDelta {
  return {
    stepIndex: 0,
    stepName: 'step_one',
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

function makeGapAnalysis(overrides: Partial<GapAnalysis> = {}): GapAnalysis {
  return {
    overdueSteps: [],
    skippedSteps: [],
    outOfOrderSteps: [],
    ...overrides,
  }
}

function makeHealthScore(overrides: Partial<HealthScore> = {}): HealthScore {
  return {
    score: 100,
    overduePenalty: 0,
    skipPenalty: 0,
    variancePenalty: 0,
    ...overrides,
  }
}

function makeDelta(overrides: Partial<DeltaResult> = {}): DeltaResult {
  return {
    instanceId: 'inst-1',
    templateId: 'tmpl-1',
    currentStepIndex: 0,
    totalSteps: 2,
    status: 'running',
    completedSteps: [],
    remainingSteps: [makeStepDelta({ status: 'in_progress' }), makeStepDelta({ stepIndex: 1, stepName: 'step_two', status: 'pending' })],
    timelineDeltas: [makeStepDelta({ status: 'in_progress' }), makeStepDelta({ stepIndex: 1, stepName: 'step_two', status: 'pending' })],
    gapAnalysis: makeGapAnalysis(),
    healthScore: makeHealthScore(),
    calculatedAt: '2026-03-10T12:00:00Z',
    ...overrides,
  }
}

const ORG_ID = 'org-test-1'

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('generateTasksFromDelta', () => {
  describe('healthy workflow — no tasks generated', () => {
    it('generates no tasks when health score is above threshold', () => {
      const delta = makeDelta({ healthScore: makeHealthScore({ score: 75 }) })
      const tasks = generateTasksFromDelta(delta, ORG_ID)
      expect(tasks).toHaveLength(0)
    })

    it('generates no tasks when health score is exactly at threshold', () => {
      const delta = makeDelta({ healthScore: makeHealthScore({ score: 50 }) })
      const tasks = generateTasksFromDelta(delta, ORG_ID)
      expect(tasks).toHaveLength(0)
    })

    it('generates no tasks for a completed healthy workflow', () => {
      const delta = makeDelta({
        status: 'done',
        healthScore: makeHealthScore({ score: 100 }),
        completedSteps: [makeStepDelta({ status: 'completed' })],
        remainingSteps: [],
      })
      const tasks = generateTasksFromDelta(delta, ORG_ID)
      expect(tasks).toHaveLength(0)
    })

    it('generates no tasks when overdue steps are within threshold', () => {
      const delta = makeDelta({
        gapAnalysis: makeGapAnalysis({
          overdueSteps: [{ stepIndex: 0, stepName: 'step_one', overdueByHours: 20 }],
        }),
      })
      const tasks = generateTasksFromDelta(delta, ORG_ID)
      expect(tasks).toHaveLength(0)
    })

    it('generates no tasks when overdue is exactly at threshold', () => {
      const delta = makeDelta({
        gapAnalysis: makeGapAnalysis({
          overdueSteps: [{ stepIndex: 0, stepName: 'step_one', overdueByHours: 24 }],
        }),
      })
      const tasks = generateTasksFromDelta(delta, ORG_ID)
      expect(tasks).toHaveLength(0)
    })
  })

  describe('health critical tasks', () => {
    it('generates a high priority task when health < 50', () => {
      const delta = makeDelta({
        healthScore: makeHealthScore({ score: 45, overduePenalty: 35, skipPenalty: 20 }),
      })
      const tasks = generateTasksFromDelta(delta, ORG_ID)

      expect(tasks).toHaveLength(1)
      expect(tasks[0].triggerType).toBe('health_critical')
      expect(tasks[0].priority).toBe('high')
      expect(tasks[0].title).toContain('inst-1')
      expect(tasks[0].relatedStepIndex).toBeNull()
      expect(tasks[0].relatedStepName).toBeNull()
    })

    it('generates a critical priority task when health < 25', () => {
      const delta = makeDelta({
        healthScore: makeHealthScore({ score: 20, overduePenalty: 40, skipPenalty: 30, variancePenalty: 10 }),
      })
      const tasks = generateTasksFromDelta(delta, ORG_ID)

      expect(tasks).toHaveLength(1)
      expect(tasks[0].triggerType).toBe('health_critical')
      expect(tasks[0].priority).toBe('critical')
    })

    it('uses high priority at score 25 (boundary)', () => {
      const delta = makeDelta({
        healthScore: makeHealthScore({ score: 25, overduePenalty: 40, skipPenalty: 30, variancePenalty: 5 }),
      })
      const tasks = generateTasksFromDelta(delta, ORG_ID)

      expect(tasks).toHaveLength(1)
      expect(tasks[0].priority).toBe('high')
    })

    it('uses critical priority at score 24 (boundary)', () => {
      const delta = makeDelta({
        healthScore: makeHealthScore({ score: 24, overduePenalty: 40, skipPenalty: 30, variancePenalty: 6 }),
      })
      const tasks = generateTasksFromDelta(delta, ORG_ID)

      expect(tasks).toHaveLength(1)
      expect(tasks[0].priority).toBe('critical')
    })

    it('includes health score details in description', () => {
      const delta = makeDelta({
        healthScore: makeHealthScore({ score: 40, overduePenalty: 35, skipPenalty: 15, variancePenalty: 10 }),
      })
      const tasks = generateTasksFromDelta(delta, ORG_ID)

      expect(tasks[0].description).toContain('40/100')
      expect(tasks[0].description).toContain('Overdue penalty')
      expect(tasks[0].description).toContain('Skip penalty')
      expect(tasks[0].description).toContain('Variance penalty')
    })

    it('generates correct deduplication key for high priority', () => {
      const delta = makeDelta({
        healthScore: makeHealthScore({ score: 45 }),
      })
      const tasks = generateTasksFromDelta(delta, ORG_ID)

      expect(tasks[0].deduplicationKey).toBe('health_inst-1_high')
    })

    it('generates correct deduplication key for critical priority', () => {
      const delta = makeDelta({
        healthScore: makeHealthScore({ score: 15 }),
      })
      const tasks = generateTasksFromDelta(delta, ORG_ID)

      expect(tasks[0].deduplicationKey).toBe('health_inst-1_critical')
    })
  })

  describe('overdue step tasks', () => {
    it('generates a task for step overdue > 24h', () => {
      const delta = makeDelta({
        gapAnalysis: makeGapAnalysis({
          overdueSteps: [{ stepIndex: 1, stepName: 'aml_check', overdueByHours: 30 }],
        }),
        timelineDeltas: [
          makeStepDelta({ status: 'completed' }),
          makeStepDelta({ stepIndex: 1, stepName: 'aml_check', stepType: 'route_human', status: 'overdue' }),
        ],
      })
      const tasks = generateTasksFromDelta(delta, ORG_ID)

      expect(tasks).toHaveLength(1)
      expect(tasks[0].triggerType).toBe('step_overdue')
      expect(tasks[0].title).toContain('aml_check')
      expect(tasks[0].title).toContain('30h')
      expect(tasks[0].relatedStepIndex).toBe(1)
      expect(tasks[0].relatedStepName).toBe('aml_check')
      expect(tasks[0].priority).toBe('high')
    })

    it('generates critical priority when overdue > 48h (2x threshold)', () => {
      const delta = makeDelta({
        gapAnalysis: makeGapAnalysis({
          overdueSteps: [{ stepIndex: 0, stepName: 'kyc_review', overdueByHours: 55 }],
        }),
      })
      const tasks = generateTasksFromDelta(delta, ORG_ID)

      expect(tasks).toHaveLength(1)
      expect(tasks[0].priority).toBe('critical')
    })

    it('generates tasks for multiple overdue steps', () => {
      const delta = makeDelta({
        gapAnalysis: makeGapAnalysis({
          overdueSteps: [
            { stepIndex: 0, stepName: 'step_one', overdueByHours: 30 },
            { stepIndex: 1, stepName: 'step_two', overdueByHours: 50 },
          ],
        }),
      })
      const tasks = generateTasksFromDelta(delta, ORG_ID)

      const overdueTasks = tasks.filter((t) => t.triggerType === 'step_overdue')
      expect(overdueTasks).toHaveLength(2)
      expect(overdueTasks[0].relatedStepName).toBe('step_one')
      expect(overdueTasks[1].relatedStepName).toBe('step_two')
    })

    it('generates unique deduplication keys per step', () => {
      const delta = makeDelta({
        gapAnalysis: makeGapAnalysis({
          overdueSteps: [
            { stepIndex: 0, stepName: 'step_one', overdueByHours: 30 },
            { stepIndex: 1, stepName: 'step_two', overdueByHours: 40 },
          ],
        }),
      })
      const tasks = generateTasksFromDelta(delta, ORG_ID)

      const keys = tasks.map((t) => t.deduplicationKey)
      expect(keys).toContain('overdue_inst-1_step_one')
      expect(keys).toContain('overdue_inst-1_step_two')
      expect(new Set(keys).size).toBe(keys.length)
    })

    it('includes recommendation mentioning reassignment for route_human steps', () => {
      const delta = makeDelta({
        gapAnalysis: makeGapAnalysis({
          overdueSteps: [{ stepIndex: 0, stepName: 'review', overdueByHours: 30 }],
        }),
        timelineDeltas: [
          makeStepDelta({ stepIndex: 0, stepName: 'review', stepType: 'route_human', status: 'overdue' }),
        ],
      })
      const tasks = generateTasksFromDelta(delta, ORG_ID)

      expect(tasks[0].recommendation).toContain('assignee')
    })
  })

  describe('failed workflow tasks', () => {
    it('generates a critical task for failed workflow', () => {
      const delta = makeDelta({
        status: 'failed',
        completedSteps: [makeStepDelta({ stepIndex: 1, stepName: 'failing_step', status: 'failed' })],
      })
      const tasks = generateTasksFromDelta(delta, ORG_ID)

      const failedTasks = tasks.filter((t) => t.triggerType === 'workflow_failed')
      expect(failedTasks).toHaveLength(1)
      expect(failedTasks[0].priority).toBe('critical')
      expect(failedTasks[0].title).toContain('inst-1')
      expect(failedTasks[0].relatedStepName).toBe('failing_step')
      expect(failedTasks[0].relatedStepIndex).toBe(1)
    })

    it('generates correct deduplication key for failed workflow', () => {
      const delta = makeDelta({
        status: 'failed',
        completedSteps: [makeStepDelta({ status: 'failed' })],
      })
      const tasks = generateTasksFromDelta(delta, ORG_ID)

      const failedTask = tasks.find((t) => t.triggerType === 'workflow_failed')
      expect(failedTask?.deduplicationKey).toBe('failed_inst-1')
    })

    it('handles failed workflow with no identifiable failed step', () => {
      const delta = makeDelta({
        status: 'failed',
        completedSteps: [], // no step_results to identify failure point
      })
      const tasks = generateTasksFromDelta(delta, ORG_ID)

      const failedTask = tasks.find((t) => t.triggerType === 'workflow_failed')
      expect(failedTask).toBeDefined()
      expect(failedTask?.relatedStepIndex).toBeNull()
      expect(failedTask?.relatedStepName).toBeNull()
    })

    it('includes completion percentage in recommendation when > 50%', () => {
      const delta = makeDelta({
        status: 'failed',
        totalSteps: 4,
        completedSteps: [
          makeStepDelta({ stepIndex: 0, stepName: 's1', status: 'completed' }),
          makeStepDelta({ stepIndex: 1, stepName: 's2', status: 'completed' }),
          makeStepDelta({ stepIndex: 2, stepName: 's3', status: 'failed' }),
        ],
      })
      const tasks = generateTasksFromDelta(delta, ORG_ID)

      const failedTask = tasks.find((t) => t.triggerType === 'workflow_failed')
      expect(failedTask?.recommendation).toContain('restarting from the failed step')
    })
  })

  describe('stalled workflow tasks', () => {
    it('generates a task when workflow is stalled', () => {
      const delta = makeDelta({
        status: 'running',
        currentStepIndex: 1,
        completedSteps: [makeStepDelta({ status: 'completed' })],
        timelineDeltas: [
          makeStepDelta({ status: 'completed' }),
          makeStepDelta({
            stepIndex: 1,
            stepName: 'stalled_step',
            status: 'in_progress',
            actualDurationHours: 30,
          }),
        ],
      })
      const tasks = generateTasksFromDelta(delta, ORG_ID)

      const stalledTasks = tasks.filter((t) => t.triggerType === 'workflow_stalled')
      expect(stalledTasks).toHaveLength(1)
      expect(stalledTasks[0].priority).toBe('high')
      expect(stalledTasks[0].deduplicationKey).toBe('stalled_inst-1')
    })

    it('does not generate stalled task for freshly started workflow', () => {
      const delta = makeDelta({
        status: 'running',
        currentStepIndex: 0,
        completedSteps: [], // no completed steps = freshly started
        timelineDeltas: [
          makeStepDelta({
            stepIndex: 0,
            stepName: 'first_step',
            status: 'in_progress',
            actualDurationHours: 30,
          }),
        ],
      })
      const tasks = generateTasksFromDelta(delta, ORG_ID)

      const stalledTasks = tasks.filter((t) => t.triggerType === 'workflow_stalled')
      expect(stalledTasks).toHaveLength(0)
    })

    it('does not generate stalled task when duration is within threshold', () => {
      const delta = makeDelta({
        status: 'running',
        currentStepIndex: 1,
        completedSteps: [makeStepDelta({ status: 'completed' })],
        timelineDeltas: [
          makeStepDelta({ status: 'completed' }),
          makeStepDelta({
            stepIndex: 1,
            stepName: 'active_step',
            status: 'in_progress',
            actualDurationHours: 10,
          }),
        ],
      })
      const tasks = generateTasksFromDelta(delta, ORG_ID)

      const stalledTasks = tasks.filter((t) => t.triggerType === 'workflow_stalled')
      expect(stalledTasks).toHaveLength(0)
    })
  })

  describe('multiple triggers', () => {
    it('generates multiple tasks for different issues', () => {
      const delta = makeDelta({
        healthScore: makeHealthScore({ score: 30, overduePenalty: 40, skipPenalty: 30 }),
        gapAnalysis: makeGapAnalysis({
          overdueSteps: [{ stepIndex: 0, stepName: 'slow_step', overdueByHours: 50 }],
        }),
      })
      const tasks = generateTasksFromDelta(delta, ORG_ID)

      const triggerTypes = tasks.map((t) => t.triggerType)
      expect(triggerTypes).toContain('health_critical')
      expect(triggerTypes).toContain('step_overdue')
      expect(tasks.length).toBeGreaterThanOrEqual(2)
    })

    it('generates health + failed tasks for failed workflow with low health', () => {
      const delta = makeDelta({
        status: 'failed',
        healthScore: makeHealthScore({ score: 10 }),
        completedSteps: [makeStepDelta({ status: 'failed' })],
      })
      const tasks = generateTasksFromDelta(delta, ORG_ID)

      const triggerTypes = tasks.map((t) => t.triggerType)
      expect(triggerTypes).toContain('health_critical')
      expect(triggerTypes).toContain('workflow_failed')
    })
  })

  describe('deduplication keys', () => {
    it('generates unique keys across all trigger types', () => {
      const delta = makeDelta({
        status: 'failed',
        healthScore: makeHealthScore({ score: 20 }),
        gapAnalysis: makeGapAnalysis({
          overdueSteps: [
            { stepIndex: 0, stepName: 'step_a', overdueByHours: 30 },
            { stepIndex: 1, stepName: 'step_b', overdueByHours: 40 },
          ],
        }),
        completedSteps: [makeStepDelta({ status: 'failed' })],
      })
      const tasks = generateTasksFromDelta(delta, ORG_ID)

      const keys = tasks.map((t) => t.deduplicationKey)
      expect(new Set(keys).size).toBe(keys.length)
    })

    it('includes instanceId in all deduplication keys', () => {
      const delta = makeDelta({
        instanceId: 'inst-unique-42',
        healthScore: makeHealthScore({ score: 30 }),
        gapAnalysis: makeGapAnalysis({
          overdueSteps: [{ stepIndex: 0, stepName: 'step_a', overdueByHours: 30 }],
        }),
      })
      const tasks = generateTasksFromDelta(delta, ORG_ID)

      for (const task of tasks) {
        expect(task.deduplicationKey).toContain('inst-unique-42')
      }
    })

    it('different instances produce different deduplication keys', () => {
      const delta1 = makeDelta({
        instanceId: 'inst-1',
        healthScore: makeHealthScore({ score: 30 }),
      })
      const delta2 = makeDelta({
        instanceId: 'inst-2',
        healthScore: makeHealthScore({ score: 30 }),
      })

      const tasks1 = generateTasksFromDelta(delta1, ORG_ID)
      const tasks2 = generateTasksFromDelta(delta2, ORG_ID)

      expect(tasks1[0].deduplicationKey).not.toBe(tasks2[0].deduplicationKey)
    })
  })

  describe('custom thresholds', () => {
    it('respects custom health threshold', () => {
      const customThresholds: TaskGenerationThresholds = {
        healthScoreMin: 70,
        criticalHealthScore: 30,
        overdueHoursMax: 24,
      }
      const delta = makeDelta({
        healthScore: makeHealthScore({ score: 65 }),
      })
      const tasks = generateTasksFromDelta(delta, ORG_ID, customThresholds)

      expect(tasks).toHaveLength(1)
      expect(tasks[0].triggerType).toBe('health_critical')
    })

    it('respects custom overdue threshold', () => {
      const customThresholds: TaskGenerationThresholds = {
        healthScoreMin: 50,
        criticalHealthScore: 25,
        overdueHoursMax: 12,
      }
      const delta = makeDelta({
        gapAnalysis: makeGapAnalysis({
          overdueSteps: [{ stepIndex: 0, stepName: 'step_one', overdueByHours: 15 }],
        }),
      })
      const tasks = generateTasksFromDelta(delta, ORG_ID, customThresholds)

      expect(tasks).toHaveLength(1)
      expect(tasks[0].triggerType).toBe('step_overdue')
    })

    it('uses default thresholds when none provided', () => {
      expect(DEFAULT_THRESHOLDS.healthScoreMin).toBe(50)
      expect(DEFAULT_THRESHOLDS.criticalHealthScore).toBe(25)
      expect(DEFAULT_THRESHOLDS.overdueHoursMax).toBe(24)
    })

    it('respects custom critical health threshold', () => {
      const customThresholds: TaskGenerationThresholds = {
        healthScoreMin: 50,
        criticalHealthScore: 40,
        overdueHoursMax: 24,
      }
      const delta = makeDelta({
        healthScore: makeHealthScore({ score: 35 }),
      })
      const tasks = generateTasksFromDelta(delta, ORG_ID, customThresholds)

      expect(tasks).toHaveLength(1)
      expect(tasks[0].priority).toBe('critical')
    })
  })

  describe('GeneratedTask shape', () => {
    it('returns all required fields', () => {
      const delta = makeDelta({
        healthScore: makeHealthScore({ score: 30 }),
      })
      const tasks = generateTasksFromDelta(delta, ORG_ID)
      const task = tasks[0]

      expect(task).toHaveProperty('title')
      expect(task).toHaveProperty('description')
      expect(task).toHaveProperty('priority')
      expect(task).toHaveProperty('triggerType')
      expect(task).toHaveProperty('relatedStepIndex')
      expect(task).toHaveProperty('relatedStepName')
      expect(task).toHaveProperty('recommendation')
      expect(task).toHaveProperty('deduplicationKey')
    })

    it('title is a non-empty string', () => {
      const delta = makeDelta({
        healthScore: makeHealthScore({ score: 30 }),
      })
      const tasks = generateTasksFromDelta(delta, ORG_ID)

      for (const task of tasks) {
        expect(typeof task.title).toBe('string')
        expect(task.title.length).toBeGreaterThan(0)
      }
    })

    it('recommendation is a non-empty string', () => {
      const delta = makeDelta({
        healthScore: makeHealthScore({ score: 30, overduePenalty: 40 }),
      })
      const tasks = generateTasksFromDelta(delta, ORG_ID)

      for (const task of tasks) {
        expect(typeof task.recommendation).toBe('string')
        expect(task.recommendation.length).toBeGreaterThan(0)
      }
    })
  })
})

describe('buildHealthRecommendation', () => {
  it('mentions overdue when overdue penalty is dominant', () => {
    const delta = makeDelta({
      healthScore: makeHealthScore({ score: 40, overduePenalty: 35, skipPenalty: 15, variancePenalty: 10 }),
    })
    const rec = buildHealthRecommendation(delta)

    expect(rec).toContain('overdue')
  })

  it('lists skipped step names when skip penalty exists', () => {
    const delta = makeDelta({
      healthScore: makeHealthScore({ score: 40, skipPenalty: 15 }),
      gapAnalysis: makeGapAnalysis({
        skippedSteps: [{ stepIndex: 0, stepName: 'kyc_check' }],
      }),
    })
    const rec = buildHealthRecommendation(delta)

    expect(rec).toContain('kyc_check')
  })

  it('mentions variance when variance penalty exists', () => {
    const delta = makeDelta({
      healthScore: makeHealthScore({ score: 40, variancePenalty: 15 }),
    })
    const rec = buildHealthRecommendation(delta)

    expect(rec).toContain('variance')
  })

  it('mentions out-of-order steps when present', () => {
    const delta = makeDelta({
      healthScore: makeHealthScore({ score: 40, overduePenalty: 30 }),
      gapAnalysis: makeGapAnalysis({
        outOfOrderSteps: [{ stepIndex: 0, stepName: 's1', expectedOrder: 0, actualOrder: 1 }],
      }),
    })
    const rec = buildHealthRecommendation(delta)

    expect(rec).toContain('out of order')
  })

  it('provides a fallback recommendation when no specific penalties', () => {
    const delta = makeDelta({
      healthScore: makeHealthScore({ score: 40 }),
    })
    const rec = buildHealthRecommendation(delta)

    expect(rec).toContain('below threshold')
  })
})

describe('buildOverdueRecommendation', () => {
  it('suggests escalation for severely overdue steps (> 48h)', () => {
    const step: OverdueStep = { stepIndex: 0, stepName: 'review', overdueByHours: 55 }
    const delta = makeDelta({
      timelineDeltas: [makeStepDelta({ stepIndex: 0, stepName: 'review', stepType: 'emit_event' })],
    })
    const rec = buildOverdueRecommendation(step, delta)

    expect(rec).toContain('reassigning')
    expect(rec).toContain('escalating')
  })

  it('suggests deadline extension for moderately overdue steps', () => {
    const step: OverdueStep = { stepIndex: 0, stepName: 'check', overdueByHours: 30 }
    const delta = makeDelta({
      timelineDeltas: [makeStepDelta({ stepIndex: 0, stepName: 'check' })],
    })
    const rec = buildOverdueRecommendation(step, delta)

    expect(rec).toContain('deadline')
  })

  it('mentions assignee verification for route_human steps', () => {
    const step: OverdueStep = { stepIndex: 0, stepName: 'approval', overdueByHours: 30 }
    const delta = makeDelta({
      timelineDeltas: [
        makeStepDelta({ stepIndex: 0, stepName: 'approval', stepType: 'route_human', status: 'overdue' }),
      ],
    })
    const rec = buildOverdueRecommendation(step, delta)

    expect(rec).toContain('assignee')
  })
})
