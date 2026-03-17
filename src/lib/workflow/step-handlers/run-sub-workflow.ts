import { logger } from '@/lib/logger'
import type { StepHandler } from './types'

const handler: StepHandler = async (step, meta, orgId, supabase) => {
  const now = new Date().toISOString()
  const stepAny = step as Record<string, unknown>
  const subTemplateId = stepAny.sub_workflow_template_id as string | undefined
  const waitForCompletion = (stepAny.wait_for_completion as boolean) ?? false

  if (!subTemplateId) {
    return { step_name: step.name, step_type: step.type, status: 'failed', error: 'Missing sub_workflow_template_id', executed_at: now }
  }

  // Verify the sub-workflow template exists
  const { data: subTemplate, error: subTplErr } = await supabase
    .from('blocks')
    .select('id, name')
    .eq('id', subTemplateId)
    .eq('org_id', orgId)
    .eq('type', 'workflow_template')
    .single()

  if (subTplErr || !subTemplate) {
    return { step_name: step.name, step_type: step.type, status: 'failed', error: `Sub-workflow template not found: ${subTemplateId}`, executed_at: now }
  }

  // Create a new workflow instance for the sub-workflow
  const subInstanceMeta = {
    template_id: subTemplateId,
    source_block_id: meta.source_block_id,
    applies_to_type: meta.applies_to_type,
    status: 'pending',
    current_step_index: 0,
    step_results: [],
    started_at: null,
    completed_at: null,
    parent_instance_id: meta.template_id,
    parent_step_name: step.name,
  }

  const { data: subInstance, error: subCreateErr } = await supabase
    .from('blocks')
    .insert({
      org_id: orgId,
      type: 'workflow_instance',
      name: `${subTemplate.name} (sub)`,
      metadata: subInstanceMeta,
    })
    .select('id')
    .single()

  if (subCreateErr || !subInstance) {
    logger.error('step-engine', 'step.run_sub_workflow_failed', { error_code: subCreateErr?.code })
    return { step_name: step.name, step_type: step.type, status: 'failed', error: subCreateErr?.message ?? 'Failed to create sub-workflow instance', executed_at: now }
  }

  await supabase.from('events').insert({
    org_id: orgId,
    block_id: subInstance.id,
    type: 'workflow.instance.spawned',
    actor_type: 'workflow',
    payload: {
      parent_template_id: meta.template_id,
      sub_template_id: subTemplateId,
      parent_step_name: step.name,
    },
  })

  logger.info('step-engine', 'step.sub_workflow_spawned', {
    parent_instance: meta.template_id,
    sub_instance: subInstance.id,
    sub_template: subTemplateId,
  })

  if (waitForCompletion) {
    return {
      step_name: step.name,
      step_type: step.type,
      status: 'waiting',
      output: { sub_instance_id: subInstance.id, sub_template_id: subTemplateId, waiting: true },
      executed_at: now,
    }
  }

  return {
    step_name: step.name,
    step_type: step.type,
    status: 'completed',
    output: { sub_instance_id: subInstance.id, sub_template_id: subTemplateId },
    executed_at: now,
  }
}

export default handler
