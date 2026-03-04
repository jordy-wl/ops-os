import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { WORKFLOW_REGISTRY } from '@/lib/workflow/registry'
import type { WorkflowJob } from '@/lib/workflow/types'

const MAX_ATTEMPTS = 3
const RETRY_DELAY_SECONDS = 30
const SYSTEM_ACTOR_ID = 'workflow-engine'

/**
 * Claims and processes a single pending workflow job.
 *
 * Uses the claim_workflow_job() Postgres RPC (FOR UPDATE SKIP LOCKED) to
 * atomically pick up exactly one job — safe under concurrent engine calls.
 *
 * @returns true if a job was found and processed, false if queue is empty.
 */
export async function processNextJob(supabase: SupabaseClient): Promise<boolean> {
  const { data: jobs, error: claimError } = await supabase.rpc('claim_workflow_job')

  if (claimError) {
    logger.error('workflow-engine', 'engine.claim_failed', { error_code: claimError.code })
    return false
  }

  const job = (jobs as WorkflowJob[] | null)?.[0]
  if (!job) return false

  logger.info('workflow-engine', 'engine.job_claimed', {
    job_id:       job.id,
    workflow_type: job.type,
    attempts:     job.attempts,
    org_id:       job.org_id,
  })

  const handler = WORKFLOW_REGISTRY[job.type]
  if (!handler) {
    logger.error('workflow-engine', 'engine.unknown_handler', {
      workflow_type: job.type,
      job_id:       job.id,
    })
    await markFailed(supabase, job, `No handler registered for workflow type: ${job.type}`)
    return true
  }

  try {
    await handler({ jobId: job.id, orgId: job.org_id, blockId: job.block_id, payload: job.payload, supabase })
    await markDone(supabase, job)
  } catch (err) {
    const newAttempts = job.attempts + 1
    logger.error('workflow-engine', 'engine.job_failed', {
      job_id:       job.id,
      workflow_type: job.type,
      attempts:     newAttempts,
      error:        (err as Error).message?.slice(0, 200),
    })

    if (newAttempts >= MAX_ATTEMPTS) {
      await markFailed(supabase, job, (err as Error).message ?? 'Unknown error')
    } else {
      await reschedule(supabase, job, newAttempts)
    }
  }

  return true
}

/**
 * Processes all currently pending jobs in one pass (up to 50 per cycle).
 * @returns number of jobs processed.
 */
export async function runProcessingCycle(supabase: SupabaseClient): Promise<number> {
  let processed = 0
  while (processed < 50) {
    const found = await processNextJob(supabase)
    if (!found) break
    processed++
  }

  if (processed > 0) {
    logger.info('workflow-engine', 'engine.cycle_complete', { processed })
  }

  return processed
}

/**
 * Starts a background polling loop that calls runProcessingCycle every intervalMs.
 * Intended for development / non-serverless environments only.
 * On Vercel (production), use the /api/workflow-engine/process cron endpoint instead.
 *
 * @returns The interval handle (pass to clearInterval to stop).
 */
export function startPollingLoop(
  supabase: SupabaseClient,
  intervalMs = 5000
): ReturnType<typeof setInterval> {
  logger.info('workflow-engine', 'engine.polling_started', { interval_ms: intervalMs })
  return setInterval(async () => {
    try {
      await runProcessingCycle(supabase)
    } catch (err) {
      logger.error('workflow-engine', 'engine.polling_error', {
        error: (err as Error).message?.slice(0, 200),
      })
    }
  }, intervalMs)
}

// ─── Private helpers ──────────────────────────────────────────────────────────

async function markDone(supabase: SupabaseClient, job: WorkflowJob): Promise<void> {
  const { error: updateError } = await supabase
    .from('workflow_jobs')
    .update({
      status:       'done',
      completed_at: new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    })
    .eq('id', job.id)

  if (updateError) {
    logger.error('workflow-engine', 'engine.db_update_failed', {
      job_id:       job.id,
      workflow_type: job.type,
      operation:    'markDone',
      error_code:   updateError.code,
    })
    return
  }

  // Emit workflow.completed event when a block is attached to the job
  if (job.block_id) {
    await supabase.from('events').insert({
      org_id:     job.org_id,
      block_id:   job.block_id,
      type:       'workflow.completed',
      actor_id:   SYSTEM_ACTOR_ID,
      actor_type: 'system',
      payload:    { workflow_type: job.type, job_id: job.id },
    })
  }

  logger.info('workflow-engine', 'engine.job_done', {
    job_id:       job.id,
    workflow_type: job.type,
  })
}

async function markFailed(
  supabase: SupabaseClient,
  job: WorkflowJob,
  reason: string
): Promise<void> {
  const { error: updateError } = await supabase
    .from('workflow_jobs')
    .update({
      status:     'failed',
      attempts:   job.attempts + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id)

  if (updateError) {
    logger.error('workflow-engine', 'engine.db_update_failed', {
      job_id:       job.id,
      workflow_type: job.type,
      operation:    'markFailed',
      error_code:   updateError.code,
    })
    return
  }

  if (job.block_id) {
    await supabase.from('events').insert({
      org_id:     job.org_id,
      block_id:   job.block_id,
      type:       'workflow.failed',
      actor_id:   SYSTEM_ACTOR_ID,
      actor_type: 'system',
      payload: {
        workflow_type: job.type,
        job_id:        job.id,
        reason:        reason?.slice(0, 500) ?? 'Unknown error',
      },
    })
  }

  logger.error('workflow-engine', 'engine.job_permanently_failed', {
    job_id:       job.id,
    workflow_type: job.type,
  })
}

async function reschedule(
  supabase: SupabaseClient,
  job: WorkflowJob,
  newAttempts: number
): Promise<void> {
  const scheduledAt = new Date(Date.now() + RETRY_DELAY_SECONDS * 1000).toISOString()
  await supabase
    .from('workflow_jobs')
    .update({
      status:       'pending',
      attempts:     newAttempts,
      scheduled_at: scheduledAt,
      updated_at:   new Date().toISOString(),
    })
    .eq('id', job.id)

  logger.warn('workflow-engine', 'engine.job_rescheduled', {
    job_id:       job.id,
    workflow_type: job.type,
    attempts:     newAttempts,
    scheduled_at: scheduledAt,
  })
}
