import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { executeChatTool } from '@/lib/ai/chat-tools'
import { logger } from '@/lib/logger'

// ─── Request Validation ──────────────────────────────────────────────────────

const ActionSchema = z.object({
  id: z.string().min(1, 'Action id is required'),
  toolName: z.string().min(1, 'Tool name is required'),
  input: z.record(z.unknown()),
})

const ExecuteActionsSchema = z.object({
  actions: z.array(ActionSchema).min(1, 'At least one action is required'),
  conversationId: z.string().optional(),
})

// ─── Route Handler ───────────────────────────────────────────────────────────

export const POST = withAuth(async (req: NextRequest, ctx) => {
  // RBAC: execute-actions requires ops-admin (same as execute mode in chat)
  if (ctx.role !== 'ops-admin') {
    return NextResponse.json(
      {
        data: null,
        error: {
          message: 'Execute actions requires ops-admin role',
          code: 'auth/insufficient-role',
        },
      },
      { status: 403 }
    )
  }

  // Parse and validate request body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      {
        data: null,
        error: {
          message: 'Invalid JSON body',
          code: 'validation/invalid-json',
        },
      },
      { status: 400 }
    )
  }

  const parsed = ExecuteActionsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: {
          message: 'Validation failed',
          code: 'validation/invalid-input',
          details: parsed.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
      },
      { status: 400 }
    )
  }

  const { actions, conversationId } = parsed.data

  logger.info('ai-chat-execute', 'execute_actions.started', {
    org_id: ctx.orgId,
    action_count: actions.length,
    conversation_id: conversationId ?? null,
  })

  // ── SSE stream: execute each approved action sequentially ────────────────

  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      let succeeded = 0
      let failed = 0

      for (const action of actions) {
        send({ text: `Executing: ${action.toolName}...` })

        try {
          const result = await executeChatTool(
            action.toolName,
            action.input,
            ctx.orgId,
            ctx.role
          )

          send({
            tool_call: {
              id: action.id,
              name: action.toolName,
              input: action.input,
              result: { success: result.success, data: result.data, error: result.error },
            },
          })

          if (result.success) {
            succeeded++
          } else {
            failed++
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          failed++

          logger.warn('ai-chat-execute', 'execute_actions.tool_error', {
            org_id: ctx.orgId,
            tool_name: action.toolName,
            action_id: action.id,
            error: message.slice(0, 200),
          })

          send({
            tool_call: {
              id: action.id,
              name: action.toolName,
              input: action.input,
              result: { success: false, error: message },
            },
          })
        }
      }

      send({ text: 'All actions completed.' })

      logger.info('ai-chat-execute', 'execute_actions.completed', {
        org_id: ctx.orgId,
        total: actions.length,
        succeeded,
        failed,
        conversation_id: conversationId ?? null,
      })

      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
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
