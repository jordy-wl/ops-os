import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import type { WorkflowStep } from './template-schema'

export type StepResult = {
  step_name: string
  step_type: string
  status: 'completed' | 'failed' | 'waiting'
  output?: Record<string, unknown>
  error?: string
  executed_at: string
}

type InstanceMetadata = {
  template_id: string
  source_block_id: string
  applies_to_type: string
  status: 'pending' | 'running' | 'done' | 'failed'
  current_step_index: number
  step_results: StepResult[]
  started_at: string | null
  completed_at: string | null
}

type AdvanceResult = {
  status: 'advanced' | 'completed' | 'waiting' | 'failed'
  step_result: StepResult
  instance_status: string
}

/**
 * Advances a workflow instance by executing its current step.
 * Returns the result of the step execution.
 */
export async function advanceWorkflowInstance(
  instanceId: string,
  orgId: string
): Promise<AdvanceResult> {
  const supabase = createServerClient()

  // 1. Read the instance
  const { data: instance, error: instanceError } = await supabase
    .from('blocks')
    .select('id, metadata, name')
    .eq('id', instanceId)
    .eq('org_id', orgId)
    .eq('type', 'workflow_instance')
    .single()

  if (instanceError || !instance) {
    throw new Error(`Instance not found: ${instanceId}`)
  }

  const meta = instance.metadata as InstanceMetadata

  if (meta.status === 'done' || meta.status === 'failed') {
    throw new Error(`Instance ${instanceId} is already ${meta.status}`)
  }

  // 2. Read the template to get steps
  const { data: template, error: templateError } = await supabase
    .from('blocks')
    .select('id, metadata')
    .eq('id', meta.template_id)
    .eq('type', 'workflow_template')
    .single()

  if (templateError || !template) {
    throw new Error(`Template not found: ${meta.template_id}`)
  }

  const templateMeta = template.metadata as { steps: WorkflowStep[] }
  const steps = templateMeta.steps

  if (meta.current_step_index >= steps.length) {
    throw new Error(`Step index ${meta.current_step_index} out of bounds (${steps.length} steps)`)
  }

  const currentStep = steps[meta.current_step_index]
  const now = new Date().toISOString()

  // Mark as running if this is the first step
  if (meta.status === 'pending') {
    await supabase
      .from('blocks')
      .update({
        metadata: { ...meta, status: 'running', started_at: now },
      })
      .eq('id', instanceId)
    meta.status = 'running'
    meta.started_at = now
  }

  // 3. Execute the step
  let stepResult: StepResult

  try {
    stepResult = await executeStep(currentStep, meta, orgId, supabase)
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    stepResult = {
      step_name: currentStep.name,
      step_type: currentStep.type,
      status: 'failed',
      error: errorMsg,
      executed_at: now,
    }
  }

  // 4. Record result and advance
  const updatedResults = [...meta.step_results, stepResult]
  const nextIndex = meta.current_step_index + 1

  let instanceStatus: InstanceMetadata['status'] = 'running'
  let completedAt: string | null = null

  if (stepResult.status === 'failed') {
    instanceStatus = 'failed'
    completedAt = now
  } else if (stepResult.status === 'waiting') {
    // Step is waiting (e.g. for a human task or timer) — don't advance
    instanceStatus = 'running'
  } else if (nextIndex >= steps.length) {
    instanceStatus = 'done'
    completedAt = now
  }

  const updatedMeta: InstanceMetadata = {
    ...meta,
    status: instanceStatus,
    current_step_index: stepResult.status === 'waiting' ? meta.current_step_index : nextIndex,
    step_results: updatedResults,
    completed_at: completedAt,
  }

  await supabase
    .from('blocks')
    .update({ metadata: updatedMeta })
    .eq('id', instanceId)

  // 5. Emit completion event if done
  if (instanceStatus === 'done') {
    await supabase.from('events').insert({
      org_id: orgId,
      block_id: instanceId,
      type: 'workflow.instance.completed',
      actor_type: 'system',
      payload: {
        template_id: meta.template_id,
        source_block_id: meta.source_block_id,
        step_count: steps.length,
        duration_ms: meta.started_at
          ? new Date(now).getTime() - new Date(meta.started_at).getTime()
          : null,
      },
    })
  }

  // 6. Emit step event
  await supabase.from('events').insert({
    org_id: orgId,
    block_id: instanceId,
    type: stepResult.status === 'failed' ? 'workflow.step.failed' : 'workflow.step.completed',
    actor_type: 'system',
    payload: {
      step_name: currentStep.name,
      step_type: currentStep.type,
      step_index: meta.current_step_index,
      result_status: stepResult.status,
    },
  })

  return {
    status: instanceStatus === 'done'
      ? 'completed'
      : stepResult.status === 'waiting'
        ? 'waiting'
        : stepResult.status === 'failed'
          ? 'failed'
          : 'advanced',
    step_result: stepResult,
    instance_status: instanceStatus,
  }
}

