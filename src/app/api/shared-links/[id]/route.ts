import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { ok, apiError } from '@/lib/api/responses'
import { deactivateSharedLink } from '@/lib/shared-links'
import { createServerClient } from '@/lib/supabase/server'
import type { Permission } from '@/lib/rbac/types'

/**
 * GET /api/shared-links/[id] — get a single shared link by ID
 */
export const GET = withAuth(
  requirePermission(['manage_blocks' as Permission], async (_req, ctx, params) => {
    const supabase = createServerClient()

    const { data: link, error } = await supabase
      .from('shared_links')
      .select('*')
      .eq('id', params.id)
      .eq('org_id', ctx.orgId)
      .single()

    if (error || !link) {
      return apiError('Shared link not found', 'shared-links/not-found', 404)
    }

    return ok(link)
  })
)

/**
 * DELETE /api/shared-links/[id] — deactivate a shared link (soft delete)
 */
export const DELETE = withAuth(
  requirePermission(['manage_blocks' as Permission], async (_req, ctx, params) => {
    const result = await deactivateSharedLink(params.id, ctx.orgId, ctx.userId)

    if ('error' in result) {
      return apiError(result.error, result.code, result.status)
    }

    return ok({ deactivated: true })
  })
)
