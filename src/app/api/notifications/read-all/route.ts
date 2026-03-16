import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { markAllRead } from '@/lib/notifications/service'
import { ok } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

/**
 * POST /api/notifications/read-all
 * Mark all notifications as read for the current user.
 * Contract: prd/05-api-contracts.md — POST /api/notifications/read-all
 */
export const POST = withAuth(async (_req: NextRequest, ctx) => {
  const count = await markAllRead(ctx.orgId, ctx.userId)

  logger.info('api-notifications', 'notifications.all_marked_read', {
    org_id: ctx.orgId,
    count,
  })

  return ok({ updated: count })
})
