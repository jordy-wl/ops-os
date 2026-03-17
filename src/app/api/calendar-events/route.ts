import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

// ─── Validation ─────────────────────────────────────────────────────────────

const CreateSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).default(''),
  start_at: z.string().datetime(),
  end_at: z.string().datetime(),
  all_day: z.boolean().default(false),
  color: z.string().max(20).default('primary'),
  block_id: z.string().uuid().nullable().optional(),
})

const UpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional(),
  start_at: z.string().datetime().optional(),
  end_at: z.string().datetime().optional(),
  all_day: z.boolean().optional(),
  color: z.string().max(20).optional(),
  block_id: z.string().uuid().nullable().optional(),
})

// ─── GET /api/calendar-events ───────────────────────────────────────────────

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const supabase = createServerClient()
  const url = new URL(req.url)

  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  if (!from || !to) {
    return apiError('Missing from/to date range', 'validation/missing-range', 400)
  }

  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('org_id', ctx.orgId)
    .eq('user_id', ctx.userId)
    .gte('end_at', from)
    .lte('start_at', to)
    .order('start_at', { ascending: true })
    .limit(500)

  if (error) {
    logger.error('api-calendar', 'list.failed', { error_code: error.code })
    return apiError('Failed to fetch calendar events', 'db/query-failed', 500)
  }

  return ok(data ?? [])
})

// ─── POST /api/calendar-events ──────────────────────────────────────────────

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const input = parsed.data
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('calendar_events')
    .insert({
      org_id: ctx.orgId,
      user_id: ctx.userId,
      title: input.title,
      description: input.description,
      start_at: input.start_at,
      end_at: input.end_at,
      all_day: input.all_day,
      source: 'local',
      color: input.color,
      block_id: input.block_id ?? null,
    })
    .select()
    .single()

  if (error) {
    logger.error('api-calendar', 'create.failed', { error_code: error.code })
    return apiError('Failed to create event', 'db/insert-failed', 500)
  }

  logger.info('api-calendar', 'event.created', { org_id: ctx.orgId, event_id: data.id })
  return ok(data, 201)
})

// ─── PATCH /api/calendar-events ─────────────────────────────────────────────

export const PATCH = withAuth(async (req: NextRequest, ctx) => {
  const url = new URL(req.url)
  const eventId = url.searchParams.get('id')
  if (!eventId) return apiError('Missing event ID', 'validation/missing-id', 400)

  const body = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('calendar_events')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', eventId)
    .eq('org_id', ctx.orgId)
    .eq('user_id', ctx.userId)
    .select()
    .single()

  if (error) {
    logger.error('api-calendar', 'update.failed', { error_code: error.code, event_id: eventId })
    return apiError('Failed to update event', 'db/update-failed', 500)
  }

  return ok(data)
})
