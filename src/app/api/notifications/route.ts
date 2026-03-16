import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getNotifications } from '@/lib/notifications/service'
import { ok } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

/**
 * GET /api/notifications
 * List notifications for the current user.
 * Query params: ?unread=true, ?limit=50, ?offset=0
 * Contract: prd/05-api-contracts.md — GET /api/notifications
 */
export const GET = withAuth(async (req: NextRequest, ctx) => {
  const { searchParams } = new URL(req.url)
  const unreadOnly = searchParams.get('unread') === 'true'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10), 0)

  const result = await getNotifications({
    orgId: ctx.orgId,
    userId: ctx.userId,
    unreadOnly,
    limit,
    offset,
  })

  logger.info('api-notifications', 'notifications.listed', {
    org_id: ctx.orgId,
    count: result.notifications.length,
    unread_count: result.unreadCount,
  })

  return ok({
    notifications: result.notifications,
    meta: { unread_count: result.unreadCount },
  })
})
