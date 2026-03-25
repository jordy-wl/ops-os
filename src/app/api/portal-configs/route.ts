import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { createServerClient } from '@/lib/supabase/server'
import { generateShareToken } from '@/lib/shared-links'
import { logger } from '@/lib/logger'
import type { Permission } from '@/lib/rbac/types'

const CreateSchema = z.object({
  client_block_id: z.string().uuid().nullable().optional().default(null),
  name: z.string().min(1).max(255),
  is_template: z.boolean().optional().default(false),
  dashboard_enabled: z.boolean().optional().default(true),
  documents_enabled: z.boolean().optional().default(true),
  requests_enabled: z.boolean().optional().default(true),
  forms_enabled: z.boolean().optional().default(true),
  exposed_block_types: z.array(z.string()).optional().default([]),
  exposed_block_ids: z.array(z.string().uuid()).optional().default([]),
  branding_overrides: z.record(z.unknown()).nullable().optional().default(null),
  form_template_ids: z.array(z.string().uuid()).nullable().optional().default(null),
  exposed_block_type_config: z
    .record(
      z.object({
        enabled: z.boolean(),
        fields: z.record(z.boolean()).optional().default({}),
      })
    )
    .optional()
    .default({}),
})

/**
 * GET /api/portal-configs — list portal configurations for the org
 * Optional query params: ?client_id= to filter by client block, ?templates_only=true
 */
export const GET = withAuth(
  requirePermission(['manage_blocks' as Permission], async (req, ctx) => {
    const supabase = createServerClient()
    const url = new URL(req.url)
    const clientId = url.searchParams.get('client_id')
    const templatesOnly = url.searchParams.get('templates_only')

    let query = supabase
      .from('portal_configurations')
      .select('*, shared_links!portal_configurations_shared_link_id_fkey(token)')
      .eq('org_id', ctx.orgId)
      .order('created_at', { ascending: false })

    if (clientId) {
      query = query.eq('client_block_id', clientId)
    }
    if (templatesOnly === 'true') {
      query = query.eq('is_template', true)
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
 * If client_block_id is provided: creates a live portal with shared_link (365 days)
 * If client_block_id is null: creates a reusable template (no shared_link)
 */
export const POST = withAuth(
  requirePermission(['manage_blocks' as Permission], async (req, ctx) => {
    const body = await req.json().catch(() => null)
    if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.issues)

    const supabase = createServerClient()
    const data = parsed.data
    const isTemplate = !data.client_block_id

    if (data.client_block_id) {
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
    }

    // Create shared link only for non-template portals (365 days = 8760 hours)
    let sharedLinkId: string | null = null
    let portalToken: string | null = null

    if (data.client_block_id) {
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

      sharedLinkId = sharedLink.id
      portalToken = sharedLink.token
    }

    // Create the portal configuration
    const { data: config, error: configError } = await supabase
      .from('portal_configurations')
      .insert({
        org_id: ctx.orgId,
        client_block_id: data.client_block_id,
        name: data.name,
        is_template: isTemplate,
        dashboard_enabled: data.dashboard_enabled,
        documents_enabled: data.documents_enabled,
        requests_enabled: data.requests_enabled,
        forms_enabled: data.forms_enabled,
        exposed_block_types: data.exposed_block_types,
        exposed_block_ids: data.exposed_block_ids.length > 0 ? data.exposed_block_ids : null,
        branding_overrides: data.branding_overrides,
        form_template_ids: data.form_template_ids,
        exposed_block_type_config: Object.keys(data.exposed_block_type_config).length > 0
          ? data.exposed_block_type_config
          : {},
        shared_link_id: sharedLinkId,
        created_by: ctx.userId,
      })
      .select('*')
      .single()

    if (configError || !config) {
      logger.error('portal-configs', 'portal_config.create_failed', {
        org_id: ctx.orgId,
        error_code: configError?.code,
      })
      if (sharedLinkId) {
        await supabase
          .from('shared_links')
          .update({ is_active: false })
          .eq('id', sharedLinkId)
      }
      return apiError('Failed to create portal configuration', 'portal-configs/create-failed', 500)
    }

    // Bidirectional link (shared_link → portal_config)
    if (sharedLinkId) {
      await supabase
        .from('shared_links')
        .update({ portal_config_id: config.id })
        .eq('id', sharedLinkId)
    }

    // Create block_edges for form templates when a client is assigned
    if (data.client_block_id && data.form_template_ids?.length) {
      for (const ftId of data.form_template_ids) {
        await supabase.from('block_edges').insert({
          org_id: ctx.orgId,
          from_block_id: ftId,
          to_block_id: data.client_block_id,
          edge_type: 'related_to',
          metadata: { source: 'portal_builder' },
        })
      }
    }

    // Audit event (use config.id as block_id for templates without a client)
    await supabase.from('events').insert({
      org_id: ctx.orgId,
      block_id: data.client_block_id ?? config.id,
      type: isTemplate ? 'portal_template.created' : 'portal_config.created',
      payload: {
        portal_config_id: config.id,
        name: data.name,
        is_template: isTemplate,
        shared_link_id: sharedLinkId,
      },
      actor_id: ctx.userId,
    })

    logger.info('portal-configs', 'portal_config.created', {
      org_id: ctx.orgId,
      portal_config_id: config.id,
      client_block_id: data.client_block_id,
      is_template: isTemplate,
    })

    return ok(
      {
        ...config,
        portal_token: portalToken,
      },
      201
    )
  })
)