/**
 * Execute a single workflow step.
 */
async function executeStep(
  step: WorkflowStep,
  meta: InstanceMetadata,
  orgId: string,
  supabase: ReturnType<typeof createServerClient>
): Promise<StepResult> {
  const now = new Date().toISOString()

  switch (step.type) {
    case 'emit_event': {
      if (!step.event_type) {
        return { step_name: step.name, step_type: step.type, status: 'failed', error: 'Missing event_type', executed_at: now }
      }
      const { error } = await supabase.from('events').insert({
        org_id: orgId,
        block_id: meta.source_block_id,
        type: step.event_type,
        actor_type: 'workflow',
        payload: { workflow_instance_id: meta.template_id, step_name: step.name },
      })
      if (error) {
        logger.error('step-engine', 'step.emit_event_failed', { error_code: error.code })
        return { step_name: step.name, step_type: step.type, status: 'failed', error: error.message, executed_at: now }
      }
      return { step_name: step.name, step_type: step.type, status: 'completed', output: { event_type: step.event_type }, executed_at: now }
    }

    case 'run_action': {
      if (!step.action_type) {
        return { step_name: step.name, step_type: step.type, status: 'failed', error: 'Missing action_type', executed_at: now }
      }
      // For now, emit an event recording the action request.
      // Full action dispatch will be wired in when the action registry supports it.
      await supabase.from('events').insert({
        org_id: orgId,
        block_id: meta.source_block_id,
        type: 'action.requested',
        actor_type: 'workflow',
        payload: { action_type: step.action_type, step_name: step.name, workflow_instance_id: meta.template_id },
      })
      return { step_name: step.name, step_type: step.type, status: 'completed', output: { action_type: step.action_type }, executed_at: now }
    }

    case 'wait': {
      const waitSeconds = step.wait_seconds ?? 60
      // Schedule a future workflow_job to resume this instance
      const scheduledAt = new Date(Date.now() + waitSeconds * 1000).toISOString()
      const { error } = await supabase.from('workflow_jobs').insert({
        org_id: orgId,
        workflow_type: 'resume_instance',
        step_name: step.name,
        status: 'pending',
        payload: { instance_id: meta.template_id, step_index: meta.current_step_index },
        scheduled_at: scheduledAt,
      })
      if (error) {
        logger.error('step-engine', 'step.wait_schedule_failed', { error_code: error.code })
        return { step_name: step.name, step_type: step.type, status: 'failed', error: error.message, executed_at: now }
      }
      return { step_name: step.name, step_type: step.type, status: 'waiting', output: { scheduled_at: scheduledAt, wait_seconds: waitSeconds }, executed_at: now }
    }

    case 'condition': {
      // Simple condition evaluation — check if the condition string matches a basic pattern
      // For now, conditions always pass (true). Full expression evaluator deferred.
      const conditionMet = true
      return {
        step_name: step.name,
        step_type: step.type,
        status: 'completed',
        output: { condition: step.condition ?? 'true', result: conditionMet },
        executed_at: now,
      }
    }

    default:
      return { step_name: step.name, step_type: step.type, status: 'failed', error: `Unknown step type: ${step.type}`, executed_at: now }
  }
}
