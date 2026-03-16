import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'
import { createServerClient } from '@/lib/supabase/server'

// ─── Constants ──────────────────────────────────────────────────────────────

const PREFS_BLOCK_TYPE = 'notification_preferences'

const EVENT_TYPES = [
  'delta_alert',
  'task_assigned',
  'step_overdue',
  'workflow_complete',
  'mention',
] as const

const FREQUENCIES = ['immediate', 'daily_digest'] as const

// ─── Default Preferences ────────────────────────────────────────────────────

const DEFAULT_PREFERENCES = {
  event_types: {
    delta_alert: { in_app: true, email: false },
    task_assigned: { in_app: true, email: true },
    step_overdue: { in_app: true, email: true },
    workflow_complete: { in_app: true, email: false },
    mention: { in_app: true, email: true },
  },
  frequency: 'immediate' as const,
}

// ─── Validation Schema ──────────────────────────────────────────────────────

const ChannelSchema = z.object({
  in_app: z.boolean(),
  email: z.boolean(),
})

const NotificationPreferencesSchema = z.object({
  event_types: z.object({
    delta_alert: ChannelSchema,
    task_assigned: ChannelSchema,
    step_overdue: ChannelSchema,
    workflow_complete: ChannelSchema,
    mention: ChannelSchema,
  }),
  frequency: z.enum(FREQUENCIES),
})

export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>

// ─── GET /api/settings/notifications ────────────────────────────────────────

/**
 * GET /api/settings/notifications
 * Returns the current user's notification preferences, or defaults if none set.
 * Scoped per-user via ctx.userId.
 */
export const GET = withAuth(async (_req: NextRequest, ctx) => {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('blocks')
    .select('id, metadata')
    .eq('org_id', ctx.orgId)
    .eq('type', PREFS_BLOCK_TYPE)
    .eq('created_by', ctx.userId)
    .limit(1)
    .maybeSingle()

  if (error) {
    logger.error('api-settings-notifications', 'prefs.fetch_failed', {
      error_code: error.code,
      org_id: ctx.orgId,
    })
    return apiError('Failed to fetch notification preferences', 'settings/fetch-failed', 500)
  }

  const preferences = data?.metadata ?? DEFAULT_PREFERENCES

  logger.info('api-settings-notifications', 'prefs.fetched', {
    org_id: ctx.orgId,
    has_custom: !!data,
  })

  return ok(preferences)
})

// ─── PUT /api/settings/notifications ────────────────────────────────────────

/**
 * PUT /api/settings/notifications
 * Validates and saves the user's notification preferences.
 * Upserts a block of type 'notification_preferences' scoped to the user.
 */
export const PUT = withAuth(async (req: NextRequest, ctx) => {
  const body = await req.json().catch(() => null)
  if (!body) {
    return apiError('Invalid JSON body', 'validation/invalid-json', 400)
  }

  const parsed = NotificationPreferencesSchema.safeParse(body)
  if (!parsed.success) {
    return validationError(parsed.error.issues)
  }

  // Enforce in_app always true (cannot disable in-app notifications)
  for (const eventType of EVENT_TYPES) {
    parsed.data.event_types[eventType].in_app = true
  }

  const supabase = createServerClient()

  // Check if a preferences block already exists for this user
  const { data: existing, error: lookupError } = await supabase
    .from('blocks')
    .select('id')
    .eq('org_id', ctx.orgId)
    .eq('type', PREFS_BLOCK_TYPE)
    .eq('created_by', ctx.userId)
    .limit(1)
    .maybeSingle()

  if (lookupError) {
    logger.error('api-settings-notifications', 'prefs.lookup_failed', {
      error_code: lookupError.code,
      org_id: ctx.orgId,
    })
    return apiError('Failed to save notification preferences', 'settings/save-failed', 500)
  }

  try {
    if (existing) {
      // Update existing preferences block
      const { error: updateError } = await supabase
        .from('blocks')
        .update({ metadata: parsed.data })
        .eq('id', existing.id)

      if (updateError) {
        throw updateError
      }
    } else {
      // Create new preferences block
      const { error: insertError } = await supabase
        .from('blocks')
        .insert({
          org_id: ctx.orgId,
          type: PREFS_BLOCK_TYPE,
          name: `Notification Preferences`,
          status: 'active',
          data: {},
          metadata: parsed.data,
          created_by: ctx.userId,
        })

      if (insertError) {
        throw insertError
      }
    }

    logger.info('api-settings-notifications', 'prefs.saved', {
      org_id: ctx.orgId,
      frequency: parsed.data.frequency,
      is_update: !!existing,
    })

    return ok(parsed.data)
  } catch (err) {
    logger.error('api-settings-notifications', 'prefs.save_failed', {
      org_id: ctx.orgId,
      error_code: err instanceof Error ? err.message : 'unknown',
    })
    return apiError('Failed to save notification preferences', 'settings/save-failed', 500)
  }
})
