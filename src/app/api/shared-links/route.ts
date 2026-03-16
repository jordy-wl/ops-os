import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { createSharedLink, listSharedLinks } from '@/lib/shared-links'
import type { Permission } from '@/lib/rbac/types'

const CreateSchema = z.object({
  block_id: z.string().uuid(),
  share_type: z.enum(['view', 'submit', 'sign']),
  expires_in_hours: z.number().int().min(1).max(8760).optional(), // max 1 year
  form_schema: z.record(z.unknown()).optional(),
  permissions: z.record(z.unknown()).optional(),
})

/**
 * GET /api/shared-links — list shared links for the org, optionally filtered by block_id
 */
export const GET = withAuth(
  requirePermission(['manage_blocks' as Permission], async (req, ctx) => {
    const url = new URL(req.url)
    const blockId = url.searchParams.get('block_id') ?? undefined

    const result = await listSharedLinks(ctx.orgId, blockId)
    if ('error' in result) {
      return apiError(result.error, result.code, 500)
    }

    return ok(result.links)
  })
)

/**
 * POST /api/shared-links — create a new shared link
 */
export const POST = withAuth(
  requirePermission(['manage_blocks' as Permission], async (req, ctx) => {
    const body = await req.json().catch(() => null)
    if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.issues)

    const result = await createSharedLink(ctx.orgId, ctx.userId, {
      blockId: parsed.data.block_id,
      shareType: parsed.data.share_type,
      expiresInHours: parsed.data.expires_in_hours,
      formSchema: parsed.data.form_schema,
      permissions: parsed.data.permissions,
    })

    if ('error' in result) {
      return apiError(result.error, result.code, 500)
    }

    return ok(result.link, 201)
  })
)
