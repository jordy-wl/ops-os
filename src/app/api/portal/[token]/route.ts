import { ok, apiError } from '@/lib/api/responses'
import { validatePortalToken } from '@/lib/portal'
import { logger } from '@/lib/logger'

/**
 * GET /api/portal/[token] -- portal landing data.
 * Public (no Clerk auth). Token-validated via shared_links.
 *
 * Returns: portal config feature toggles, client block basics, org branding.
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

  const { portalConfig, clientBlock, branding } = result

  logger.info('portal', 'portal.data.fetched', {
    org_id: portalConfig.org_id,
    portal_config_id: portalConfig.id,
    token_prefix: token.slice(0, 8) + '...',
  })

  return ok({
    portal: {
      name: portalConfig.name,
      dashboard_enabled: portalConfig.dashboard_enabled,
      documents_enabled: portalConfig.documents_enabled,
      requests_enabled: portalConfig.requests_enabled,
      forms_enabled: portalConfig.forms_enabled,
    },
    client: {
      id: clientBlock.id,
      name: clientBlock.name,
      type: clientBlock.type,
      state: clientBlock.state,
    },
    branding,
  })
}
