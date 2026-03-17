import { logger } from '@/lib/logger'
import type { StepHandler } from './types'

/**
 * send_notification handler — inserts a notification into the notifications table.
 *
 * Step config:
 * - notification_title: string (required)
 * - notification_body: string (optional)
 * - notification_type: 'info' | 'warning' | 'success' | 'error' (default 'info')
 * - notification_user_id: target user ID (optional, defaults to null = org-wide)
 * - notification_link: optional link URL
 */
const handler: StepHandler = async (step, meta, orgId, supabase) => {
  const now = new Date().toISOString()
  const stepAny = step as Record<string, unknown>

  const title = (stepAny.notification_title as string) ?? step.name
  const body = (stepAny.notification_body as string) ?? ''
  const type = (stepAny.notification_type as string) ?? 'info'
  const userId = stepAny.notification_user_id as string | undefined
  const link = stepAny.notification_link as string | undefined

  if (!title) {
    return { step_name: step.name, step_type: step.type, status: 'failed', error: 'Missing notification_title', executed_at: now }
  }

  const { data: notification, error } = await supabase
    .from('notifications')
    .insert({
      org_id: orgId,
      user_id: userId ?? null,
      title,
      body,
      type,
      link: link ?? null,
      source_type: 'workflow',
      source_id: meta.template_id,
      read: false,
    })
    .select('id')
    .single()

  if (error || !notification) {
    logger.error('step-engine', 'step.send_notification_failed', { error_code: error?.code })
    return { step_name: step.name, step_type: step.type, status: 'failed', error: error?.message ?? 'Failed to create notification', executed_at: now }
  }

  logger.info('step-engine', 'step.send_notification_completed', {
    notification_id: notification.id,
    type,
    has_user: !!userId,
  })

  return {
    step_name: step.name,
    step_type: step.type,
    status: 'completed',
    output: { notification_id: notification.id, title, type },
    executed_at: now,
  }
}

export default handler
