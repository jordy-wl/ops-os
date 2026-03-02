import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { withAuth } from '@/lib/auth/withAuth'
import { assembleContext, contextToPromptString } from '@/lib/context-assembly'
import { apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

const MAX_HISTORY_TURNS = 10
const MAX_TOKENS = 1000 // Sprint 1 cost cap
const MODEL = 'claude-sonnet-4-6'

const ChatSchema = z.object({
  message: z.string().min(1).max(4000),
  blockId: z.string().uuid().optional(),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .max(MAX_HISTORY_TURNS * 2)
    .optional()
    .default([]),
})

// Load system prompt from src/prompts/ — AI/ML standard: prompts never inline in application code
const SYSTEM_PROMPT_TEMPLATE = fs.readFileSync(
  path.join(process.cwd(), 'src/prompts/chat-system.v1.md'),
  'utf-8'
)

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

  const parsed = ChatSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const { message, blockId, conversationHistory } = parsed.data

  // Assemble context for Claude — pass message as query for semantic search
  const context = await assembleContext(blockId ?? null, ctx.orgId, ctx.userId, message)
  const contextString = contextToPromptString(context)

  const systemPrompt = SYSTEM_PROMPT_TEMPLATE
    .replace('{date}', new Date().toISOString().split('T')[0])
    .replace('{contextString}', contextString)

  // Build messages array — include conversation history + new user message
  const messages: Anthropic.MessageParam[] = [
    ...conversationHistory.slice(-(MAX_HISTORY_TURNS * 2)),
    { role: 'user', content: message },
  ]

  const anthropic = new Anthropic()

  let stream: AsyncIterable<Anthropic.MessageStreamEvent>
  try {
    stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages,
    })
  } catch (err) {
    logger.error('ai-chat', 'ai.stream_init_failed', { error: (err as Error).message?.slice(0, 50) })
    return apiError('AI service temporarily unavailable', 'ai/service_unavailable', 503)
  }

  // Stream via Server-Sent Events
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      let totalTokens = 0

      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const chunk = `data: ${JSON.stringify({ text: event.delta.text })}\n\n`
            controller.enqueue(encoder.encode(chunk))
          }
          if (event.type === 'message_delta' && event.usage) {
            totalTokens = event.usage.output_tokens
          }
        }

        // Log usage — no message content (PII risk)
        logger.info('ai-chat', 'ai.chat_completed', {
          org_id: ctx.orgId,
          block_id: blockId ?? null,
          message_length: message.length,
          tokens_used: totalTokens,
        })

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (err) {
        logger.error('ai-chat', 'ai.stream_error', { error: (err as Error).message?.slice(0, 50) })
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: 'AI service temporarily unavailable' })}\n\n`
          )
        )
        controller.close()
      }
    },
  })

  return new NextResponse(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
})
