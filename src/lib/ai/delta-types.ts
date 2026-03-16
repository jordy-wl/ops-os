/**
 * Delta Engine Types — structured results from comparing
 * workflow template design (steps) vs instance reality (step_results + events).
 *
 * All types are pure data — no database or API dependencies.
 */

// ─── Input Types (lightweight, no heavy imports) ──────────────────────────────

/** Minimal step result shape matching step-engine.ts StepResult */
export type DeltaStepResult = {
  step_name: string
  step_type: string
  status: 'completed' | 'failed' | 'waiting'
  output?: Record<string, unknown>
  error?: string
  executed_at: string
}

/** Minimal instance metadata shape for delta calculation */
export type DeltaInstanceMeta = {
  template_id: string
  source_block_id: string
  status: 'pending' | 'running' | 'done' | 'failed'
  current_step_index: number
  step_results: DeltaStepResult[]
  started_at: string | null
  completed_at: string | null
}

/** Minimal template step shape for delta calculation */
export type DeltaTemplateStep = {
  name: string
  type: string
  wait_seconds?: number
  routing_mode?: string
  instructions?: string
}

/** Event record used for timeline analysis */
export type DeltaEvent = {
  id: string
  type: string
  occurred_at: string
  payload: Record<string, unknown>
}

// ─── Output Types ─────────────────────────────────────────────────────────────

export type StepStatus =
  | 'completed'
  | 'in_progress'
  | 'pending'
  | 'skipped'
  | 'failed'
  | 'overdue'

export type StepDelta = {
  stepIndex: number
  stepName: string
  stepType: string
  status: StepStatus
  expectedDurationHours: number
  actualDurationHours: number | null
  varianceHours: number | null
  startedAt: string | null
  completedAt: string | null
}

export type GapAnalysis = {
  overdueSteps: OverdueStep[]
  skippedSteps: SkippedStep[]
  outOfOrderSteps: OutOfOrderStep[]
}

export type OverdueStep = {
  stepIndex: number
  stepName: string
  overdueByHours: number
}

export type SkippedStep = {
  stepIndex: number
  stepName: string
}

export type OutOfOrderStep = {
  stepIndex: number
  stepName: string
  expectedOrder: number
  actualOrder: number
}

export type HealthScore = {
  score: number // 0-100
  overduePenalty: number
  skipPenalty: number
  variancePenalty: number
}

export type DeltaResult = {
  instanceId: string
  templateId: string
  currentStepIndex: number
  totalSteps: number
  status: DeltaInstanceMeta['status']
  completedSteps: StepDelta[]
  remainingSteps: StepDelta[]
  timelineDeltas: StepDelta[]
  gapAnalysis: GapAnalysis
  healthScore: HealthScore
  calculatedAt: string
}
