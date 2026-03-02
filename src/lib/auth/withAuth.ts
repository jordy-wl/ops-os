import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export type AuthContext = {
  userId: string     // Clerk user ID
  clerkOrgId: string // Clerk organization ID
  orgId: string      // Supabase internal org UUID
}

type Params = Record<string, string>

type RouteHandler = (
  req: NextRequest,
  ctx: AuthContext,
  params: Params
) => Promise<NextResponse>

/**
 * withAuth — middleware wrapper for all API route handlers.
 *
 * Validates the Clerk JWT, extracts userId + orgId, resolves the internal
 * Supabase org UUID, and auto-provisions the org row on first login.
 *
 * Usage (static route):
 *   export const GET = withAuth(async (req, ctx) => { ... })
 *
 * Usage (dynamic route):
 *   export const GET = withAuth(async (req, ctx, params) => {
 *     const { id } = params
 *   })
 */
export function withAuth(handler: RouteHandler) {
  return async (
    req: NextRequest,
    context: { params?: Promise<Params> } = {}
  ): Promise<NextResponse> => {
    const { userId, orgId: clerkOrgId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { data: null, error: { message: 'Unauthorized', code: 'auth/unauthenticated' } },
        { status: 401 }
      )
    }

    if (!clerkOrgId) {
      return NextResponse.json(
        { data: null, error: { message: 'Forbidden: no active organization', code: 'auth/no-org' } },
        { status: 403 }
      )
    }

    const supabase = createServerClient()

    // Look up org by Clerk org ID
    const { data: existing, error: lookupError } = await supabase
      .from('orgs')
      .select('id')
      .eq('clerk_org_id', clerkOrgId)
      .single()

    if (existing) {
      const params = context.params ? await context.params : {}
      return handler(req, { userId, clerkOrgId, orgId: existing.id }, params)
    }

    // PGRST116 = no rows found — auto-provision org on first login
    if (lookupError?.code === 'PGRST116') {
      const { data: newOrg, error: insertError } = await supabase
        .from('orgs')
        .insert({ clerk_org_id: clerkOrgId })
        .select('id')
        .single()

      if (insertError || !newOrg) {
        logger.error('withAuth', 'auth.org_provision_failed', { error_code: insertError?.code })
        return NextResponse.json(
          { data: null, error: { message: 'Forbidden', code: 'auth/org-provision-failed' } },
          { status: 403 }
        )
      }

      const params = context.params ? await context.params : {}
      return handler(req, { userId, clerkOrgId, orgId: newOrg.id }, params)
    }

    // Unexpected DB error
    logger.error('withAuth', 'auth.org_lookup_failed', { error_code: lookupError?.code })
    return NextResponse.json(
      { data: null, error: { message: 'Forbidden', code: 'auth/unknown-org' } },
      { status: 403 }
    )
  }
}
