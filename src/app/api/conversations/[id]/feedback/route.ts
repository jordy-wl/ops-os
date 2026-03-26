/**
 * Conversation Feedback API — P7-S26-BE-01
 *
 * POST /api/conversations/[id]/feedback — submit thumbs up/down feedback on a conversation message
 *
 * MIGRATION REQUIRED (not yet applied):
 * CREATE TABLE conversation_feedback (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
 *   message_id UUID REFERENCES conversation_messages(id) ON DELETE SET NULL,
 *   user_id TEXT NOT NULL,
 *   org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
 *   rating TEXT NOT NULL CHECK (rating IN ('up', 'down')),
 *   comment TEXT,
 *   created_at TIMESTAMPTZ NOT NULL DEFAULT now()
 * );
 * CREATE INDEX idx_conversation_feedback_conversation ON conversation_feedback(conversation_id);
 * CREATE INDEX idx_conversation_feedback_org ON conversation_feedback(org_id);
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'

const FeedbackSchema = z.object({
  rating: z.enum(['up', 'down'], {
    required_error: 'rating is required',
    invalid_type_error: 'rating must be "up" or "down"',
  }),
  messageId: z.string().uuid().optional(),
  comment: z.string().max(2000).optional(),
})

function extractConversationId(url: string): string | null {
  const parts = url.split('/conversations/')
  if (parts.length < 2) return null
  return parts[1].split('/')[0] || null
}

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const conversationId = extractConversationId(req.url)
  if (!conversationId) {
    return apiError('Missing conversation ID', 'validation/missing-id', 400)
  }

  const body = await req.json().catch(() => null)
  if (!body) {
    return apiError('Invalid JSON body', 'validation/invalid-json', 400)
  }

  const parsed = FeedbackSchema.safeParse(body)
  if (!parsed.success) {
    return validationError(parsed.error.issues)
  }

  const supabase = createServerClient()

  // Verify conversation belongs to the user's org
  const { data: conv } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('org_id', ctx.orgId)
    .eq('user_id', ctx.userId)
    .single()

  if (!conv) {
    return apiError('Conversation not found', 'validation/not-found', 404)
  }

  // If messageId provided, verify it belongs to this conversation
  if (parsed.data.messageId) {
    const { data: msg } = await supabase
      .from('conversation_messages')
      .select('id')
      .eq('id', parsed.data.messageId)
      .eq('conversation_id', conversationId)
      .single()

    if (!msg) {
      return apiError('Message not found in this conversation', 'validation/not-found', 404)
    }
  }

  const { data: feedback, error } = await supabase
    .from('conversation_feedback')
    .insert({
      conversation_id: conversationId,
      message_id: parsed.data.messageId ?? null,
      user_id: ctx.userId,
      org_id: ctx.orgId,
      rating: parsed.data.rating,
      comment: parsed.data.comment ?? null,
    })
    .select('id, rating, message_id, comment, created_at')
    .single()

  if (error) {
    return apiError('Failed to save feedback', 'db/insert-failed', 500)
  }

  return ok({
    id: feedback.id,
    rating: feedback.rating,
    messageId: feedback.message_id,
    comment: feedback.comment,
    createdAt: feedback.created_at,
  }, 201)
})
