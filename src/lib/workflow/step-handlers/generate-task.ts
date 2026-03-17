import { logger } from '@/lib/logger'
import type { StepHandler } from './types'

const handler: StepHandler = async (step, meta, orgId, supabase) => {
  const now = new Date().toISOString()
  const stepAny = step as Record<string, unknown>
  let taskFormSchema = stepAny.task_form_schema as Record<string, unknown> | undefined
  const assignTo = (stepAny.task_assign_to as string) ?? 'routing_engine'
  const priority = (stepAny.task_priority as string) ?? 'medium'

  // If task_form_schema is empty, generate AI defaults (or fall back to hardcoded)
  const schemaFields = taskFormSchema?.fields as unknown[] | undefined
  const schemaActions = taskFormSchema?.actions as unknown[] | undefined
  const isEmpty = !taskFormSchema || (!schemaFields?.length && !schemaActions?.length)

  if (isEmpty) {
    const { generateTaskFormDefaults, getFallbackTaskFormDefaults } = await import('@/lib/ai/task-form-defaults')
    const context = {
      stepName: step.name,
      appliesTo: meta.applies_to_type,
      routingMode: (stepAny.routing_mode as string) ?? undefined,
      instructions: step.instructions ?? undefined,
      priority,
    }

    // Fetch source block name for richer context
    const { data: srcBlock } = await supabase
      .from('blocks')
      .select('name')
      .eq('id', meta.source_block_id)
      .single()
    if (srcBlock?.name) {
      (context as Record<string, unknown>).sourceBlockName = srcBlock.name
    }

    const aiDefaults = await generateTaskFormDefaults(context)
    taskFormSchema = (aiDefaults ?? getFallbackTaskFormDefaults(context)) as unknown as Record<string, unknown>
  }

  // Create a task_queue_item block that appears in My Work
  const { data: taskBlock, error: taskError } = await supabase
    .from('blocks')
    .insert({
      org_id: orgId,
      type: 'task_queue_item',
      name: (taskFormSchema?.title as string) || step.name,
      metadata: {
        workflow_instance_id: meta.template_id,
        step_name: step.name,
        step_index: meta.current_step_index,
        source_block_id: meta.source_block_id,
        task_form_schema: taskFormSchema ?? {},
        assign_to: assignTo,
        priority,
        status: 'pending',
        created_at: now,
      },
    })
    .select('id')
    .single()

  if (taskError || !taskBlock) {
    logger.error('step-engine', 'step.generate_task_failed', { error_code: taskError?.code })
    return { step_name: step.name, step_type: step.type, status: 'failed', error: taskError?.message ?? 'Failed to create task', executed_at: now }
  }

  // Link task to source block
  await supabase.from('block_edges').insert({
    org_id: orgId,
    source_block_id: meta.source_block_id,
    target_block_id: taskBlock.id,
    type: 'task_for',
  })

  // Emit task created event
  await supabase.from('events').insert({
    org_id: orgId,
    block_id: taskBlock.id,
    type: 'task.created',
    actor_type: 'workflow',
    payload: {
      workflow_instance_id: meta.template_id,
      step_name: step.name,
      source_block_id: meta.source_block_id,
      assign_to: assignTo,
      priority,
    },
  })

  // Return waiting — workflow pauses until human completes the task
  return {
    step_name: step.name,
    step_type: step.type,
    status: 'waiting',
    output: { task_id: taskBlock.id, assign_to: assignTo, priority },
    executed_at: now,
  }
}

export default handler
