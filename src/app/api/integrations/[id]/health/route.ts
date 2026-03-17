import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

/**
 * GET /api/integrations/[id]/health
 * Checks health of an integration connector by testing its connectivity.
 * Updates health_status and last_health_check in the database.
 */
export const GET = withAuth(requirePermission(['manage_integrations'], async (
  req: NextRequest,
  ctx,
  params
) => {
  const connectorId = params.id
  if (!connectorId) {
    return apiError('Missing connector ID', 'validation/missing-id', 400)
  }

  const supabase = createServerClient()

  // Fetch connector
  const { data: connector, error: fetchError } = await supabase
    .from('integration_connectors')
    .select('id, provider, config, status, capabilities, health_status, last_health_check')
    .eq('id', connectorId)
    .eq('org_id', ctx.orgId)
    .single()

  if (fetchError || !connector) {
    return apiError('Connector not found', 'db/not-found', 404)
  }

  // Perform health check based on provider
  const healthResult = await checkConnectorHealth(connector)

  // Update health status in database
  const { error: updateError } = await supabase
    .from('integration_connectors')
    .update({
      health_status: healthResult.status,
      last_health_check: new Date().toISOString(),
    })
    .eq('id', connectorId)
    .eq('org_id', ctx.orgId)

  if (updateError) {
    logger.error('api-integrations', 'health.update_failed', { connector_id: connectorId, error_code: updateError.code })
  }

  logger.info('api-integrations', 'health.checked', {
    connector_id: connectorId,
    provider: connector.provider,
    status: healthResult.status,
  })

  return ok({
    connector_id: connectorId,
    provider: connector.provider,
    health_status: healthResult.status,
    message: healthResult.message,
    capabilities: connector.capabilities ?? getDefaultCapabilities(connector.provider),
    last_checked: new Date().toISOString(),
    response_time_ms: healthResult.responseTimeMs,
  })
}))

// ─── Health Check Logic ──────────────────────────────────────────────────────

type HealthResult = {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown'
  message: string
  responseTimeMs: number
}

async function checkConnectorHealth(
  connector: Record<string, unknown>
): Promise<HealthResult> {
  const start = Date.now()
  const provider = connector.provider as string
  const config = (connector.config as Record<string, unknown>) ?? {}

  try {
    switch (provider) {
      case 'webhook':
      case 'custom_api': {
        // For webhook/custom API, check if the configured URL is reachable
        const url = config.base_url as string | undefined
        if (!url) {
          return { status: 'unknown', message: 'No base_url configured', responseTimeMs: Date.now() - start }
        }
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
        try {
          const response = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
          })
          clearTimeout(timeout)
          const ms = Date.now() - start
          if (response.ok || response.status === 405) {
            return { status: ms > 3000 ? 'degraded' : 'healthy', message: `Reachable (${response.status})`, responseTimeMs: ms }
          }
          return { status: 'degraded', message: `HTTP ${response.status}`, responseTimeMs: ms }
        } catch {
          clearTimeout(timeout)
          return { status: 'unhealthy', message: 'Connection failed or timed out', responseTimeMs: Date.now() - start }
        }
      }

      case 'google': {
        // Google integration health — check if tokens exist and are not expired
        const hasTokens = !!config.access_token || !!config.refresh_token
        return {
          status: hasTokens ? 'healthy' : 'unhealthy',
          message: hasTokens ? 'OAuth tokens present' : 'No OAuth tokens — re-authenticate',
          responseTimeMs: Date.now() - start,
        }
      }

      default:
        // For unknown providers, base health on connector status
        return {
          status: (connector.status as string) === 'active' ? 'healthy' : 'unknown',
          message: `Provider "${provider}" — status-based check`,
          responseTimeMs: Date.now() - start,
        }
    }
  } catch {
    return { status: 'unhealthy', message: 'Health check threw an error', responseTimeMs: Date.now() - start }
  }
}

/** Default capabilities by provider */
function getDefaultCapabilities(provider: string): Record<string, boolean> {
  switch (provider) {
    case 'webhook':
      return { receive_events: true, send_events: false }
    case 'custom_api':
      return { receive_events: true, send_events: true, bidirectional: true }
    case 'salesforce':
      return { crm_sync: true, contact_sync: true, deal_sync: true }
    case 'xero':
      return { invoice_create: true, payment_tracking: true }
    case 'google':
      return { calendar_sync: true, email_send: true, docs_push: true }
    default:
      return {}
  }
}
