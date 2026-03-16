/**
 * Single Conversation API — Phase 4, Sprint 12
 *
 * GET    /api/conversations/[id]  — get conversation with recent messages
 * PATCH  /api/conversations/[id]  — update title
 * DELETE /api/conversations/[id]  — delete conversation + messages
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'

const UpdateSchema = z.object({
  title: z.string().min(1).max(200),
})

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const id = new URL(req.url).pathname.split('/').pop()
  if (!id) return apiError('Missing conversation ID', 'validation/missing-id', 400)

  const supabase = createServerClient()

  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .eq('user_id', ctx.userId)
    .single()

  if (convErr || !conv) return apiError('Conversation not found', 'validation/not-found', 404)

  const { data: messages } = await supabase
    .from('conversation_messages')
    .select('id, role, content, tool_calls, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })
    .limit(200)

  return ok({ ...conv, messages: messages ?? [] })
})

export const PATCH = withAuth(async (req: NextRequest, ctx) => {
  const id = new URL(req.url).pathname.split('/').pop()
  if (!id) return apiError('Missing conversation ID', 'validation/missing-id', 400)

  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('conversations')
    .update({ title: parsed.data.title })
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .eq('user_id', ctx.userId)
    .select()
    .single()

  if (error || !data) return apiError('Failed to update conversation', 'db/update-failed', 500)

  return ok(data)
})

export const DELETE = withAuth(async (req: NextRequest, ctx) => {
  const id = new URL(req.url).pathname.split('/').pop()
  if (!id) return apiError('Missing conversation ID', 'validation/missing-id', 400)

  const supabase = createServerClient()

  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .eq('user_id', ctx.userId)

  if (error) return apiError('Failed to delete conversation', 'db/delete-failed', 500)

  return ok({ deleted: true })
})
