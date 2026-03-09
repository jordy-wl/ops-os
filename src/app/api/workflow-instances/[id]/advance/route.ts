import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { ok, apiError } from '@/lib/api/responses'
import { advanceWorkflowInstance } from '@/lib/workflow/step-engine'
import { logger } from '@/lib/logger'

/**
 * POST /api/workflow-instances/[id]/advance
 *
 * Execute the next step on a workflow instance.
 * Used by cron jobs, event triggers, and manual advancement.
 */
export const POST = withAuth(async (_req: NextRequest, ctx, params) => {
  const { id } = params

  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return apiError('Invalid instance ID', 'validation/invalid-id', 400)
  }

  try {
    const result = await advanceWorkflowInstance(id, ctx.orgId)

    return ok({
      status: result.status,
      step_result: result.step_result,
      instance_status: result.instance_status,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'

    if (message.includes('not found')) {
      return apiError(message, 'workflow/not-found', 404)
    }
    if (message.includes('already')) {
      return apiError(message, 'workflow/already-terminal', 409)
    }
    if (message.includes('out of bounds')) {
      return apiError(message, 'workflow/step-out-of-bounds', 422)
    }

    logger.error('api-workflow-advance', 'advance_failed', { instance_id: id, error: message })
    return apiError('Failed to advance workflow instance', 'workflow/advance-failed', 500)
  }
})
