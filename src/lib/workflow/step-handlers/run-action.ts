import type { StepHandler } from './types'

const handler: StepHandler = async (step, meta, orgId, supabase) => {
  const now = new Date().toISOString()

  if (!step.action_type) {
    return { step_name: step.name, step_type: step.type, status: 'failed', error: 'Missing action_type', executed_at: now }
  }

  await supabase.from('events').insert({
    org_id: orgId,
    block_id: meta.source_block_id,
    type: 'action.requested',
    actor_type: 'workflow',
    payload: { action_type: step.action_type, step_name: step.name, workflow_instance_id: meta.template_id },
  })

  return { step_name: step.name, step_type: step.type, status: 'completed', output: { action_type: step.action_type }, executed_at: now }
}

export default handler
