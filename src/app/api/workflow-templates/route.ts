import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

/**
 * GET /api/workflow-templates
 *
 * Lists workflow template blocks for the current org.
 * Optional query: ?applies_to_type=client
 */
export const GET = withAuth(async (req: NextRequest, ctx) => {
  const { searchParams } = new URL(req.url)
  const appliesToType = searchParams.get('applies_to_type')

  const supabase = createServerClient()

  let query = supabase
    .from('blocks')
    .select('*')
    .eq('org_id', ctx.orgId)
    .eq('type', 'workflow_template')
    .order('created_at', { ascending: false })

  if (appliesToType) {
    query = query.eq('metadata->>applies_to_type', appliesToType)
  }

  const { data, error } = await query

  if (error) {
    logger.error('api-workflow-templates', 'db.query_failed', { error_code: error.code })
    return apiError('Failed to fetch workflow templates', 'db/query-failed', 500)
  }

  return ok(data)
})
