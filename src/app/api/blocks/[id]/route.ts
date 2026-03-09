import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

const UpdateBlockSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    state: z.string().min(1).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  })

function computeDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Record<string, { before: unknown; after: unknown }> {
  const diff: Record<string, { before: unknown; after: unknown }> = {}
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      diff[key] = { before: before[key], after: after[key] }
    }
  }
  return diff
}

export const GET = withAuth(async (_req: NextRequest, ctx, params) => {
  const { id } = params
  const supabase = createServerClient()

  const { data: block, error: blockError } = await supabase
    .from('blocks')
    .select('*')
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .single()

  if (blockError) {
    if (blockError.code === 'PGRST116') return apiError('Block not found', 'blocks/not-found', 404)
    logger.error('api-blocks', 'db.query_failed', { error_code: blockError.code })
    return apiError('Failed to fetch block', 'db/query-failed', 500)
  }
  if (!block) return apiError('Block not found', 'blocks/not-found', 404)

  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('*')
    .eq('block_id', id)
    .eq('org_id', ctx.orgId)
    .order('occurred_at', { ascending: false })
    .limit(20)

  if (eventsError) {
    logger.warn('api-blocks', 'db.events_query_failed', { error_code: eventsError.code })
  }

  return ok({ block, events: events ?? [] })
})

export const PATCH = withAuth(async (req: NextRequest, ctx, params) => {
  const { id } = params
  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

  const parsed = UpdateBlockSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const supabase = createServerClient()

  const { data: current, error: fetchError } = await supabase
    .from('blocks')
    .select('*')
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .single()

  if (fetchError) {
    if (fetchError.code === 'PGRST116') return apiError('Block not found', 'blocks/not-found', 404)
    logger.error('api-blocks', 'db.query_failed', { error_code: fetchError.code })
    return apiError('Failed to fetch block', 'db/query-failed', 500)
  }
  if (!current) return apiError('Block not found', 'blocks/not-found', 404)

  const { data: updated, error: updateError } = await supabase
    .from('blocks')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .select()
    .single()

  if (updateError || !updated) {
    logger.error('api-blocks', 'db.update_failed', { error_code: updateError?.code })
    return apiError('Failed to update block', 'db/update-failed', 500)
  }

  // Build diff over changed fields only
  const before: Record<string, unknown> = {}
  const after: Record<string, unknown> = {}
  for (const key of Object.keys(parsed.data) as (keyof typeof parsed.data)[]) {
    before[key] = (current as Record<string, unknown>)[key]
    after[key] = parsed.data[key]
  }

  const { data: event, error: eventError } = await supabase
    .from('events')
    .insert({
      org_id: ctx.orgId,
      block_id: id,
      type: 'block.updated',
      actor_id: ctx.userId,
      actor_type: 'human',
      payload: { diff: computeDiff(before, after) },
    })
    .select()
    .single()

  if (eventError) {
    logger.error('api-blocks', 'db.event_insert_failed', { error_code: eventError.code, critical: true })
  }

  return ok({ block: updated, event: event ?? null })
})
