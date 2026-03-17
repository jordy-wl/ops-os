import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

// ─── Validation ─────────────────────────────────────────────────────────────

const CreateSchema = z.object({
  block_id: z.string().uuid().nullable().optional(),
  description: z.string().max(500).default(''),
  started_at: z.string().datetime().optional(),
  ended_at: z.string().datetime().nullable().optional(),
  duration_seconds: z.number().int().min(0).nullable().optional(),
  is_billable: z.boolean().default(false),
})

const UpdateSchema = z.object({
  block_id: z.string().uuid().nullable().optional(),
  description: z.string().max(500).optional(),
  started_at: z.string().datetime().optional(),
  ended_at: z.string().datetime().nullable().optional(),
  duration_seconds: z.number().int().min(0).nullable().optional(),
  is_billable: z.boolean().optional(),
})

// ─── GET /api/time-entries ──────────────────────────────────────────────────

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const supabase = createServerClient()
  const url = new URL(req.url)

  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const blockId = url.searchParams.get('block_id')
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 200)

  let query = supabase
    .from('time_entries')
    .select('*')
    .eq('org_id', ctx.orgId)
    .eq('user_id', ctx.userId)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (from) query = query.gte('started_at', from)
  if (to) query = query.lte('started_at', to)
  if (blockId) query = query.eq('block_id', blockId)

  const { data, error } = await query

  if (error) {
    logger.error('api-time-entries', 'list.failed', { error_code: error.code })
    return apiError('Failed to fetch time entries', 'db/query-failed', 500)
  }

  return ok(data ?? [])
})

// ─── POST /api/time-entries ─────────────────────────────────────────────────

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const input = parsed.data
  const supabase = createServerClient()

  // If ended_at provided, compute duration_seconds
  let durationSeconds = input.duration_seconds ?? null
  const startedAt = input.started_at ?? new Date().toISOString()
  if (input.ended_at && !durationSeconds) {
    durationSeconds = Math.round(
      (new Date(input.ended_at).getTime() - new Date(startedAt).getTime()) / 1000
    )
  }

  const { data, error } = await supabase
    .from('time_entries')
    .insert({
      org_id: ctx.orgId,
      user_id: ctx.userId,
      block_id: input.block_id ?? null,
      description: input.description,
      started_at: startedAt,
      ended_at: input.ended_at ?? null,
      duration_seconds: durationSeconds,
      is_billable: input.is_billable,
    })
    .select()
    .single()

  if (error) {
    logger.error('api-time-entries', 'create.failed', { error_code: error.code })
    return apiError('Failed to create time entry', 'db/insert-failed', 500)
  }

  logger.info('api-time-entries', 'entry.created', {
    org_id: ctx.orgId,
    entry_id: data.id,
    has_block: !!input.block_id,
  })

  return ok(data, 201)
})

// ─── PATCH /api/time-entries ────────────────────────────────────────────────

export const PATCH = withAuth(async (req: NextRequest, ctx) => {
  const url = new URL(req.url)
  const entryId = url.searchParams.get('id')
  if (!entryId) return apiError('Missing entry ID', 'validation/missing-id', 400)

  const body = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const updates = parsed.data
  const supabase = createServerClient()

  // Recompute duration if ended_at is set
  if (updates.ended_at && updates.started_at) {
    updates.duration_seconds = Math.round(
      (new Date(updates.ended_at).getTime() - new Date(updates.started_at).getTime()) / 1000
    )
  }

  const { data, error } = await supabase
    .from('time_entries')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', entryId)
    .eq('org_id', ctx.orgId)
    .eq('user_id', ctx.userId)
    .select()
    .single()

  if (error) {
    logger.error('api-time-entries', 'update.failed', { error_code: error.code, entry_id: entryId })
    return apiError('Failed to update time entry', 'db/update-failed', 500)
  }

  return ok(data)
})
