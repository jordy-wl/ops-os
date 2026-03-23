import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import type { WorkflowStep } from './template-schema'
import { resolveHandler } from './step-handlers/registry'

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

  // Check if handler specified a branch target (route/for-each nodes)
  let nextIndex: number
  if (stepResult.output?.next_step_name) {
    const targetName = stepResult.output.next_step_name as string
    const targetIdx = steps.findIndex((s) => s.name === targetName)
    nextIndex = targetIdx >= 0 ? targetIdx : meta.current_step_index + 1
  } else {
    nextIndex = meta.current_step_index + 1
  }

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

  // 6. Emit step event (on instance block — for workflow tracking)
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

  // 7. Auto-emit activity event on the SOURCE block (feeds AI delta engine).
  //    Uses actor_type 'system' to prevent trigger loops.
  if (meta.source_block_id) {
    await supabase.from('events').insert({
      org_id: orgId,
      block_id: meta.source_block_id,
      type: `workflow.activity.${currentStep.type}`,
      actor_type: 'system',
      payload: {
        step_name: currentStep.name,
        step_type: currentStep.type,
        step_index: meta.current_step_index,
        result_status: stepResult.status,
        workflow_instance_id: instanceId,
        template_id: meta.template_id,
        ...(stepResult.output ?? {}),
      },
    })
  }

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
 * Execute a single workflow step via the handler registry.
 */
async function executeStep(
  step: WorkflowStep,
  meta: InstanceMetadata,
  orgId: string,
  supabase: ReturnType<typeof createServerClient>
): Promise<StepResult> {
  const now = new Date().toISOString()

  // Skip input/output pseudo-nodes — they don't execute
  if (step.type === 'input' || step.type === 'output') {
    return { step_name: step.name, step_type: step.type, status: 'completed', output: { skipped: true }, executed_at: now }
  }

  const handler = await resolveHandler(step.type)
  if (!handler) {
    return { step_name: step.name, step_type: step.type, status: 'failed', error: `Unknown step type: ${step.type}`, executed_at: now }
  }

  return handler(step, meta, orgId, supabase)
}

// ─── Template interpolation (shared utility) ───────────────────────────────

/**
 * Interpolate template variables in a string.
 * Supports N-part dot paths: {{block.name}}, {{context.template_id}},
 * {{steps.step_name.field}}, {{steps.step_name.nested.field}}.
 */
export function interpolateTemplate(
  template: string,
  variables: Record<string, Record<string, unknown>>
): string {
  return template.replace(/\{\{(\w+)\.([\w.]+)\}\}/g, (_match, ns, rest) => {
    const scope = variables[ns]
    if (!scope) return ''
    const parts = rest.split('.')
    let val: unknown = scope
    for (const part of parts) {
      if (val == null || typeof val !== 'object') return ''
      val = (val as Record<string, unknown>)[part]
    }
    if (val == null) return ''
    return typeof val === 'object' ? JSON.stringify(val) : String(val)
  })
}

/**
 * Convert step results into a namespace for interpolation.
 * Indexes by step_name so {{steps.create_portal.portal_url}} resolves.
 */
export function buildStepVariables(
  stepResults: StepResult[]
): Record<string, Record<string, unknown>> {
  const steps: Record<string, Record<string, unknown>> = {}
  for (const result of stepResults) {
    if (result.output) {
      steps[result.step_name] = result.output
    }
  }
  return steps
}
