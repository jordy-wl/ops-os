import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

/**
 * GET /api/workflows/jobs
 * Returns workflow jobs for the current org, enriched with block names and
 * error reasons. Used by the Jobs tab polling refresh.
 */
export const GET = withAuth(async (_req: NextRequest, ctx) => {
  const supabase = createServerClient()

  const { data: jobs, error: jobsError } = await supabase
    .from('workflow_jobs')
    .select('id, block_id, type, status, attempts, scheduled_at, started_at, completed_at, created_at')
    .eq('org_id', ctx.orgId)
    .order('scheduled_at', { ascending: false })
    .limit(100)

  if (jobsError) {
    logger.error('api-workflow-jobs', 'db.query_failed', { error_code: jobsError.code })
    return apiError('Failed to fetch jobs', 'db/query-failed', 500)
  }

  // Resolve block names
  const blockIds = [...new Set((jobs ?? []).map((j) => j.block_id).filter((id): id is string => !!id))]
  const blockNameMap = new Map<string, string>()

  if (blockIds.length > 0) {
    const { data: blocks } = await supabase
      .from('blocks')
      .select('id, name')
      .in('id', blockIds)
      .eq('org_id', ctx.orgId)
    for (const b of blocks ?? []) blockNameMap.set(b.id, b.name)
  }

  // Fetch error reasons for failed jobs
  const failedJobIds = (jobs ?? []).filter((j) => j.status === 'failed').map((j) => j.id)
  const errorMap = new Map<string, string>()

  if (failedJobIds.length > 0) {
    const { data: failedEvents } = await supabase
      .from('events')
      .select('payload, occurred_at')
      .eq('org_id', ctx.orgId)
      .eq('type', 'workflow.failed')
      .order('occurred_at', { ascending: false })

    for (const event of failedEvents ?? []) {
      const payload = event.payload as Record<string, unknown> | null
      const jobId = payload?.job_id as string | undefined
      if (jobId && !errorMap.has(jobId)) {
        errorMap.set(jobId, (payload?.reason as string | undefined) ?? 'Unknown error')
      }
    }
  }

  const result = (jobs ?? []).map((j) => ({
    id:            j.id,
    block_id:      j.block_id ?? null,
    workflow_type: j.type,
    status:        j.status,
    attempts:      j.attempts,
    scheduled_at:  j.scheduled_at,
    claimed_at:    j.started_at ?? null,
    completed_at:  j.completed_at ?? null,
    created_at:    j.created_at,
    block_name:    j.block_id ? (blockNameMap.get(j.block_id) ?? null) : null,
    last_error:    errorMap.get(j.id) ?? null,
  }))

  return ok(result)
})
