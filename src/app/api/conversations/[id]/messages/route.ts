/**
 * Conversation Messages API — Phase 4, Sprint 12
 *
 * GET  /api/conversations/[id]/messages  — list messages for a conversation
 * POST /api/conversations/[id]/messages  — add a message to a conversation
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'

const AddMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'tool']),
  content: z.string().max(50000),
  tool_calls: z.unknown().optional(),
})

const AddBatchSchema = z.object({
  messages: z.array(AddMessageSchema).min(1).max(50),
})

function extractConversationId(url: string): string | null {
  const parts = url.split('/conversations/')
  if (parts.length < 2) return null
  return parts[1].split('/')[0] || null
}

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const conversationId = extractConversationId(req.url)
  if (!conversationId) return apiError('Missing conversation ID', 'validation/missing-id', 400)

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? 100), 200)

  const supabase = createServerClient()

  // Verify conversation belongs to user's org
  const { data: conv } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('org_id', ctx.orgId)
    .eq('user_id', ctx.userId)
    .single()

  if (!conv) return apiError('Conversation not found', 'validation/not-found', 404)

  const { data, error } = await supabase
    .from('conversation_messages')
    .select('id, role, content, tool_calls, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) return apiError('Failed to fetch messages', 'db/query-failed', 500)

  return ok(data)
})

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const conversationId = extractConversationId(req.url)
  if (!conversationId) return apiError('Missing conversation ID', 'validation/missing-id', 400)

  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

  const supabase = createServerClient()

  // Verify conversation belongs to user's org
  const { data: conv } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('org_id', ctx.orgId)
    .eq('user_id', ctx.userId)
    .single()

  if (!conv) return apiError('Conversation not found', 'validation/not-found', 404)

  // Support batch insert (for saving user + assistant pair)
  const batchParsed = AddBatchSchema.safeParse(body)
  if (batchParsed.success) {
    const rows = batchParsed.data.messages.map((m) => ({
      conversation_id: conversationId,
      role: m.role,
      content: m.content,
      tool_calls: m.tool_calls ?? null,
    }))

    const { data, error } = await supabase
      .from('conversation_messages')
      .insert(rows)
      .select()

    if (error) return apiError('Failed to save messages', 'db/insert-failed', 500)
    return ok(data, 201)
  }

  // Single message insert
  const parsed = AddMessageSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const { data, error } = await supabase
    .from('conversation_messages')
    .insert({
      conversation_id: conversationId,
      role: parsed.data.role,
      content: parsed.data.content,
      tool_calls: parsed.data.tool_calls ?? null,
    })
    .select()
    .single()

  if (error) return apiError('Failed to save message', 'db/insert-failed', 500)

  return ok(data, 201)
})
