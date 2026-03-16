/**
 * Conversations API — Phase 4, Sprint 12
 *
 * GET  /api/conversations         — list recent conversations for current user
 * POST /api/conversations         — create a new conversation
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'

const CreateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  mode: z.enum(['discuss', 'plan', 'execute']).default('discuss'),
  page_context: z.record(z.unknown()).optional(),
})

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 50)
  const offset = Math.max(Number(searchParams.get('offset') ?? 0), 0)

  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('conversations')
    .select('id, title, mode, page_context, created_at, updated_at')
    .eq('org_id', ctx.orgId)
    .eq('user_id', ctx.userId)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return apiError('Failed to fetch conversations', 'db/query-failed', 500)

  return ok(data)
})

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      org_id: ctx.orgId,
      user_id: ctx.userId,
      title: parsed.data.title ?? 'New conversation',
      mode: parsed.data.mode,
      page_context: parsed.data.page_context ?? {},
    })
    .select()
    .single()

  if (error) return apiError('Failed to create conversation', 'db/insert-failed', 500)

  return ok(data, 201)
})
