import { withAuth } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'
import { getOrgOverview } from '@/lib/org/overview'

/**
 * GET /api/org/overview
 *
 * Returns aggregated org data: org details, hierarchy, team stats,
 * block counts by type, workflow stats, and recent events.
 * Any authenticated org member can access this endpoint.
 */
export const GET = withAuth(async (_req, ctx) => {
  const supabase = createServerClient()

  try {
    const overview = await getOrgOverview(supabase, ctx.orgId)

    if (!overview) {
      return apiError('Organisation not found', 'org/not-found', 404)
    }

    logger.info('api-org', 'overview.fetched', {
      org_id: ctx.orgId,
      block_count: overview.blocks.total,
      team_count: overview.team.total,
    })

    return ok(overview)
  } catch (err) {
    const errorCode = err instanceof Error ? err.message : 'unknown'
    logger.error('api-org', 'overview.fetch_failed', {
      org_id: ctx.orgId,
      error_code: errorCode,
    })
    return apiError('Failed to fetch org overview', 'org/overview-failed', 500)
  }
})
