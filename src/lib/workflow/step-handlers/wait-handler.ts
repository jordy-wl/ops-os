import { logger } from '@/lib/logger'
import type { StepHandler } from './types'

const handler: StepHandler = async (step, meta, orgId, supabase) => {
  const now = new Date().toISOString()
  const waitSeconds = step.wait_seconds ?? 60
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

export default handler
