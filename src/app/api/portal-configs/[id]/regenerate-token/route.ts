import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { ok, apiError } from '@/lib/api/responses'
import { createServerClient } from '@/lib/supabase/server'
import { generateShareToken } from '@/lib/shared-links'
import { logger } from '@/lib/logger'
import type { Permission } from '@/lib/rbac/types'

/**
 * POST /api/portal-configs/[id]/regenerate-token
 * Deactivates the old shared link and creates a new one (365-day expiry).
 */
export const POST = withAuth(
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

    // Deactivate old shared link
    if (config.shared_link_id) {
      await supabase
        .from('shared_links')
        .update({ is_active: false })
        .eq('id', config.shared_link_id)
    }

    // Create new shared link (365 days = 8760 hours)
    const token = generateShareToken()
    const expiresAt = new Date(Date.now() + 8760 * 60 * 60 * 1000).toISOString()

    const { data: newLink, error: linkError } = await supabase
      .from('shared_links')
      .insert({
        org_id: ctx.orgId,
        block_id: config.client_block_id,
        token,
        share_type: 'portal',
        permissions: {},
        form_schema: null,
        expires_at: expiresAt,
        created_by: ctx.userId,
        portal_config_id: config.id,
      })
      .select('id, token')
      .single()

    if (linkError || !newLink) {
      return apiError('Failed to regenerate token', 'portal-configs/regen-failed', 500)
    }

    // Update config to point to new link
    await supabase
      .from('portal_configurations')
      .update({
        shared_link_id: newLink.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', config.id)

    logger.info('portal-configs', 'portal_config.token_regenerated', {
      org_id: ctx.orgId,
      portal_config_id: config.id,
    })

    return ok({ portal_token: newLink.token })
  })
)
