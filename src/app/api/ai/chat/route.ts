import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { withAuth } from '@/lib/auth/withAuth'
import { assembleContext, contextToPromptString } from '@/lib/context-assembly'
import { CHAT_TOOLS, executeChatTool } from '@/lib/ai/chat-tools'
import { apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

const MAX_HISTORY_TURNS = 10
const MAX_TOKENS = 1000
const MAX_TOOL_ROUNDS = 3
const MODEL = 'claude-sonnet-4-6'

const ChatMode = z.enum(['discuss', 'plan', 'execute']).default('discuss')

const ChatSchema = z.object({
  message: z.string().min(1).max(4000),
  blockId: z.string().uuid().optional(),
  mode: ChatMode,
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

// Load mode-specific system prompts
const PROMPTS: Record<string, string> = {}
for (const mode of ['discuss', 'plan', 'execute'] as const) {
  PROMPTS[mode] = fs.readFileSync(
    path.join(process.cwd(), `src/prompts/chat-${mode}-mode.v1.md`),
    'utf-8'
  )
}

function buildSystemPrompt(mode: string, contextString: string): string {
  const template = PROMPTS[mode] ?? PROMPTS.discuss
  return template
    .replace('{date}', new Date().toISOString().split('T')[0])
    .replace('{contextString}', contextString)
}

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

  const parsed = ChatSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const { message, blockId, mode, conversationHistory } = parsed.data

  // RBAC: execute mode requires ops-admin
  if (mode === 'execute' && ctx.role !== 'ops-admin') {
    return apiError(
      'Execute mode requires ops-admin role',
      'auth/insufficient-role',
      403
    )
  }

  // Assemble context
  const context = await assembleContext(blockId ?? null, ctx.orgId, ctx.userId, message)
  const contextString = contextToPromptString(context)
  const systemPrompt = buildSystemPrompt(mode, contextString)

  const messages: Anthropic.MessageParam[] = [
    ...conversationHistory.slice(-(MAX_HISTORY_TURNS * 2)),
    { role: 'user', content: message },
  ]

  const anthropic = new Anthropic()

  // ── Execute mode: handle tool_use with multi-turn loop ─────────────
  if (mode === 'execute') {
    return handleExecuteMode(anthropic, systemPrompt, messages, ctx.orgId, ctx.role, blockId, message)
  }

  // ── Discuss / Plan mode: standard streaming ────────────────────────
  const tools = undefined // no tools for discuss/plan
  let stream: AsyncIterable<Anthropic.MessageStreamEvent>
  try {
    stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages,
      ...(tools ? { tools } : {}),
    })
  } catch (err) {
    logger.error('ai-chat', 'ai.stream_init_failed', { error: (err as Error).message?.slice(0, 50) })
    return apiError('AI service temporarily unavailable', 'ai/service_unavailable', 503)
  }

  return streamSseResponse(stream, ctx.orgId, blockId, message.length, mode)
})

// ─── Execute Mode Handler ────────────────────────────────────────────────────

async function handleExecuteMode(
  anthropic: Anthropic,
  systemPrompt: string,
  messages: Anthropic.MessageParam[],
  orgId: string,
  role: string,
  blockId: string | undefined,
  userMessage: string
): Promise<NextResponse> {
  const encoder = new TextEncoder()
  const toolCallsMade: Array<{ name: string; input: unknown; result: unknown }> = []

  const readable = new ReadableStream({
    async start(controller) {
      try {
        let currentMessages = [...messages]
        let rounds = 0

        while (rounds < MAX_TOOL_ROUNDS) {
          rounds++

          const response = await anthropic.messages.create({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            system: systemPrompt,
            messages: currentMessages,
            tools: CHAT_TOOLS,
          })

          // Stream text blocks
          for (const block of response.content) {
            if (block.type === 'text' && block.text) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: block.text })}\n\n`)
              )
            }
          }

          // Check for tool_use
          const toolUseBlocks = response.content.filter(
            (b): b is Anthropic.ContentBlock & { type: 'tool_use' } => b.type === 'tool_use'
          )

          if (toolUseBlocks.length === 0 || response.stop_reason !== 'tool_use') {
            break // No more tools — done
          }

          // Execute tools and build results
          const toolResults: Anthropic.ToolResultBlockParam[] = []
          for (const toolBlock of toolUseBlocks) {
            const result = await executeChatTool(
              toolBlock.name,
              toolBlock.input as Record<string, unknown>,
              orgId,
              role as 'ops-admin' | 'ops-user' | 'compliance-approver'
            )

            toolCallsMade.push({
              name: toolBlock.name,
              input: toolBlock.input,
              result,
            })

            // Emit tool call info to client
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  tool_call: {
                    name: toolBlock.name,
                    input: toolBlock.input,
                    result,
                  },
                })}\n\n`
              )
            )

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolBlock.id,
              content: JSON.stringify(result),
            })
          }

          // Continue conversation with tool results
          currentMessages = [
            ...currentMessages,
            { role: 'assistant', content: response.content },
            { role: 'user', content: toolResults },
          ]
        }

        logger.info('ai-chat', 'ai.chat_completed', {
          org_id: orgId,
          block_id: blockId ?? null,
          message_length: userMessage.length,
          mode: 'execute',
          tool_calls: toolCallsMade.length,
        })

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (err) {
        logger.error('ai-chat', 'ai.execute_error', {
          error: (err as Error).message?.slice(0, 100),
        })
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
}

// ─── SSE Streaming Helper ────────────────────────────────────────────────────

function streamSseResponse(
  stream: AsyncIterable<Anthropic.MessageStreamEvent>,
  orgId: string,
  blockId: string | undefined,
  messageLength: number,
  mode: string
): NextResponse {
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

        logger.info('ai-chat', 'ai.chat_completed', {
          org_id: orgId,
          block_id: blockId ?? null,
          message_length: messageLength,
          tokens_used: totalTokens,
          mode,
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
}
