import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'
import {
  getOrgRoutingPolicy,
  upsertOrgRoutingPolicy,
  RoutingPolicyInputSchema,
} from '@/lib/routing/policy-settings'

/**
 * GET /api/settings/routing
 * Returns the current org routing policy configuration, or defaults if none set.
 * Auth required. Any authenticated org member can read settings.
 * Contract: prd/05-api-contracts.md — GET /api/settings/routing
 */
export const GET = withAuth(async (_req: NextRequest, ctx) => {
  const policy = await getOrgRoutingPolicy(ctx.orgId)

  logger.info('api-settings-routing', 'policy.fetched', {
    org_id: ctx.orgId,
    has_policy: policy.policy_id !== null,
  })

  return ok(policy)
})

/**
 * PUT /api/settings/routing
 * Validates and saves the org routing policy.
 * Requires manage_settings permission (admin-only).
 * Contract: prd/05-api-contracts.md — PUT /api/settings/routing
 */
export const PUT = withAuth(
  requirePermission(['manage_settings'], async (req: NextRequest, ctx) => {
    const body = await req.json().catch(() => null)
    if (!body) {
      return apiError('Invalid JSON body', 'validation/invalid-json', 400)
    }

    const parsed = RoutingPolicyInputSchema.safeParse(body)
    if (!parsed.success) {
      return validationError(parsed.error.issues)
    }

    try {
      const result = await upsertOrgRoutingPolicy(ctx.orgId, ctx.userId, parsed.data)

      logger.info('api-settings-routing', 'policy.saved', {
        org_id: ctx.orgId,
        policy_id: result.policy_id,
        routing_mode: result.routing_mode,
      })

      return ok(result)
    } catch (err) {
      logger.error('api-settings-routing', 'policy.save_failed', {
        org_id: ctx.orgId,
        error_code: err instanceof Error ? err.message : 'unknown',
      })
      return apiError('Failed to save routing policy', 'settings/save-failed', 500)
    }
  })
)
