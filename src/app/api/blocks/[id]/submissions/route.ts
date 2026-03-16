import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { ok, apiError } from '@/lib/api/responses'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import type { Permission } from '@/lib/rbac/types'

/**
 * GET /api/blocks/[id]/submissions — list form submissions for a block
 */
export const GET = withAuth(
  requirePermission(['view_blocks' as Permission], async (_req, ctx, params) => {
    const supabase = createServerClient()

    // Verify block belongs to org
    const { data: block, error: blockError } = await supabase
      .from('blocks')
      .select('id')
      .eq('id', params.id)
      .eq('org_id', ctx.orgId)
      .single()

    if (blockError || !block) {
      return apiError('Block not found', 'blocks/not-found', 404)
    }

    const { data: submissions, error } = await supabase
      .from('form_submissions')
      .select('id, shared_link_id, field_data, respondent_name, respondent_email, submitted_at')
      .eq('block_id', params.id)
      .eq('org_id', ctx.orgId)
      .order('submitted_at', { ascending: false })
      .limit(100)

    if (error) {
      logger.error('block-submissions', 'submissions.list_failed', {
        block_id: params.id,
        error_code: error.code,
      })
      return apiError('Failed to fetch submissions', 'submissions/list-failed', 500)
    }

    return ok(submissions ?? [])
  })
)
