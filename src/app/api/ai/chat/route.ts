import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { withAuth } from '@/lib/auth/withAuth'
import { assembleContext, contextToPromptString } from '@/lib/context-assembly'
import { loadDeltaContext } from '@/lib/ai/delta-context-loader'
import { CHAT_TOOLS } from '@/lib/ai/chat-tools'
import { buildActionPreviews } from '@/lib/ai/action-preview'
import { MentionInputSchema, resolveMentionContext } from '@/lib/ai/mention-context'
import { createServerClient } from '@/lib/supabase/server'
import { apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

const MAX_HISTORY_TURNS = 10
const MAX_TOKENS = 1000
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
  mentions: MentionInputSchema.optional().default([]),
})

// Load mode-specific system prompts (v3 for discuss/plan, v2 for execute)
const PROMPTS: Record<string, string> = {}
const PROMPT_VERSIONS: Record<string, string> = { discuss: 'v3', plan: 'v3', execute: 'v2' }
for (const mode of ['discuss', 'plan', 'execute'] as const) {
  PROMPTS[mode] = fs.readFileSync(
    path.join(process.cwd(), `src/prompts/chat-${mode}-mode.${PROMPT_VERSIONS[mode]}.md`),
    'utf-8'
  )
}

function buildSystemPrompt(mode: string, contextString: string, mentionContext?: string | null): string {
  const template = PROMPTS[mode] ?? PROMPTS.discuss
  let prompt = template
    .replace('{date}', new Date().toISOString().split('T')[0])
    .replace('{contextString}', contextString)

  if (mentionContext) {
    prompt += `\n\n<MENTION_CONTEXT>\n${mentionContext}\n</MENTION_CONTEXT>`
  }

  return prompt
}

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

  const parsed = ChatSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const { message, blockId, mode, conversationHistory, mentions } = parsed.data

  // RBAC: execute mode requires ops-admin
  if (mode === 'execute' && ctx.role !== 'ops-admin') {
    return apiError(
      'Execute mode requires ops-admin role',
      'auth/insufficient-role',
      403
    )
  }

  // Assemble context with user-awareness and delta injection
  const context = await assembleContext(
    blockId ?? null,
    ctx.orgId,
    ctx.userId,
    message,
    Array.from(ctx.permissions)
  )

  // Inject workflow delta context when viewing a workflow_instance
  if (context.block?.type === 'workflow_instance' && !context.deltaContext) {
    const deltaCtx = await loadDeltaContext(context.block.id, ctx.orgId)
    if (deltaCtx) context.deltaContext = deltaCtx
  }

  // Resolve @mention context if any mentions are present
  let mentionContext: string | null = null
  if (mentions && mentions.length > 0) {
    const supabase = createServerClient()
    mentionContext = await resolveMentionContext(supabase, ctx.orgId, mentions)
  }

  const contextString = contextToPromptString(context)
  const systemPrompt = buildSystemPrompt(mode, contextString, mentionContext)

  const messages: Anthropic.MessageParam[] = [
    ...conversationHistory.slice(-(MAX_HISTORY_TURNS * 2)),
    { role: 'user', content: message },
  ]

  const anthropic = new Anthropic()

  // ── Execute mode: propose actions for user approval ─────────────────
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
//
// Action Preview Pattern:
// Instead of auto-executing tool calls, execute mode now emits an `action_preview`
// SSE event containing the proposed actions (with descriptions and risk levels).
// The frontend renders these as an approval UI. When the user approves, the
// frontend calls POST /api/ai/chat/execute-actions with the approved action IDs.
// This gives the user explicit control over all mutating operations.
//

async function handleExecuteMode(
  anthropic: Anthropic,
  systemPrompt: string,
  messages: Anthropic.MessageParam[],
  orgId: string,
  _role: string,
  blockId: string | undefined,
  userMessage: string
): Promise<NextResponse> {
  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      try {
        // Single-round call: Claude returns text + optional tool_use blocks.
        // We do NOT loop or auto-execute — we preview the proposed actions.
        const response = await anthropic.messages.create({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: systemPrompt,
          messages,
          tools: CHAT_TOOLS,
        })

        // Stream any text content from Claude first
        for (const block of response.content) {
          if (block.type === 'text' && block.text) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: block.text })}\n\n`)
            )
          }
        }

        // Collect tool_use blocks (proposed actions)
        const toolUseBlocks = response.content.filter(
          (b): b is Anthropic.ContentBlock & { type: 'tool_use' } => b.type === 'tool_use'
        )

        // If Claude proposed any tool calls, emit them as action previews
        // instead of executing them. The user must approve via the
        // /api/ai/chat/execute-actions endpoint.
        if (toolUseBlocks.length > 0) {
          const previews = buildActionPreviews(
            toolUseBlocks.map((b) => ({ name: b.name, input: b.input }))
          )

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ action_preview: previews })}\n\n`
            )
          )
        }

        logger.info('ai-chat', 'ai.chat_completed', {
          org_id: orgId,
          block_id: blockId ?? null,
          message_length: userMessage.length,
          mode: 'execute',
          proposed_actions: toolUseBlocks.length,
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

  return buildSseResponse(readable)
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
      let accumulatedText = ''

      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            accumulatedText += event.delta.text
            const chunk = `data: ${JSON.stringify({ text: event.delta.text })}\n\n`
            controller.enqueue(encoder.encode(chunk))
          }
          if (event.type === 'message_delta' && event.usage) {
            totalTokens = event.usage.output_tokens
          }
        }

        // Extract structured blocks from accumulated text and emit as separate SSE events
        const suggestions = extractTagContent(accumulatedText, 'SUGGESTIONS')
        if (suggestions) {
          try {
            const parsed = JSON.parse(suggestions)
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ suggestions: parsed })}\n\n`)
            )
          } catch {
            // malformed suggestions JSON — skip silently
          }
        }

        const planJson = extractTagContent(accumulatedText, 'PLAN_JSON')
        if (planJson) {
          try {
            const parsed = JSON.parse(planJson)
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ plan_data: parsed })}\n\n`)
            )
          } catch {
            // malformed plan JSON — skip silently
          }
        }

        const modeSuggestion = extractTagContent(accumulatedText, 'MODE_SUGGESTION')
        if (modeSuggestion) {
          try {
            const parsed = JSON.parse(modeSuggestion)
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ mode_suggestion: parsed })}\n\n`)
            )
          } catch {
            // malformed mode suggestion JSON — skip silently
          }
        }

        logger.info('ai-chat', 'ai.chat_completed', {
          org_id: orgId,
          block_id: blockId ?? null,
          message_length: messageLength,
          tokens_used: totalTokens,
          mode,
          has_suggestions: !!suggestions,
          has_plan_data: !!planJson,
          has_mode_suggestion: !!modeSuggestion,
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

  return buildSseResponse(readable)
}

// ─── Shared Helpers ─────────────────────────────────────────────────────────

function buildSseResponse(readable: ReadableStream): NextResponse {
  return new NextResponse(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

/** Extract content between <TAG>...</TAG> markers. Returns null if not found. */
function extractTagContent(text: string, tag: string): string | null {
  const open = `<${tag}>`
  const close = `</${tag}>`
  const start = text.indexOf(open)
  if (start === -1) return null
  const end = text.indexOf(close, start)
  if (end === -1) return null
  return text.slice(start + open.length, end).trim()
}
