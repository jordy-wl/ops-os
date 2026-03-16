import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'
import { randomUUID } from 'crypto'

const PROVIDERS = ['webhook', 'custom_api', 'salesforce', 'xero'] as const
const DIRECTIONS = ['inbound', 'outbound', 'bidirectional'] as const

const CreateConnectorSchema = z.object({
  name: z.string().min(1).max(255),
  provider: z.enum(PROVIDERS),
  direction: z.enum(DIRECTIONS).default('inbound'),
  config: z.record(z.unknown()).optional().default({}),
  credentials_ref: z.string().max(255).optional(),
})

/**
 * GET /api/integrations
 * Lists integration connectors for the org.
 * Optional filters: ?provider=webhook, ?status=active, ?direction=inbound
 */
export const GET = withAuth(async (req: NextRequest, ctx) => {
  const { searchParams } = new URL(req.url)
  const provider = searchParams.get('provider')
  const status = searchParams.get('status')
  const direction = searchParams.get('direction')

  const supabase = createServerClient()

  let query = supabase
    .from('integration_connectors')
    .select('*')
    .eq('org_id', ctx.orgId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

  if (provider) query = query.eq('provider', provider)
  if (status) query = query.eq('status', status)
  if (direction) query = query.eq('direction', direction)

  const { data, error } = await query

  if (error) {
    logger.error('api-integrations', 'db.query_failed', { error_code: error.code })
    return apiError('Failed to fetch integrations', 'db/query-failed', 500)
  }

  return ok(data)
})

/**
 * POST /api/integrations
 * Creates an integration connector. For inbound webhook type, generates a webhook URL.
 */
export const POST = withAuth(requirePermission(['manage_integrations'], async (req: NextRequest, ctx) => {
  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

  const parsed = CreateConnectorSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  // Validate no secrets in config JSONB
  const configStr = JSON.stringify(parsed.data.config).toLowerCase()
  if (/api_key|secret|password|token|sk-|pk_live/.test(configStr)) {
    return apiError(
      'Config must not contain secrets. Use credentials_ref to reference an env var.',
      'validation/secrets-in-config',
      400
    )
  }

  const supabase = createServerClient()

  // Generate webhook secret for inbound connectors
  const webhookSecret = (parsed.data.direction === 'inbound' || parsed.data.direction === 'bidirectional')
    ? randomUUID()
    : null

  const { data: connector, error: insertError } = await supabase
    .from('integration_connectors')
    .insert({
      org_id: ctx.orgId,
      name: parsed.data.name,
      provider: parsed.data.provider,
      direction: parsed.data.direction,
      config: parsed.data.config,
      credentials_ref: parsed.data.credentials_ref ?? null,
      webhook_secret: webhookSecret,
      status: 'active',
      created_by: ctx.userId,
    })
    .select()
    .single()

  if (insertError || !connector) {
    logger.error('api-integrations', 'db.insert_failed', { error_code: insertError?.code })
    return apiError('Failed to create integration', 'db/insert-failed', 500)
  }

  logger.info('api-integrations', 'connector.created', {
    connector_id: connector.id,
    provider: connector.provider,
    direction: connector.direction,
  })

  // Auto-register known actions for this provider (fire-and-forget)
  import('@/lib/integrations/auto-register-actions')
    .then(({ autoRegisterIntegrationActions }) =>
      autoRegisterIntegrationActions(supabase, ctx.orgId, {
        id: connector.id,
        provider: connector.provider,
        name: parsed.data.name,
        config: parsed.data.config ?? {},
      }, ctx.userId)
    )
    .catch(() => { /* non-blocking */ })

  // Build response with webhook URL for inbound connectors
  const response: Record<string, unknown> = { ...connector }
  if (parsed.data.direction === 'inbound' || parsed.data.direction === 'bidirectional') {
    response.webhook_url = `/api/webhooks/integration/${connector.id}`
  }
  // Never return webhook_secret in the response
  delete response.webhook_secret

  return ok(response, 201)
}))
