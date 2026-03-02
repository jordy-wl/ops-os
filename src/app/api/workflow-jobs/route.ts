import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

const VALID_STATUSES = new Set(['pending', 'running', 'done', 'failed'])

/**
 * GET /api/workflow-jobs
 *
 * Lists workflow jobs for the authenticated org.
 *
 * Query params:
 *   status  — filter by status (pending | running | done | failed)
 *   limit   — max results, capped at 100 (default: 50)
 *   offset  — pagination offset (default: 0)
 *
 * Response maps DB columns to the API contract shape:
 *   type       → workflow_type
 *   started_at → claimed_at   (started_at is the engine claim timestamp)
 */
export const GET = withAuth(async (req: NextRequest, ctx) => {
  const { searchParams } = new URL(req.url)
  const statusParam = searchParams.get('status') ?? undefined
  const limit  = Math.min(Math.max(parseInt(searchParams.get('limit')  ?? '50', 10), 1), 100)
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10), 0)

  if (statusParam && !VALID_STATUSES.has(statusParam)) {
    return apiError(
      `Invalid status "${statusParam}". Valid values: ${[...VALID_STATUSES].join(', ')}`,
      'validation/invalid-status',
      400
    )
  }

  const supabase = createServerClient()

  let query = supabase
    .from('workflow_jobs')
    .select('id, org_id, block_id, type, status, attempts, scheduled_at, started_at, completed_at, created_at')
    .eq('org_id', ctx.orgId)
    .order('scheduled_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (statusParam) query = query.eq('status', statusParam)

  const { data: jobs, error } = await query

  if (error) {
    logger.error('api-workflow-jobs', 'db.query_failed', {
      error_code: error.code,
      org_id:     ctx.orgId,
    })
    return apiError('Failed to fetch workflow jobs', 'db/query-failed', 500)
  }

  const workflow_jobs = (jobs ?? []).map((j) => ({
    id:            j.id,
    org_id:        j.org_id,
    block_id:      j.block_id,
    workflow_type: j.type,
    status:        j.status,
    attempts:      j.attempts,
    scheduled_at:  j.scheduled_at,
    claimed_at:    j.started_at,
    completed_at:  j.completed_at,
    created_at:    j.created_at,
  }))

  logger.info('api-workflow-jobs', 'workflow_jobs.listed', {
    org_id: ctx.orgId,
    count:  workflow_jobs.length,
    status: statusParam ?? 'all',
  })

  return ok({ workflow_jobs })
})
