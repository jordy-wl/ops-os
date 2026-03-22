import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { createServerClient } from '@/lib/supabase/server'
import { generateShareToken } from '@/lib/shared-links'
import { logger } from '@/lib/logger'
import type { Permission } from '@/lib/rbac/types'

const CreateSchema = z.object({
  client_block_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  dashboard_enabled: z.boolean().optional().default(true),
  documents_enabled: z.boolean().optional().default(true),
  requests_enabled: z.boolean().optional().default(true),
  forms_enabled: z.boolean().optional().default(true),
  exposed_block_types: z.array(z.string()).optional().default([]),
  exposed_block_ids: z.array(z.string().uuid()).optional().default([]),
  branding_overrides: z.record(z.unknown()).nullable().optional().default(null),
})

/**
 * GET /api/portal-configs — list portal configurations for the org
 * Optional query param: ?client_id= to filter by client block
 */
export const GET = withAuth(
  requirePermission(['manage_blocks' as Permission], async (req, ctx) => {
    const supabase = createServerClient()
    const url = new URL(req.url)
    const clientId = url.searchParams.get('client_id')

    let query = supabase
      .from('portal_configurations')
      .select('*, shared_links!portal_configurations_shared_link_id_fkey(token)')
      .eq('org_id', ctx.orgId)
      .order('created_at', { ascending: false })

    if (clientId) {
      query = query.eq('client_block_id', clientId)
    }

    const { data: configs, error } = await query

    if (error) {
      logger.error('portal-configs', 'portal_config.list_failed', {
        org_id: ctx.orgId,
        error_code: error.code,
      })
      return apiError('Failed to list portal configurations', 'portal-configs/list-failed', 500)
    }

    // Flatten the shared_link token into each config
    const result = (configs ?? []).map((config) => {
      const linkData = config.shared_links as { token: string } | null
      return {
        ...config,
        shared_links: undefined,
        portal_token: linkData?.token ?? null,
      }
    })

    return ok(result)
  })
)

/**
 * POST /api/portal-configs — create a new portal configuration
 * Auto-generates a long-lived shared_link (365 days, type='portal')
 */
export const POST = withAuth(
  requirePermission(['manage_blocks' as Permission], async (req, ctx) => {
    const body = await req.json().catch(() => null)
    if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.issues)

    const supabase = createServerClient()
    const data = parsed.data

    // Verify the client block exists and belongs to this org
    const { data: clientBlock, error: blockError } = await supabase
      .from('blocks')
      .select('id, type')
      .eq('id', data.client_block_id)
      .eq('org_id', ctx.orgId)
      .single()

    if (blockError || !clientBlock) {
      return apiError('Client block not found', 'portal-configs/client-not-found', 404)
    }

    // Check for existing portal config for this client
    const { data: existing } = await supabase
      .from('portal_configurations')
      .select('id')
      .eq('org_id', ctx.orgId)
      .eq('client_block_id', data.client_block_id)
      .single()

    if (existing) {
      return apiError(
        'A portal configuration already exists for this client',
        'portal-configs/duplicate',
        409
      )
    }

    // Create the shared link first (365 days = 8760 hours)
    const token = generateShareToken()
    const expiresAt = new Date(Date.now() + 8760 * 60 * 60 * 1000).toISOString()

    const { data: sharedLink, error: linkError } = await supabase
      .from('shared_links')
      .insert({
        org_id: ctx.orgId,
        block_id: data.client_block_id,
        token,
        share_type: 'portal',
        permissions: {},
        form_schema: null,
        expires_at: expiresAt,
        created_by: ctx.userId,
      })
      .select('id, token')
      .single()

    if (linkError || !sharedLink) {
      logger.error('portal-configs', 'portal_config.link_create_failed', {
        org_id: ctx.orgId,
        error_code: linkError?.code,
      })
      return apiError('Failed to create portal link', 'portal-configs/link-failed', 500)
    }

    // Create the portal configuration
    const { data: config, error: configError } = await supabase
      .from('portal_configurations')
      .insert({
        org_id: ctx.orgId,
        client_block_id: data.client_block_id,
        name: data.name,
        dashboard_enabled: data.dashboard_enabled,
        documents_enabled: data.documents_enabled,
        requests_enabled: data.requests_enabled,
        forms_enabled: data.forms_enabled,
        exposed_block_types: data.exposed_block_types,
        exposed_block_ids: data.exposed_block_ids.length > 0 ? data.exposed_block_ids : null,
        branding_overrides: data.branding_overrides,
        shared_link_id: sharedLink.id,
        created_by: ctx.userId,
      })
      .select('*')
      .single()

    if (configError || !config) {
      logger.error('portal-configs', 'portal_config.create_failed', {
        org_id: ctx.orgId,
        error_code: configError?.code,
      })
      // Clean up the shared link if config creation failed
      await supabase
        .from('shared_links')
        .update({ is_active: false })
        .eq('id', sharedLink.id)
      return apiError('Failed to create portal configuration', 'portal-configs/create-failed', 500)
    }

    // Update the shared link with the portal_config_id (bidirectional link)
    await supabase
      .from('shared_links')
      .update({ portal_config_id: config.id })
      .eq('id', sharedLink.id)

    // Audit event
    await supabase.from('events').insert({
      org_id: ctx.orgId,
      block_id: data.client_block_id,
      type: 'portal_config.created',
      payload: {
        portal_config_id: config.id,
        name: data.name,
        shared_link_id: sharedLink.id,
      },
      actor_id: ctx.userId,
    })

    logger.info('portal-configs', 'portal_config.created', {
      org_id: ctx.orgId,
      portal_config_id: config.id,
      client_block_id: data.client_block_id,
    })

    return ok(
      {
        ...config,
        portal_token: sharedLink.token,
      },
      201
    )
  })
)
