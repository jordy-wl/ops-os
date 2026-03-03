import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export type UserRole = 'ops-admin' | 'ops-user' | 'compliance-approver'

export type AuthContext = {
  userId: string     // Clerk user ID
  clerkOrgId: string // Clerk organization ID
  orgId: string      // Supabase internal org UUID
  role: UserRole     // RBAC role for this user in this org
}

type Params = Record<string, string>

export type RouteHandler = (
  req: NextRequest,
  ctx: AuthContext,
  params: Params
) => Promise<NextResponse>

/**
 * Resolves the RBAC role for a user in an org.
 * If no role row exists, assigns defaultRole and inserts it.
 * On unexpected DB error, falls back to 'ops-user' (safe default).
 */
async function resolveRole(
  supabase: ReturnType<typeof createServerClient>,
  orgId: string,
  userId: string,
  defaultRole: UserRole
): Promise<UserRole> {
  const { data: roleRow, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .single()

  if (roleRow) return roleRow.role as UserRole

  if (error?.code === 'PGRST116') {
    // No role yet — assign default and persist
    await supabase
      .from('user_roles')
      .insert({ org_id: orgId, user_id: userId, role: defaultRole })
    return defaultRole
  }

  // Unexpected DB error — fail safe with least-privileged non-read-only role
  logger.warn('withAuth', 'auth.role_lookup_failed', { error_code: error?.code })
  return 'ops-user'
}

/**
 * withAuth — middleware wrapper for all API route handlers.
 *
 * Validates the Clerk JWT, extracts userId + orgId, resolves the internal
 * Supabase org UUID, auto-provisions the org row on first login, and
 * resolves the user's RBAC role (defaulting ops-admin for org creators).
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
    context: { params: Promise<Params> }
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
      const role = await resolveRole(supabase, existing.id, userId, 'ops-user')
      const params = await context.params
      return handler(req, { userId, clerkOrgId, orgId: existing.id, role }, params)
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

      // Org creator → ops-admin
      const role = await resolveRole(supabase, newOrg.id, userId, 'ops-admin')
      const params = await context.params
      return handler(req, { userId, clerkOrgId, orgId: newOrg.id, role }, params)
    }

    // Unexpected DB error
    logger.error('withAuth', 'auth.org_lookup_failed', { error_code: lookupError?.code })
    return NextResponse.json(
      { data: null, error: { message: 'Forbidden', code: 'auth/unknown-org' } },
      { status: 403 }
    )
  }
}
