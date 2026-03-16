import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

// ─── Types ──────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'delta_alert'
  | 'task_assigned'
  | 'workflow_completed'
  | 'approval_needed'
  | 'system'

export interface CreateNotificationParams {
  orgId: string
  userId: string
  type: NotificationType | string
  title: string
  body?: string
  blockId?: string
}

export interface NotificationRow {
  id: string
  org_id: string
  user_id: string
  type: string
  title: string
  body: string | null
  block_id: string | null
  read: boolean
  created_at: string
}

export interface GetNotificationsParams {
  orgId: string
  userId: string
  unreadOnly?: boolean
  limit?: number
  offset?: number
}

export interface GetNotificationsResult {
  notifications: NotificationRow[]
  unreadCount: number
}

// ─── Service Functions ──────────────────────────────────────────────────────

/**
 * createNotification — insert a notification row.
 * Fire-and-forget safe: caller can await or ignore the promise.
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<NotificationRow | null> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      org_id: params.orgId,
      user_id: params.userId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      block_id: params.blockId ?? null,
    })
    .select()
    .single()

  if (error) {
    logger.error('notifications', 'notification.create_failed', {
      error_code: error.code,
      type: params.type,
    })
    return null
  }

  logger.info('notifications', 'notification.created', {
    notification_id: data.id,
    type: params.type,
    org_id: params.orgId,
  })

  return data as NotificationRow
}

/**
 * getNotifications — list notifications for a user, with optional unread filter.
 * Returns notifications and the total unread count for badge display.
 */
export async function getNotifications(
  params: GetNotificationsParams
): Promise<GetNotificationsResult> {
  const supabase = createServerClient()
  const limit = Math.min(params.limit ?? 50, 200)
  const offset = params.offset ?? 0

  // Build the listing query
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('org_id', params.orgId)
    .eq('user_id', params.userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (params.unreadOnly) {
    query = query.eq('read', false)
  }

  const { data, error } = await query

  if (error) {
    logger.error('notifications', 'notification.list_failed', {
      error_code: error.code,
    })
    return { notifications: [], unreadCount: 0 }
  }

  // Get unread count separately for the badge
  const { count, error: countError } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', params.orgId)
    .eq('user_id', params.userId)
    .eq('read', false)

  if (countError) {
    logger.warn('notifications', 'notification.count_failed', {
      error_code: countError.code,
    })
  }

  return {
    notifications: (data ?? []) as NotificationRow[],
    unreadCount: count ?? 0,
  }
}

/**
 * markRead — mark a single notification as read.
 * Scoped to the user's org for security.
 */
export async function markRead(
  notificationId: string,
  orgId: string,
  userId: string
): Promise<NotificationRow | null> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Not found
    }
    logger.error('notifications', 'notification.mark_read_failed', {
      error_code: error.code,
      notification_id: notificationId,
    })
    return null
  }

  return data as NotificationRow
}

/**
 * markAllRead — mark all unread notifications as read for a user.
 * Returns the count of notifications updated.
 */
export async function markAllRead(
  orgId: string,
  userId: string
): Promise<number> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .eq('read', false)
    .select('id')

  if (error) {
    logger.error('notifications', 'notification.mark_all_read_failed', {
      error_code: error.code,
    })
    return 0
  }

  const count = data?.length ?? 0

  logger.info('notifications', 'notification.all_marked_read', {
    org_id: orgId,
    count,
  })

  return count
}
