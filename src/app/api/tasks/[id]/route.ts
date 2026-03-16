import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

const PatchTaskSchema = z.object({
  decision: z.enum(['approved', 'rejected', 'modified']).optional(),
  actual_output: z.record(z.unknown()).optional(),
})

/**
 * PATCH /api/tasks/[id]
 *
 * Update a task's decision and/or actual_output.
 * Used by humans to approve/reject/modify AI recommendations.
 */
export const PATCH = withAuth(async (req: NextRequest, ctx, params) => {
  const { id } = params

  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

  const parsed = PatchTaskSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const { decision, actual_output } = parsed.data
  if (!decision && !actual_output) {
    return apiError('At least one of decision or actual_output is required', 'validation/empty-update', 400)
  }

  const supabase = createServerClient()

  // Fetch the task
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

  const meta = task.metadata as Record<string, unknown>

  // Build updated metadata
  const updatedMeta = {
    ...meta,
    ...(decision ? { decision } : {}),
    ...(actual_output ? { actual_output } : {}),
    completed_by: ctx.userId,
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
    return apiError('Failed to update task', 'db/update-failed', 500)
  }

  // Emit decision event
  await supabase.from('events').insert({
    org_id: ctx.orgId,
    block_id: id,
    type: 'task.decision',
    actor_id: ctx.userId,
    actor_type: 'human',
    payload: {
      decision,
      has_output: !!actual_output,
      step_name: meta.step_name,
      workflow_instance_id: meta.workflow_instance_id,
    },
  })

  return ok(updated)
})
