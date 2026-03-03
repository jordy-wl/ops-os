import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requireRole } from '@/lib/auth/requireRole'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

const BLOCK_TYPES = ['client', 'deal', 'project', 'contact', 'contract'] as const

const CreateBlockSchema = z.object({
  type: z.enum(BLOCK_TYPES),
  name: z.string().min(1).max(255),
  metadata: z.record(z.unknown()).optional().default({}),
})

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)

  const supabase = createServerClient()
  let query = supabase
    .from('blocks')
    .select('*')
    .eq('org_id', ctx.orgId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (type) {
    query = query.eq('type', type)
  }

  const { data, error } = await query

  if (error) {
    logger.error('api-blocks', 'db.query_failed', { error_code: error.code })
    return apiError('Failed to fetch blocks', 'db/query-failed', 500)
  }

  return ok(data)
})

export const POST = withAuth(requireRole(['ops-admin', 'ops-user'], async (req: NextRequest, ctx) => {
  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

  const parsed = CreateBlockSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const supabase = createServerClient()

  const { data: block, error: blockError } = await supabase
    .from('blocks')
    .insert({
      org_id: ctx.orgId,
      type: parsed.data.type,
      name: parsed.data.name,
      metadata: parsed.data.metadata,
    })
    .select()
    .single()

  if (blockError || !block) {
    logger.error('api-blocks', 'db.insert_failed', { error_code: blockError?.code })
    return apiError('Failed to create block', 'db/insert-failed', 500)
  }

  const { data: event, error: eventError } = await supabase
    .from('events')
    .insert({
      org_id: ctx.orgId,
      block_id: block.id,
      type: 'block.created',
      actor_id: ctx.userId,
      actor_type: 'human',
      payload: { block_type: block.type, name: block.name },
    })
    .select()
    .single()

  if (eventError) {
    // Block was created; event is required for audit trail — critical error
    logger.error('api-blocks', 'db.event_insert_failed', { error_code: eventError.code, critical: true })
  }

  return ok({ block, event: event ?? null }, 201)
}))
