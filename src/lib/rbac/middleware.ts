import { NextResponse } from 'next/server'
import type { RouteHandler } from '@/lib/auth/withAuth'
import type { Permission } from './types'

/**
 * requirePermission — wraps a route handler with a permission check.
 *
 * Returns 403 if the user lacks ANY of the required permissions.
 * All listed permissions must be present (AND logic).
 *
 * Usage inside withAuth:
 *   export const POST = withAuth(requirePermission(['manage_blocks'], async (req, ctx) => { ... }))
 */
export function requirePermission(required: Permission[], handler: RouteHandler): RouteHandler {
  return async (req, ctx, params) => {
    for (const perm of required) {
      if (!ctx.permissions.has(perm)) {
        return NextResponse.json(
          {
            data: null,
            error: {
              message: `Forbidden: missing permission '${perm}'`,
              code: 'auth/insufficient-permission',
            },
          },
          { status: 403 }
        )
      }
    }
    return handler(req, ctx, params)
  }
}
