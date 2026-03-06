import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

/**
 * GET /api/workflow-instances/[id]
 * Returns a single workflow instance with its current state.
 */
export const GET = withAuth(async (req: NextRequest, ctx, params) => {
  const { id } = params

  const supabase = createServerClient()

  const { data: instance, error } = await supabase
    .from('blocks')
    .select('*')
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .eq('type', 'workflow_instance')
    .single()

  if (error || !instance) {
    if (error?.code === 'PGRST116') {
      return apiError('Workflow instance not found', 'workflow/instance-not-found', 404)
    }
    logger.error('api-workflow-instances', 'db.query_failed', { error_code: error?.code })
    return apiError('Failed to fetch workflow instance', 'db/query-failed', 500)
  }

  return ok(instance)
})
