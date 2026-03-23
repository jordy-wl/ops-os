import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { ok, apiError } from '@/lib/api/responses'
import { createServerClient } from '@/lib/supabase/server'
import type { Permission } from '@/lib/rbac/types'

/**
 * GET /api/portal-configs/[id]/stats
 * Returns submission count, event count, and last activity for a portal config.
 */
export const GET = withAuth(
  requirePermission(['manage_blocks' as Permission], async (_req, ctx, params) => {
    const supabase = createServerClient()

    const { data: config } = await supabase
      .from('portal_configurations')
      .select('id, client_block_id, shared_link_id')
      .eq('id', params.id)
      .eq('org_id', ctx.orgId)
      .single()

    if (!config) {
      return apiError('Portal config not found', 'portal-configs/not-found', 404)
    }

    const [submissionsResult, eventsResult] = await Promise.all([
      supabase
        .from('form_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('shared_link_id', config.shared_link_id),
      supabase
        .from('events')
        .select('id, occurred_at', { count: 'exact' })
        .eq('block_id', config.client_block_id)
        .eq('org_id', ctx.orgId)
        .in('type', ['portal.form.submitted', 'portal.request.submitted'])
        .order('occurred_at', { ascending: false })
        .limit(1),
    ])

    return ok({
      submissions: submissionsResult.count ?? 0,
      events: eventsResult.count ?? 0,
      last_activity: eventsResult.data?.[0]?.occurred_at ?? null,
    })
  })
)
