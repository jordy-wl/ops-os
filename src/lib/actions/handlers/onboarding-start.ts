import { z } from 'zod'
import type { ActionHandler, ActionResult } from '@/lib/actions/types'
import type { AuthContext } from '@/lib/auth/withAuth'
import type { SupabaseClient } from '@supabase/supabase-js'

const schema = z.object({
  clientName: z.string().min(1, 'clientName is required').max(255),
  jurisdiction: z.string().optional(),
  metadata: z.record(z.unknown()).optional().default({}),
})

type Payload = z.infer<typeof schema>

/**
 * onboarding.start — initiates a client onboarding workflow.
 *
 * Creates:
 *   1. A new client block (type: 'client') with the provided name + metadata
 *   2. An onboarding.started event on that block
 *   3. A workflow_job (type: 'onboarding', status: 'pending') for the workflow engine
 *
 * Returns status: 'pending' — the onboarding job is queued, not yet completed.
 *
 * @param payload - clientName, optional jurisdiction and metadata
 * @param ctx     - Auth context: userId, clerkOrgId, orgId
 * @param supabase - Server-side Supabase client
 * @returns ActionResult with actionId, eventId, workflowJobId, and status: 'pending'
 */
async function execute(
  payload: Payload,
  ctx: AuthContext,
  supabase: SupabaseClient
): Promise<ActionResult> {
  const actionId = crypto.randomUUID()

  // 1. Create client block
  const { data: block, error: blockError } = await supabase
    .from('blocks')
    .insert({
      org_id: ctx.orgId,
      type: 'client',
      name: payload.clientName,
      metadata: {
        ...(payload.jurisdiction ? { jurisdiction: payload.jurisdiction } : {}),
        ...payload.metadata,
      },
    })
    .select('id')
    .single()

  if (blockError || !block) {
    throw new Error(blockError?.message ?? 'Failed to create client block')
  }

  // 2. Create onboarding.started event
  const { data: event } = await supabase
    .from('events')
    .insert({
      org_id: ctx.orgId,
      block_id: block.id,
      type: 'onboarding.started',
      actor_id: ctx.userId,
      actor_type: 'human',
      payload: {
        client_name: payload.clientName,
        jurisdiction: payload.jurisdiction ?? null,
        via: 'action/onboarding.start',
      },
    })
    .select('id')
    .single()

  // 3. Enqueue workflow job
  const { data: job, error: jobError } = await supabase
    .from('workflow_jobs')
    .insert({
      org_id: ctx.orgId,
      block_id: block.id,
      type: 'onboarding',
      status: 'pending',
      payload: {
        block_id: block.id,
        client_name: payload.clientName,
        jurisdiction: payload.jurisdiction ?? null,
        initiated_by: ctx.userId,
      },
    })
    .select('id')
    .single()

  if (jobError || !job) {
    throw new Error(jobError?.message ?? 'Failed to enqueue workflow job')
  }

  return {
    actionId,
    eventId: event?.id ?? null,
    workflowJobId: job.id,
    status: 'pending',
  }
}

export const onboardingStartHandler: ActionHandler<Payload> = { schema, execute }
