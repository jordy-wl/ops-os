import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { AuthContext } from '@/lib/auth/withAuth'

vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: vi.fn(
    (handler: (req: NextRequest, ctx: AuthContext, params: Record<string, string>) => Promise<Response>) =>
      async (req: NextRequest, context: { params: Promise<Record<string, string>> }) => {
        const params = await context.params
        return handler(
          req,
          { userId: 'user_111', clerkOrgId: 'org_abc', orgId: 'uuid-org-1', role: 'ops-admin' },
          params
        )
      }
  ),
}))

vi.mock('@/lib/context-assembly', () => ({
  assembleContext: vi.fn().mockResolvedValue({
    block: { id: 'block-1', name: 'Acme Ltd', type: 'client', metadata: {} },
    events: [],
    neighbours: [],
    org: { id: 'uuid-org-1', name: 'Thornfield Capital' },
    userRole: 'member',
  }),
  contextToPromptString: vi.fn().mockReturnValue('[CONTEXT]\nOrg: Thornfield Capital\n[END CONTEXT]'),
}))

vi.mock('@anthropic-ai/sdk', () => {
  const mockStream = {
    [Symbol.asyncIterator]: async function* () {
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } }
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world' } }
      yield { type: 'message_delta', usage: { output_tokens: 2 } }
    },
  }

  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        stream: vi.fn().mockReturnValue(mockStream),
      },
    })),
  }
})

import { assembleContext } from '@/lib/context-assembly'
import Anthropic from '@anthropic-ai/sdk'

const { POST: chatEndpoint } = await import('@/app/api/ai/chat/route')

const makeReq = (body: object) =>
  new NextRequest('http://localhost/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify(body),
  })

describe('POST /api/ai/chat', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns SSE stream with correct Content-Type', async () => {
    const res = await chatEndpoint(makeReq({ message: 'What is the status?' }), { params: Promise.resolve({}) })

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/event-stream')
  })

  it('calls assembleContext with blockId and message (query) when provided', async () => {
    await chatEndpoint(
      makeReq({
        message: 'Summarise this block',
        blockId: '00000000-0000-0000-0000-000000000001',
      }),
      { params: Promise.resolve({}) }
    )

    expect(assembleContext).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
      'uuid-org-1',
      'user_111',
      'Summarise this block'
    )
  })

  it('calls assembleContext with null blockId and message when no blockId provided', async () => {
    await chatEndpoint(makeReq({ message: 'What happened today?' }), { params: Promise.resolve({}) })

    expect(assembleContext).toHaveBeenCalledWith(null, 'uuid-org-1', 'user_111', 'What happened today?')
  })

  it('passes conversationHistory to Claude messages', async () => {
    await chatEndpoint(
      makeReq({
        message: 'Follow-up question',
        conversationHistory: [
          { role: 'user', content: 'Previous question' },
          { role: 'assistant', content: 'Previous answer' },
        ],
      }),
      { params: Promise.resolve({}) }
    )

    const anthropicInstance = vi.mocked(Anthropic).mock.results[0].value
    const streamCall = anthropicInstance.messages.stream.mock.calls[0][0]
    expect(streamCall.messages).toHaveLength(3) // 2 history + 1 new
    expect(streamCall.messages[2]).toEqual({ role: 'user', content: 'Follow-up question' })
  })

  it('uses claude-sonnet-4-6 model with max_tokens 1000', async () => {
    await chatEndpoint(makeReq({ message: 'Test message' }), { params: Promise.resolve({}) })

    const anthropicInstance = vi.mocked(Anthropic).mock.results[0].value
    const streamCall = anthropicInstance.messages.stream.mock.calls[0][0]
    expect(streamCall.model).toBe('claude-sonnet-4-6')
    expect(streamCall.max_tokens).toBe(1000)
  })

  it('returns 400 when message is missing', async () => {
    const res = await chatEndpoint(makeReq({ blockId: '00000000-0000-0000-0000-000000000001' }), { params: Promise.resolve({}) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('validation/invalid-input')
  })

  it('returns 400 when blockId is not a valid UUID', async () => {
    const res = await chatEndpoint(makeReq({ message: 'Test', blockId: 'not-a-uuid' }), { params: Promise.resolve({}) })
    expect(res.status).toBe(400)
  })

  it('streams text chunks as SSE events', async () => {
    const res = await chatEndpoint(makeReq({ message: 'Hello' }), { params: Promise.resolve({}) })

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let text = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      text += decoder.decode(value)
    }

    expect(text).toContain('"text":"Hello"')
    expect(text).toContain('"text":" world"')
    expect(text).toContain('[DONE]')
  })
})
