import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'
import { REGISTRY } from '@/lib/actions/registry'

/**
 * POST /api/actions/:type
 *
 * Command gateway for all controlled mutations. Validates auth, dispatches to
 * the registered handler for the given action type, returns ActionResult.
 *
 * Request body: action-specific payload (validated by handler's Zod schema)
 * Response: { data: ActionResult, error: null } or standard error shape
 *
 * Add new action types by registering a handler in src/lib/actions/registry.ts.
 */
export const POST = withAuth(requirePermission(['manage_blocks'], async (req: NextRequest, ctx, params) => {
  const type = params.type

  const handler = REGISTRY[type]
  if (!handler) {
    return apiError(
      `Unknown action type: "${type}". Valid types: ${Object.keys(REGISTRY).join(', ')}`,
      'actions/unknown-type',
      404
    )
  }

  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

  const parsed = handler.schema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const supabase = createServerClient()

  try {
    const result = await handler.execute(parsed.data, ctx, supabase)

    logger.info('api-actions', 'action.completed', {
      action_type: type,
      org_id: ctx.orgId,
      status: result.status,
      workflow_job_id: result.workflowJobId ?? null,
    })

    return ok(result, 201)
  } catch (err) {
    logger.error('api-actions', 'action.execution_failed', {
      action_type: type,
      error: (err as Error).message?.slice(0, 100),
    })
    return apiError('Action execution failed', 'actions/execution-failed', 500)
  }
}))
