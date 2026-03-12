import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { resolvePermissions } from '@/lib/rbac/resolve'
import type { Permission } from '@/lib/rbac/types'

export type UserRole = 'ops-admin' | 'ops-user' | 'compliance-approver'

export type AuthContext = {
  userId: string          // Clerk user ID
  clerkOrgId: string      // Clerk organization ID
  orgId: string           // Supabase internal org UUID
  role: UserRole          // Role name (backward compat with requireRole)
  roleId: string          // UUID from roles table ('' if fallback)
  permissions: Set<Permission> // Resolved from permission_groups
}

type Params = Record<string, string>

export type RouteHandler = (
  req: NextRequest,
  ctx: AuthContext,
  params: Params
) => Promise<NextResponse>

/**
 * withAuth — middleware wrapper for all API route handlers.
 *
 * Validates the Clerk JWT, extracts userId + orgId, resolves the internal
 * Supabase org UUID, auto-provisions the org row on first login, and
 * resolves the user's permissions via the custom RBAC engine.
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
      .select('id, name')
      .eq('clerk_org_id', clerkOrgId)
      .single()

    if (existing) {
      // Backfill org name from Clerk if missing
      if (!existing.name) {
        try {
          const client = await clerkClient()
          const clerkOrg = await client.organizations.getOrganization({ organizationId: clerkOrgId })
          if (clerkOrg.name) {
            await supabase
              .from('orgs')
              .update({ name: clerkOrg.name, slug: clerkOrg.slug ?? '' })
              .eq('id', existing.id)
          }
        } catch {
          // Non-blocking — org name sync is best-effort
        }
      }
      const resolved = await resolvePermissions(supabase, existing.id, userId, 'ops-user')
      const params = await context.params
      return handler(req, {
        userId, clerkOrgId, orgId: existing.id,
        role: resolved.role as UserRole, roleId: resolved.roleId, permissions: resolved.permissions,
      }, params)
    }

    // PGRST116 = no rows found — auto-provision org on first login
    if (lookupError?.code === 'PGRST116') {
      // Fetch org name from Clerk for the initial provision
      let orgName: string | undefined
      let orgSlug: string | undefined
      try {
        const client = await clerkClient()
        const clerkOrg = await client.organizations.getOrganization({ organizationId: clerkOrgId })
        orgName = clerkOrg.name
        orgSlug = clerkOrg.slug ?? undefined
      } catch {
        // Non-blocking — provision without name if Clerk call fails
      }

      const { data: newOrg, error: insertError } = await supabase
        .from('orgs')
        .insert({
          clerk_org_id: clerkOrgId,
          ...(orgName ? { name: orgName } : {}),
          ...(orgSlug ? { slug: orgSlug } : {}),
        })
        .select('id')
        .single()

      if (insertError || !newOrg) {
        logger.error('withAuth', 'auth.org_provision_failed', { error_code: insertError?.code })
        return NextResponse.json(
          { data: null, error: { message: 'Forbidden', code: 'auth/org-provision-failed' } },
          { status: 403 }
        )
      }

      // Org creator → ops-admin (RBAC roles seeded via DB trigger on org insert)
      const resolved = await resolvePermissions(supabase, newOrg.id, userId, 'ops-admin')
      const params = await context.params
      return handler(req, {
        userId, clerkOrgId, orgId: newOrg.id,
        role: resolved.role as UserRole, roleId: resolved.roleId, permissions: resolved.permissions,
      }, params)
    }

    // Unexpected DB error
    logger.error('withAuth', 'auth.org_lookup_failed', { error_code: lookupError?.code })
    return NextResponse.json(
      { data: null, error: { message: 'Forbidden', code: 'auth/unknown-org' } },
      { status: 403 }
    )
  }
}
