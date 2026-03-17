import { logger } from '@/lib/logger'
import type { StepHandler } from './types'

const handler: StepHandler = async (step, meta, orgId, supabase) => {
  const now = new Date().toISOString()

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

export default handler
