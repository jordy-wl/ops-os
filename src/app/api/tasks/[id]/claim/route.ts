import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

type TaskMetadata = {
  workflow_instance_id: string
  step_name: string
  assigned_to: string | null
  claimed_at: string | null
  completed_at: string | null
  status: 'open' | 'claimed' | 'completed'
  instructions: string
}

/**
 * POST /api/tasks/[id]/claim
 *
 * Claim an open task. Sets assigned_to = current user, status = claimed.
 * Returns 409 if already claimed.
 */
export const POST = withAuth(async (_req: NextRequest, ctx, params) => {
  const { id } = params
  const supabase = createServerClient()

  // 1. Fetch the task
  const { data: task, error: fetchError } = await supabase
    .from('blocks')
    .select('id, metadata')
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .eq('type', 'task_queue_item')
    .single()

  if (fetchError) {
    if (fetchError.code === 'PGRST116') return apiError('Task not found', 'tasks/not-found', 404)
    logger.error('api-tasks', 'db.query_failed', { error_code: fetchError.code })
    return apiError('Failed to fetch task', 'db/query-failed', 500)
  }
  if (!task) return apiError('Task not found', 'tasks/not-found', 404)

  const meta = task.metadata as TaskMetadata

  if (meta.status !== 'open') {
    return apiError(
      `Task is already ${meta.status}`,
      'tasks/already-claimed',
      409
    )
  }

  // 2. Update metadata: claim the task
  const now = new Date().toISOString()
  const updatedMeta: TaskMetadata = {
    ...meta,
    status: 'claimed',
    assigned_to: ctx.userId,
    claimed_at: now,
  }

  const { data: updated, error: updateError } = await supabase
    .from('blocks')
    .update({ metadata: updatedMeta })
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .select()
    .single()

  if (updateError || !updated) {
    logger.error('api-tasks', 'db.update_failed', { error_code: updateError?.code })
    return apiError('Failed to claim task', 'db/update-failed', 500)
  }

  // 3. Emit claim event
  await supabase.from('events').insert({
    org_id: ctx.orgId,
    block_id: id,
    type: 'task.claimed',
    actor_id: ctx.userId,
    actor_type: 'human',
    payload: { step_name: meta.step_name, workflow_instance_id: meta.workflow_instance_id },
  })

  return ok(updated)
})
