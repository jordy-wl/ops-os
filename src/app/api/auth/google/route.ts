import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { resolveOrgId } from '@/lib/auth/resolve-org'
import { getAuthUrl } from '@/lib/integrations/google-client'
import { apiError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

/**
 * GET /api/auth/google
 * Initiates Google OAuth flow. Redirects user to Google consent screen.
 * State parameter encodes orgId for the callback.
 */
export async function GET(req: NextRequest) {
  try {
    const { userId, orgId: clerkOrgId } = await auth()
    if (!userId) {
      return apiError('Not authenticated', 'auth/unauthenticated', 401)
    }

    // When user has no active Clerk org (clerkOrgId is null), fall back to
    // their primary org membership. This fixes the Google OAuth flow for
    // users who haven't explicitly selected an org in Clerk.
    let effectiveClerkOrgId = clerkOrgId
    if (!effectiveClerkOrgId) {
      const { clerkClient: getClerk } = await import('@clerk/nextjs/server')
      const clerk = await getClerk()
      const memberships = await clerk.users.getOrganizationMembershipList({ userId, limit: 1 })
      effectiveClerkOrgId = memberships.data?.[0]?.organization?.id ?? null
      if (!effectiveClerkOrgId) {
        return apiError('No organization found. Please create or join an organization first.', 'auth/no-org', 403)
      }
      logger.info('google-oauth', 'oauth.fallback_org', { user_id: userId, org_id: effectiveClerkOrgId })
    }

    const orgId = await resolveOrgId(effectiveClerkOrgId)
    if (!orgId) {
      return apiError('No organization found', 'auth/no-org', 403)
    }

    // Encode org info in state for the callback
    const state = Buffer.from(JSON.stringify({ orgId, userId })).toString('base64url')
    const url = getAuthUrl(state)

    logger.info('google-oauth', 'oauth.initiated', { org_id: orgId })

    return Response.redirect(url)
  } catch (err) {
    logger.error('google-oauth', 'oauth.init_failed', {
      error: err instanceof Error ? err.message : 'Unknown',
    })
    return apiError('Failed to initiate Google OAuth', 'oauth/init-failed', 500)
  }
}
