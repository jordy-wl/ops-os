import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'
import { embedEvent } from '@/lib/embeddings'
import type { Event } from '@/lib/context-assembly'

// actor_id: always from JWT — not accepted from request body
// occurred_at: always server-side — not accepted from request body
const CreateEventSchema = z.object({
  block_id: z.string().uuid(),
  type: z.string().min(1).max(100),
  actor_type: z.enum(['human', 'ai', 'system']).optional().default('human'),
  payload: z.record(z.unknown()).optional().default({}),
})

// No PUT, PATCH, or DELETE endpoints for events — events are immutable.

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const { searchParams } = new URL(req.url)
  const blockId = searchParams.get('block_id')
  const orgIdParam = searchParams.get('org_id')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)
  const cursor = searchParams.get('cursor') // ISO timestamp for cursor pagination

  if (!blockId && !orgIdParam) {
    return apiError('block_id or org_id query param is required', 'validation/missing-param', 400)
  }

  const supabase = createServerClient()
  let query = supabase
    .from('events')
    .select('*')
    .eq('org_id', ctx.orgId)
    .order('occurred_at', { ascending: false })
    .limit(limit)

  if (blockId) {
    query = query.eq('block_id', blockId)
  }

  if (cursor) {
    query = query.lt('occurred_at', cursor)
  }

  const { data, error } = await query

  if (error) {
    logger.error('api-events', 'db.query_failed', { error_code: error.code })
    return apiError('Failed to fetch events', 'db/query-failed', 500)
  }

  const nextCursor =
    data && data.length === limit ? data[data.length - 1].occurred_at : null

  return ok({ events: data, cursor: nextCursor })
})

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

  const parsed = CreateEventSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const supabase = createServerClient()

  // Verify block belongs to this org
  const { data: block, error: blockError } = await supabase
    .from('blocks')
    .select('id')
    .eq('id', parsed.data.block_id)
    .eq('org_id', ctx.orgId)
    .single()

  if (blockError?.code === 'PGRST116' || !block) {
    return apiError('Block not found', 'events/block-not-found', 404)
  }
  if (blockError) {
    logger.error('api-events', 'db.query_failed', { error_code: blockError.code })
    return apiError('Failed to verify block', 'db/query-failed', 500)
  }

  const { data: event, error: eventError } = await supabase
    .from('events')
    .insert({
      org_id: ctx.orgId,
      block_id: parsed.data.block_id,
      type: parsed.data.type,
      actor_id: ctx.userId, // Always from JWT — never from request body
      actor_type: parsed.data.actor_type,
      payload: parsed.data.payload,
      // occurred_at defaults to now() in the DB — never from request body
    })
    .select()
    .single()

  if (eventError || !event) {
    logger.error('api-events', 'db.insert_failed', { error_code: eventError?.code })
    return apiError('Failed to create event', 'db/insert-failed', 500)
  }

  // Fire-and-forget: embed the event for semantic search.
  // Failures are caught internally and logged — they must never fail event creation.
  embedEvent(event as Event, supabase).catch((err: Error) =>
    logger.error('api-events', 'embed.unhandled', { event_id: event.id, error: err.message?.slice(0, 100) })
  )

  return ok(event, 201)
})
