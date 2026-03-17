import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

/**
 * GET /api/time-entries/active
 * Returns the currently running timer for the authenticated user (if any).
 * A running timer has ended_at IS NULL.
 */
export const GET = withAuth(async (_req: NextRequest, ctx) => {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('time_entries')
    .select('*')
    .eq('org_id', ctx.orgId)
    .eq('user_id', ctx.userId)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    logger.error('api-time-entries', 'active.fetch_failed', { error_code: error.code })
    return apiError('Failed to fetch active timer', 'db/query-failed', 500)
  }

  return ok(data)
})

/**
 * PATCH /api/time-entries/active
 * Stops the currently running timer. Sets ended_at + computes duration_seconds.
 */
export const PATCH = withAuth(async (_req: NextRequest, ctx) => {
  const supabase = createServerClient()

  // Find running timer
  const { data: active, error: findError } = await supabase
    .from('time_entries')
    .select('id, started_at')
    .eq('org_id', ctx.orgId)
    .eq('user_id', ctx.userId)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (findError) {
    logger.error('api-time-entries', 'active.find_failed', { error_code: findError.code })
    return apiError('Failed to find active timer', 'db/query-failed', 500)
  }

  if (!active) {
    return apiError('No active timer found', 'timer/not-running', 404)
  }

  const now = new Date()
  const durationSeconds = Math.round(
    (now.getTime() - new Date(active.started_at).getTime()) / 1000
  )

  const { data: stopped, error: stopError } = await supabase
    .from('time_entries')
    .update({
      ended_at: now.toISOString(),
      duration_seconds: durationSeconds,
      updated_at: now.toISOString(),
    })
    .eq('id', active.id)
    .eq('org_id', ctx.orgId)
    .select()
    .single()

  if (stopError) {
    logger.error('api-time-entries', 'active.stop_failed', { error_code: stopError.code })
    return apiError('Failed to stop timer', 'db/update-failed', 500)
  }

  logger.info('api-time-entries', 'timer.stopped', {
    org_id: ctx.orgId,
    entry_id: active.id,
    duration_seconds: durationSeconds,
  })

  return ok(stopped)
})
