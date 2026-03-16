import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

/**
 * GET /api/tasks
 *
 * List task_queue_item blocks for the org.
 * Optional filters: ?status=open, ?assigned_to=user_id, ?routing=human|agent|approval_chain
 */
export const GET = withAuth(async (req: NextRequest, ctx) => {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const assignedTo = searchParams.get('assigned_to')
  const routing = searchParams.get('routing')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)

  const supabase = createServerClient()
  let query = supabase
    .from('blocks')
    .select('*')
    .eq('org_id', ctx.orgId)
    .eq('type', 'task_queue_item')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (status) {
    query = query.eq('metadata->>status', status)
  }

  if (assignedTo) {
    query = query.eq('metadata->>assigned_to', assignedTo)
  }

  if (routing) {
    query = query.eq('metadata->>routing_decision', routing)
  }

  const { data, error } = await query

  if (error) {
    logger.error('api-tasks', 'db.query_failed', { error_code: error.code })
    return apiError('Failed to fetch tasks', 'db/query-failed', 500)
  }

  return ok(data)
})
