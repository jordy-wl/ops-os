import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { markRead } from '@/lib/notifications/service'
import { ok, apiError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

/**
 * PATCH /api/notifications/:id
 * Mark a single notification as read.
 * Matches contract: PATCH /api/notifications/:id/read
 * (Next.js dynamic route resolves :id from params)
 */
export const PATCH = withAuth(async (_req: NextRequest, ctx, params) => {
  const { id } = params

  if (!id) {
    return apiError('Notification ID is required', 'validation/missing-id', 400)
  }

  // UUID format check
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) {
    return apiError('Invalid notification ID format', 'validation/invalid-id', 400)
  }

  const notification = await markRead(id, ctx.orgId, ctx.userId)

  if (!notification) {
    return apiError('Notification not found', 'notifications/not-found', 404)
  }

  logger.info('api-notifications', 'notification.marked_read', {
    notification_id: id,
    org_id: ctx.orgId,
  })

  return ok({ notification })
})
