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
 * POST /api/tasks/[id]/complete
 *
 * Complete a claimed task. Sets status = completed, completed_at = now.
 * Only the assigned user (or ops-admin) can complete.
 * After completion, advances the workflow instance to the next step.
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

  if (fetchError?.code === 'PGRST116' || !task) {
    return apiError('Task not found', 'tasks/not-found', 404)
  }
  if (fetchError) {
    logger.error('api-tasks', 'db.query_failed', { error_code: fetchError.code })
    return apiError('Failed to fetch task', 'db/query-failed', 500)
  }

  const meta = task.metadata as TaskMetadata

  if (meta.status === 'completed') {
    return apiError('Task is already completed', 'tasks/already-completed', 409)
  }

  if (meta.status === 'open') {
    return apiError('Task must be claimed before completing', 'tasks/not-claimed', 422)
  }

  // Only the assigned user or an admin can complete
  if (meta.assigned_to !== ctx.userId && ctx.role !== 'ops-admin') {
    return apiError('Only the assigned user or an admin can complete this task', 'tasks/not-assigned', 403)
  }

  // 2. Update metadata: complete the task
  const now = new Date().toISOString()
  const updatedMeta: TaskMetadata = {
    ...meta,
    status: 'completed',
    completed_at: now,
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
    return apiError('Failed to complete task', 'db/update-failed', 500)
  }

  // 3. Emit completion event
  await supabase.from('events').insert({
    org_id: ctx.orgId,
    block_id: id,
    type: 'task.completed',
    actor_id: ctx.userId,
    actor_type: 'human',
    payload: {
      step_name: meta.step_name,
      workflow_instance_id: meta.workflow_instance_id,
      completed_at: now,
    },
  })

  // 4. Advance the workflow instance (fire-and-forget)
  // The workflow instance's current step was waiting for this task.
  // Advancing it will move to the next step.
  if (meta.workflow_instance_id) {
    try {
      // Dynamic import to avoid circular dependency with step-engine
      const { advanceWorkflowInstance } = await import('@/lib/workflow/step-engine')
      await advanceWorkflowInstance(meta.workflow_instance_id, ctx.orgId)
    } catch (err) {
      // Log but don't fail — the task is already completed
      logger.error('api-tasks', 'workflow.advance_failed', {
        workflow_instance_id: meta.workflow_instance_id,
        error: err instanceof Error ? err.message : 'Unknown',
      })
    }
  }

  return ok(updated)
})
