import { NextResponse } from 'next/server'
import type { UserRole, RouteHandler } from './withAuth'

/**
 * requireRole — wraps a route handler with a role check.
 *
 * Returns 403 if the user's role is not in the allowed list.
 * Use inside withAuth:
 *   export const POST = withAuth(requireRole(['ops-admin', 'ops-user'], async (req, ctx) => { ... }))
 */
export function requireRole(allowed: UserRole[], handler: RouteHandler): RouteHandler {
  return async (req, ctx, params) => {
    if (!allowed.includes(ctx.role)) {
      return NextResponse.json(
        { data: null, error: { message: 'Forbidden: insufficient role', code: 'auth/insufficient-role' } },
        { status: 403 }
      )
    }
    return handler(req, ctx, params)
  }
}
