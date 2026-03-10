import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requireRole } from '@/lib/auth/requireRole'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

const UpdateConnectorSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  config: z.record(z.unknown()).optional(),
  credentials_ref: z.string().max(255).optional().nullable(),
  status: z.enum(['active', 'paused', 'error', 'pending_auth']).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' }
)

/**
 * GET /api/integrations/[id]
 * Get a single integration connector.
 */
export const GET = withAuth(async (req: NextRequest, ctx, params) => {
  const { id } = params
  const supabase = createServerClient()

  const { data: connector, error } = await supabase
    .from('integration_connectors')
    .select('*')
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return apiError('Integration connector not found', 'integrations/not-found', 404)
    }
    logger.error('api-integrations', 'db.query_failed', { error_code: error.code })
    return apiError('Failed to fetch integration', 'db/query-failed', 500)
  }
  if (!connector) {
    return apiError('Integration connector not found', 'integrations/not-found', 404)
  }

  // Build response — include webhook URL, exclude webhook_secret
  const response: Record<string, unknown> = { ...connector }
  if (connector.direction === 'inbound' || connector.direction === 'bidirectional') {
    response.webhook_url = `/api/webhooks/integration/${connector.id}`
  }
  delete response.webhook_secret

  return ok(response)
})

/**
 * PATCH /api/integrations/[id]
 * Updates connector config and/or status.
 */
export const PATCH = withAuth(requireRole(['ops-admin'], async (req: NextRequest, ctx, params) => {
  const { id } = params
  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

  const parsed = UpdateConnectorSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  // Validate no secrets in config if config is being updated
  if (parsed.data.config) {
    const configStr = JSON.stringify(parsed.data.config).toLowerCase()
    if (/api_key|secret|password|token|sk-|pk_live/.test(configStr)) {
      return apiError(
        'Config must not contain secrets. Use credentials_ref to reference an env var.',
        'validation/secrets-in-config',
        400
      )
    }
  }

  const supabase = createServerClient()

  const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (parsed.data.name !== undefined) updateFields.name = parsed.data.name
  if (parsed.data.config !== undefined) updateFields.config = parsed.data.config
  if (parsed.data.credentials_ref !== undefined) updateFields.credentials_ref = parsed.data.credentials_ref
  if (parsed.data.status !== undefined) updateFields.status = parsed.data.status

  const { data: connector, error } = await supabase
    .from('integration_connectors')
    .update(updateFields)
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .neq('status', 'archived')
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return apiError('Integration connector not found', 'integrations/not-found', 404)
    }
    logger.error('api-integrations', 'db.update_failed', { error_code: error.code })
    return apiError('Failed to update integration', 'db/update-failed', 500)
  }
  if (!connector) {
    return apiError('Integration connector not found', 'integrations/not-found', 404)
  }

  // Exclude webhook_secret from response
  const response: Record<string, unknown> = { ...connector }
  delete response.webhook_secret

  return ok(response)
}))

/**
 * DELETE /api/integrations/[id]
 * Soft-deletes a connector by setting status to 'archived'.
 */
export const DELETE = withAuth(requireRole(['ops-admin'], async (req: NextRequest, ctx, params) => {
  const { id } = params
  const supabase = createServerClient()

  const { data: connector, error } = await supabase
    .from('integration_connectors')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .neq('status', 'archived')
    .select('id')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return apiError('Integration connector not found', 'integrations/not-found', 404)
    }
    logger.error('api-integrations', 'db.archive_failed', { error_code: error.code })
    return apiError('Failed to archive integration', 'db/archive-failed', 500)
  }
  if (!connector) {
    return apiError('Integration connector not found', 'integrations/not-found', 404)
  }

  logger.info('api-integrations', 'connector.archived', { connector_id: id })

  return ok({ id: connector.id, status: 'archived' })
}))
