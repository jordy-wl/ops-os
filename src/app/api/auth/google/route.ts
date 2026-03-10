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
    if (!userId || !clerkOrgId) {
      return apiError('Not authenticated', 'auth/unauthenticated', 401)
    }

    const orgId = await resolveOrgId(clerkOrgId)
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
