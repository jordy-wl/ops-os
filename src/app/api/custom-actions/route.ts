/**
 * Custom Actions API — Phase 4, Sprint 11
 *
 * GET  /api/custom-actions   — list custom actions for the org
 * POST /api/custom-actions   — save a new custom action
 *
 * Custom actions are stored as blocks of type `custom_action`.
 * They represent reusable Call API configurations saved from the workflow builder.
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

const CreateCustomActionSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  icon: z.string().max(50).optional(),
  /** The call_api step config to reuse */
  connector_id: z.string().uuid(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  path: z.string().max(500),
  body_template: z.string().max(5000).optional(),
  timeout_ms: z.number().int().min(100).max(30000).optional(),
  max_retries: z.number().int().min(0).max(5).optional(),
  /** Category for grouping in palette */
  category: z.string().max(100).optional(),
})

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('blocks')
    .select('id, name, metadata, created_at')
    .eq('org_id', ctx.orgId)
    .eq('type', 'custom_action')
    .order('name')

  if (error) {
    logger.error('api-custom-actions', 'list_failed', { error_code: error.code })
    return apiError('Failed to list custom actions', 'db/query-failed', 500)
  }

  return ok(data)
})

export const POST = withAuth(requirePermission(['manage_workflows'], async (req: NextRequest, ctx) => {
  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

  const parsed = CreateCustomActionSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const supabase = createServerClient()

  // Verify connector exists and belongs to org
  const { data: connector, error: connErr } = await supabase
    .from('integration_connectors')
    .select('id, status')
    .eq('id', parsed.data.connector_id)
    .eq('org_id', ctx.orgId)
    .single()

  if (connErr || !connector) {
    return apiError('Connector not found', 'validation/connector-not-found', 404)
  }

  const metadata = {
    description: parsed.data.description ?? '',
    icon: parsed.data.icon ?? 'Zap',
    connector_id: parsed.data.connector_id,
    method: parsed.data.method,
    path: parsed.data.path,
    body_template: parsed.data.body_template ?? '',
    timeout_ms: parsed.data.timeout_ms ?? 5000,
    max_retries: parsed.data.max_retries ?? 1,
    category: parsed.data.category ?? 'Custom',
  }

  const { data: result, error: rpcError } = await supabase.rpc('create_block_with_event', {
    p_org_id: ctx.orgId,
    p_type: 'custom_action',
    p_name: parsed.data.name,
    p_metadata: metadata,
    p_actor_id: ctx.userId,
    p_actor_type: 'human',
  })

  if (rpcError || !result) {
    logger.error('api-custom-actions', 'create_failed', { error_code: rpcError?.code })
    return apiError('Failed to create custom action', 'db/insert-failed', 500)
  }

  logger.info('api-custom-actions', 'custom_action.created', {
    org_id: ctx.orgId,
    action_id: result.block.id,
    name: parsed.data.name,
  })

  return ok(result, 201)
}))
