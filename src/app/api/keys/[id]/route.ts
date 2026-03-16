import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { ok, apiError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'
import { revokeApiKey } from '@/lib/auth/api-keys'

/**
 * DELETE /api/keys/:id
 * Soft-revoke an API key (sets revoked_at). Requires manage_settings.
 * Contract: prd/05-api-contracts.md — DELETE /api/api-keys/:keyId
 */
export const DELETE = withAuth(requirePermission(['manage_settings'], async (_req: NextRequest, ctx, params) => {
  const keyId = params.id
  if (!keyId) {
    return apiError('Key ID is required', 'validation/missing-id', 400)
  }

  const result = await revokeApiKey(keyId, ctx.orgId, ctx.userId)

  if ('error' in result) {
    return apiError(result.error, result.code, result.status)
  }

  logger.info('api-keys', 'api_key.revoke_requested', {
    org_id: ctx.orgId,
    key_id: keyId,
  })

  return ok({ revoked: true, key_id: keyId })
}))
