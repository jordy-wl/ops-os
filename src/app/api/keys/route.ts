import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'
import { createApiKey, listApiKeys } from '@/lib/auth/api-keys'

const CreateKeySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or fewer'),
})

/**
 * GET /api/keys
 * List API keys for the org (masked display). Requires manage_settings.
 * Contract: prd/05-api-contracts.md — GET /api/api-keys
 */
export const GET = withAuth(requirePermission(['manage_settings'], async (_req: NextRequest, ctx) => {
  const result = await listApiKeys(ctx.orgId)

  if ('error' in result) {
    return apiError(result.error, result.code, 500)
  }

  logger.info('api-keys', 'api_key.listed', {
    org_id: ctx.orgId,
    count: result.keys.length,
  })

  return ok({ keys: result.keys })
}))

/**
 * POST /api/keys
 * Generate a new API key. Returns the full key ONCE. Requires manage_settings.
 * Contract: prd/05-api-contracts.md — POST /api/api-keys
 */
export const POST = withAuth(requirePermission(['manage_settings'], async (req: NextRequest, ctx) => {
  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

  const parsed = CreateKeySchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const result = await createApiKey(ctx.orgId, ctx.userId, parsed.data.name)

  if ('error' in result) {
    return apiError(result.error, result.code, 500)
  }

  logger.info('api-keys', 'api_key.generated', {
    org_id: ctx.orgId,
    key_id: result.keyId,
    key_prefix: result.prefix,
  })

  return ok(
    {
      key: result.key,
      key_id: result.keyId,
      prefix: result.prefix,
    },
    201
  )
}))
