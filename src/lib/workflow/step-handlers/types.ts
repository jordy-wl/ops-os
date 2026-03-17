import type { createServerClient } from '@/lib/supabase/server'
import type { StepResult } from '../step-engine'
import type { WorkflowStep } from '../template-schema'

export type InstanceMetadata = {
  template_id: string
  source_block_id: string
  applies_to_type: string
  status: 'pending' | 'running' | 'done' | 'failed'
  current_step_index: number
  step_results: StepResult[]
  started_at: string | null
  completed_at: string | null
}

export type StepHandler = (
  step: WorkflowStep,
  meta: InstanceMetadata,
  orgId: string,
  supabase: ReturnType<typeof createServerClient>
) => Promise<StepResult>
