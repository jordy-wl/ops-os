import { withAuth } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'
import { getBlockHierarchy } from '@/lib/org/block-hierarchy'

/**
 * GET /api/org/block-hierarchy
 *
 * Returns the org hierarchy tree built from block_edges (part_of).
 * Each node includes: id, name, block_type, parent_id, depth,
 * plus enriched head_name and member_count where applicable.
 */
export const GET = withAuth(async (_req, ctx) => {
  const supabase = createServerClient()

  try {
    const hierarchy = await getBlockHierarchy(supabase, ctx.orgId)

    logger.info('api-org', 'block-hierarchy.fetched', {
      org_id: ctx.orgId,
      node_count: hierarchy.length,
    })

    return ok({ hierarchy })
  } catch (err) {
    const errorCode = err instanceof Error ? err.message : 'unknown'
    logger.error('api-org', 'block-hierarchy.fetch_failed', {
      org_id: ctx.orgId,
      error_code: errorCode,
    })
    return apiError('Failed to fetch block hierarchy', 'org/hierarchy-failed', 500)
  }
})
