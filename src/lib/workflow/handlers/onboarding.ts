import { logger } from '@/lib/logger'
import type { WorkflowHandler } from '@/lib/workflow/types'

const SYSTEM_ACTOR_ID = 'workflow-engine'

/**
 * onboarding workflow handler.
 *
 * Logs each onboarding step as an event on the client block:
 *   1. document.requested
 *   2. kyc.check.started
 *   3. aml.check.started
 *
 * Throws on any event insert failure — the engine will retry up to 3 times.
 */
export const onboardingHandler: WorkflowHandler = async ({
  jobId,
  orgId,
  blockId,
  payload,
  supabase,
}) => {
  if (!blockId) {
    throw new Error('onboarding handler requires a block_id on the workflow job')
  }

  const steps = [
    { type: 'document.requested', step: 1 },
    { type: 'kyc.check.started',  step: 2 },
    { type: 'aml.check.started',  step: 3 },
  ]

  for (const step of steps) {
    const { error } = await supabase.from('events').insert({
      org_id:     orgId,
      block_id:   blockId,
      type:       step.type,
      actor_id:   SYSTEM_ACTOR_ID,
      actor_type: 'system',
      payload: {
        step:             step.step,
        workflow_job_id:  jobId,
        jurisdiction:     (payload.jurisdiction as string) ?? null,
        via:              'workflow/onboarding',
      },
    })

    if (error) {
      throw new Error(`onboarding: failed to create ${step.type} event: ${error.message}`)
    }

    logger.info('workflow-onboarding', 'step.completed', {
      step_type: step.type,
      job_id:    jobId,
      org_id:    orgId,
    })
  }
}
