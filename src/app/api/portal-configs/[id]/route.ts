import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import type { Permission } from '@/lib/rbac/types'

const PatchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  dashboard_enabled: z.boolean().optional(),
  documents_enabled: z.boolean().optional(),
  requests_enabled: z.boolean().optional(),
  forms_enabled: z.boolean().optional(),
  exposed_block_types: z.array(z.string()).optional(),
  exposed_block_ids: z.array(z.string().uuid()).nullable().optional(),
  branding_overrides: z.record(z.unknown()).nullable().optional(),
  form_template_ids: z.array(z.string().uuid()).nullable().optional(),
  is_active: z.boolean().optional(),
  exposed_block_type_config: z
    .record(
      z.object({
        enabled: z.boolean(),
        fields: z.record(z.boolean()).optional().default({}),
      })
    )
    .optional(),
})

/**
 * GET /api/portal-configs/[id] — get a single portal configuration
 */
export const GET = withAuth(
  requirePermission(['manage_blocks' as Permission], async (_req, ctx, params) => {
    const supabase = createServerClient()

    const { data: config, error } = await supabase
      .from('portal_configurations')
      .select('*, shared_links!portal_configurations_shared_link_id_fkey(token)')
      .eq('id', params.id)
      .eq('org_id', ctx.orgId)
      .single()

    if (error || !config) {
      return apiError('Portal configuration not found', 'portal-configs/not-found', 404)
    }

    const linkData = config.shared_links as { token: string } | null
    return ok({
      ...config,
      shared_links: undefined,
      portal_token: linkData?.token ?? null,
    })
  })
)

/**
 * PATCH /api/portal-configs/[id] — update portal configuration
 * Supports updating feature toggles, exposed types, branding overrides
 */
export const PATCH = withAuth(
  requirePermission(['manage_blocks' as Permission], async (req, ctx, params) => {
    const body = await req.json().catch(() => null)
    if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

    const parsed = PatchSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.issues)

    const supabase = createServerClient()
    const updates = parsed.data

    // Verify the config exists and belongs to this org
    const { data: existing, error: fetchError } = await supabase
      .from('portal_configurations')
      .select('id')
      .eq('id', params.id)
      .eq('org_id', ctx.orgId)
      .single()

    if (fetchError || !existing) {
      return apiError('Portal configuration not found', 'portal-configs/not-found', 404)
    }

    // Build the update payload (only include provided fields)
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (updates.name !== undefined) updatePayload.name = updates.name
    if (updates.dashboard_enabled !== undefined) updatePayload.dashboard_enabled = updates.dashboard_enabled
    if (updates.documents_enabled !== undefined) updatePayload.documents_enabled = updates.documents_enabled
    if (updates.requests_enabled !== undefined) updatePayload.requests_enabled = updates.requests_enabled
    if (updates.forms_enabled !== undefined) updatePayload.forms_enabled = updates.forms_enabled
    if (updates.exposed_block_types !== undefined) updatePayload.exposed_block_types = updates.exposed_block_types
    if (updates.exposed_block_ids !== undefined) updatePayload.exposed_block_ids = updates.exposed_block_ids
    if (updates.branding_overrides !== undefined) updatePayload.branding_overrides = updates.branding_overrides
    if (updates.form_template_ids !== undefined) updatePayload.form_template_ids = updates.form_template_ids
    if (updates.is_active !== undefined) updatePayload.is_active = updates.is_active
    if (updates.exposed_block_type_config !== undefined) updatePayload.exposed_block_type_config = updates.exposed_block_type_config

    const { data: config, error: updateError } = await supabase
      .from('portal_configurations')
      .update(updatePayload)
      .eq('id', params.id)
      .select('*, shared_links!portal_configurations_shared_link_id_fkey(token)')
      .single()

    if (updateError || !config) {
      logger.error('portal-configs', 'portal_config.update_failed', {
        org_id: ctx.orgId,
        portal_config_id: params.id,
        error_code: updateError?.code,
      })
      return apiError('Failed to update portal configuration', 'portal-configs/update-failed', 500)
    }

    logger.info('portal-configs', 'portal_config.updated', {
      org_id: ctx.orgId,
      portal_config_id: params.id,
      fields_updated: Object.keys(updates),
    })

    const linkData = config.shared_links as { token: string } | null
    return ok({
      ...config,
      shared_links: undefined,
      portal_token: linkData?.token ?? null,
    })
  })
)

/**
 * DELETE /api/portal-configs/[id] — deactivate portal configuration + shared link
 * Soft-deletes by setting is_active = false on both the config and its shared link
 */
export const DELETE = withAuth(
  requirePermission(['manage_blocks' as Permission], async (_req, ctx, params) => {
    const supabase = createServerClient()

    // Verify the config exists and belongs to this org
    const { data: config, error: fetchError } = await supabase
      .from('portal_configurations')
      .select('id, shared_link_id, client_block_id, is_active')
      .eq('id', params.id)
      .eq('org_id', ctx.orgId)
      .single()

    if (fetchError || !config) {
      return apiError('Portal configuration not found', 'portal-configs/not-found', 404)
    }

    if (!config.is_active) {
      return apiError('Portal configuration is already deactivated', 'portal-configs/already-inactive', 409)
    }

    // Deactivate the portal config
    const { error: updateError } = await supabase
      .from('portal_configurations')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', params.id)

    if (updateError) {
      logger.error('portal-configs', 'portal_config.deactivate_failed', {
        org_id: ctx.orgId,
        portal_config_id: params.id,
        error_code: updateError.code,
      })
      return apiError('Failed to deactivate portal configuration', 'portal-configs/deactivate-failed', 500)
    }

    // Deactivate the associated shared link
    if (config.shared_link_id) {
      const { error: linkError } = await supabase
        .from('shared_links')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', config.shared_link_id)

      if (linkError) {
        logger.warn('portal-configs', 'portal_config.link_deactivate_failed', {
          org_id: ctx.orgId,
          shared_link_id: config.shared_link_id,
          error_code: linkError.code,
        })
        // Non-blocking — the portal config is already deactivated
      }
    }

    // Audit event
    await supabase.from('events').insert({
      org_id: ctx.orgId,
      block_id: config.client_block_id ?? params.id,
      type: 'portal_config.deactivated',
      payload: {
        portal_config_id: params.id,
        shared_link_id: config.shared_link_id,
      },
      actor_id: ctx.userId,
    })

    logger.info('portal-configs', 'portal_config.deactivated', {
      org_id: ctx.orgId,
      portal_config_id: params.id,
    })

    return ok({ deactivated: true })
  })
)
