import { ok, apiError } from '@/lib/api/responses'
import { validatePortalToken } from '@/lib/portal'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * GET /api/portal/[token]/request-types -- available request types for this portal.
 * Public (no Clerk auth). Token-validated via shared_links.
 *
 * Returns an array of request types derived from the portal's request_type_config.
 * Each entry maps to a workflow_template that can be triggered by a portal request.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const result = await validatePortalToken(token)
  if (!result.valid) {
    return apiError(result.reason, 'portal/invalid-token', 401)
  }

  const { portalConfig } = result

  // Check that requests feature is enabled
  if (!portalConfig.requests_enabled) {
    return apiError('Requests are not enabled for this portal', 'portal/feature-disabled', 403)
  }

  // Read request_type_config from the portal config
  // This comes from the portal_configurations.request_type_config JSONB column
  const entries = portalConfig.request_type_config ?? []

  if (entries.length === 0) {
    logger.info('portal', 'portal.request_types.fetched', {
      org_id: portalConfig.org_id,
      token_prefix: token.slice(0, 8) + '...',
      count: 0,
    })
    return ok([])
  }

  // Batch-fetch all referenced workflow_template blocks
  const templateIds = entries.map((e) => e.workflow_template_id)
  const supabase = createServerClient()

  const { data: templates, error: queryError } = await supabase
    .from('blocks')
    .select('id, name, metadata')
    .in('id', templateIds)
    .eq('type', 'workflow_template')
    .eq('org_id', portalConfig.org_id)

  if (queryError) {
    logger.error('portal', 'portal.request_types.query_failed', {
      org_id: portalConfig.org_id,
      error_code: queryError.code,
      token_prefix: token.slice(0, 8) + '...',
    })
    return apiError('Failed to fetch request types', 'portal/request-types-failed', 500)
  }

  // Build a lookup map of template ID -> template data
  const templateMap = new Map<string, { name: string; description: string }>()
  for (const t of templates ?? []) {
    const meta = (t.metadata ?? {}) as Record<string, unknown>
    templateMap.set(t.id, {
      name: (t.name as string) ?? 'Untitled Workflow',
      description: (meta.description as string) ?? '',
    })
  }

  // Map config entries to response, filtering out entries whose templates no longer exist
  const requestTypes = entries
    .filter((entry) => templateMap.has(entry.workflow_template_id))
    .map((entry) => {
      const tmpl = templateMap.get(entry.workflow_template_id)!
      return {
        id: entry.workflow_template_id,
        name: entry.display_name || tmpl.name,
        description: tmpl.description,
        form_template_id: entry.form_template_id || null,
      }
    })

  logger.info('portal', 'portal.request_types.fetched', {
    org_id: portalConfig.org_id,
    token_prefix: token.slice(0, 8) + '...',
    count: requestTypes.length,
  })

  return ok(requestTypes)
}
