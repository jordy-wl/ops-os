// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChatStream } from '@/hooks/use-chat-stream'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Create a ReadableStream that emits SSE lines one-by-one */
function createSseStream(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let index = 0
  return new ReadableStream({
    pull(controller) {
      if (index < lines.length) {
        controller.enqueue(encoder.encode(lines[index]))
        index++
      } else {
        controller.close()
      }
    },
  })
}

/** Build a mock fetch Response with a ReadableStream body */
function mockStreamResponse(lines: string[]): Response {
  return {
    ok: true,
    body: createSseStream(lines),
    headers: new Headers(),
    status: 200,
    statusText: 'OK',
  } as unknown as Response
}

// ── Mock crypto.randomUUID for deterministic IDs ─────────────────────────────

let uuidCounter = 0
function resetUuids() {
  uuidCounter = 0
}

// ── Setup ────────────────────────────────────────────────────────────────────

const mockFetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()

beforeEach(() => {
  resetUuids()
  vi.stubGlobal('fetch', mockFetch)
  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
    uuidCounter++
    return `uuid-${uuidCounter}`
  })
  mockFetch.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Default hook options ─────────────────────────────────────────────────────

const defaultOptions = {
  mode: 'discuss' as const,
  currentBlockId: null,
  pageContext: null,
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useChatStream', () => {
  // ── 1. Initial state ─────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts with empty messages, streaming false, and conversationId null', () => {
      const { result } = renderHook(() => useChatStream(defaultOptions))

      expect(result.current.messages).toEqual([])
      expect(result.current.streaming).toBe(false)
      expect(result.current.conversationId).toBeNull()
    })
  })

  // ── 2. sendMessage creates user + assistant messages ─────────────────────

  describe('sendMessage', () => {
    it('creates user and assistant messages after calling sendMessage', async () => {
      // Mock conversation creation
      mockFetch.mockImplementation(async (input) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url === '/api/conversations') {
          return {
            ok: true,
            json: () => Promise.resolve({ data: { id: 'conv-1' } }),
          } as Response
        }
        // Chat stream - return a minimal SSE stream with [DONE]
        if (url === '/api/ai/chat') {
          return mockStreamResponse([
            'data: {"text":"Hi there"}\n\n',
            'data: [DONE]\n\n',
          ])
        }
        return { ok: true, json: () => Promise.resolve({}) } as Response
      })

      const { result } = renderHook(() => useChatStream(defaultOptions))

      await act(async () => {
        await result.current.sendMessage('Hello', 'discuss')
      })

      // Should have 2 messages: user + assistant
      expect(result.current.messages).toHaveLength(2)

      const userMsg = result.current.messages[0]
      expect(userMsg.role).toBe('user')
      expect(userMsg.content).toBe('Hello')
      expect(userMsg.mode).toBe('discuss')

      const assistantMsg = result.current.messages[1]
      expect(assistantMsg.role).toBe('assistant')
      expect(assistantMsg.streaming).toBe(false)
      expect(assistantMsg.content).toBe('Hi there')
    })

    it('sets conversationId after first sendMessage', async () => {
      mockFetch.mockImplementation(async (input) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url === '/api/conversations') {
          return {
            ok: true,
            json: () => Promise.resolve({ data: { id: 'conv-abc' } }),
          } as Response
        }
        if (url === '/api/ai/chat') {
          return mockStreamResponse(['data: [DONE]\n\n'])
        }
        return { ok: true, json: () => Promise.resolve({}) } as Response
      })

      const { result } = renderHook(() => useChatStream(defaultOptions))

      expect(result.current.conversationId).toBeNull()

      await act(async () => {
        await result.current.sendMessage('test', 'discuss')
      })

      expect(result.current.conversationId).toBe('conv-abc')
    })

    it('marks assistant message as error when fetch returns non-ok response', async () => {
      mockFetch.mockImplementation(async (input) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url === '/api/conversations') {
          return {
            ok: true,
            json: () => Promise.resolve({ data: { id: 'conv-1' } }),
          } as Response
        }
        if (url === '/api/ai/chat') {
          return { ok: false, body: null, status: 500 } as Response
        }
        return { ok: true, json: () => Promise.resolve({}) } as Response
      })

      const { result } = renderHook(() => useChatStream(defaultOptions))

      await act(async () => {
        await result.current.sendMessage('test', 'discuss')
      })

      const assistantMsg = result.current.messages[1]
      expect(assistantMsg.isError).toBe(true)
      expect(assistantMsg.content).toBe('AI unavailable. Please try again.')
      expect(assistantMsg.streaming).toBe(false)
    })

    it('accumulates tool_call chunks on the assistant message', async () => {
      const toolPayload = JSON.stringify({
        tool_call: {
          name: 'search_blocks',
          input: { query: 'test' },
          result: { success: true },
        },
      })

      mockFetch.mockImplementation(async (input) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url === '/api/conversations') {
          return {
            ok: true,
            json: () => Promise.resolve({ data: { id: 'conv-1' } }),
          } as Response
        }
        if (url === '/api/ai/chat') {
          return mockStreamResponse([
            `data: ${toolPayload}\n\n`,
            'data: {"text":"Found results."}\n\n',
            'data: [DONE]\n\n',
          ])
        }
        return { ok: true, json: () => Promise.resolve({}) } as Response
      })

      const { result } = renderHook(() => useChatStream(defaultOptions))

      await act(async () => {
        await result.current.sendMessage('search for test', 'discuss')
      })

      const assistantMsg = result.current.messages[1]
      expect(assistantMsg.toolCalls).toHaveLength(1)
      expect(assistantMsg.toolCalls![0].name).toBe('search_blocks')
    })

    it('sets suggestions on the assistant message', async () => {
      const sugPayload = JSON.stringify({
        suggestions: [{ label: 'View details', action: 'navigate' }],
      })

      mockFetch.mockImplementation(async (input) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url === '/api/conversations') {
          return {
            ok: true,
            json: () => Promise.resolve({ data: { id: 'conv-1' } }),
          } as Response
        }
        if (url === '/api/ai/chat') {
          return mockStreamResponse([
            'data: {"text":"Here are some options"}\n\n',
            `data: ${sugPayload}\n\n`,
            'data: [DONE]\n\n',
          ])
        }
        return { ok: true, json: () => Promise.resolve({}) } as Response
      })

      const { result } = renderHook(() => useChatStream(defaultOptions))

      await act(async () => {
        await result.current.sendMessage('help', 'discuss')
      })

      const assistantMsg = result.current.messages[1]
      expect(assistantMsg.suggestions).toHaveLength(1)
      expect(assistantMsg.suggestions![0].label).toBe('View details')
    })

    it('sets planData on the assistant message', async () => {
      const planPayload = JSON.stringify({
        plan_data: {
          title: 'Onboarding',
          steps: [{ index: 0, description: 'Create client' }],
          prerequisites: [],
          complexity: 'low',
        },
      })

      mockFetch.mockImplementation(async (input) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url === '/api/conversations') {
          return {
            ok: true,
            json: () => Promise.resolve({ data: { id: 'conv-1' } }),
          } as Response
        }
        if (url === '/api/ai/chat') {
          return mockStreamResponse([
            'data: {"text":"Here is my plan"}\n\n',
            `data: ${planPayload}\n\n`,
            'data: [DONE]\n\n',
          ])
        }
        return { ok: true, json: () => Promise.resolve({}) } as Response
      })

      const { result } = renderHook(() => useChatStream(defaultOptions))

      await act(async () => {
        await result.current.sendMessage('plan onboarding', 'plan')
      })

      const assistantMsg = result.current.messages[1]
      expect(assistantMsg.planData).toBeDefined()
      expect(assistantMsg.planData!.title).toBe('Onboarding')
      expect(assistantMsg.planData!.steps).toHaveLength(1)
    })

    it('handles SSE error chunk mid-stream', async () => {
      mockFetch.mockImplementation(async (input) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url === '/api/conversations') {
          return {
            ok: true,
            json: () => Promise.resolve({ data: { id: 'conv-1' } }),
          } as Response
        }
        if (url === '/api/ai/chat') {
          return mockStreamResponse([
            'data: {"text":"Starting..."}\n\n',
            'data: {"error":"Rate limit exceeded"}\n\n',
          ])
        }
        return { ok: true, json: () => Promise.resolve({}) } as Response
      })

      const { result } = renderHook(() => useChatStream(defaultOptions))

      await act(async () => {
        await result.current.sendMessage('do something', 'execute')
      })

      const assistantMsg = result.current.messages[1]
      expect(assistantMsg.isError).toBe(true)
      expect(assistantMsg.content).toBe('Rate limit exceeded')
      expect(assistantMsg.streaming).toBe(false)
    })
  })

  // ── 3. stopGenerating aborts the stream ──────────────────────────────────

  describe('stopGenerating', () => {
    it('aborts the stream when called during streaming', async () => {
      let capturedSignal: AbortSignal | undefined
      let resolveStream: (() => void) | undefined

      mockFetch.mockImplementation(async (input, init) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url === '/api/conversations') {
          return {
            ok: true,
            json: () => Promise.resolve({ data: { id: 'conv-1' } }),
          } as Response
        }
        if (url === '/api/ai/chat') {
          capturedSignal = init?.signal ?? undefined
          // Stream that we can close manually
          const stream = new ReadableStream<Uint8Array>({
            start(controller) {
              // Listen for abort and close the stream
              capturedSignal?.addEventListener('abort', () => {
                try { controller.close() } catch { /* already closed */ }
              })
              resolveStream = () => controller.close()
            },
          })
          return { ok: true, body: stream } as unknown as Response
        }
        return { ok: true, json: () => Promise.resolve({}) } as Response
      })

      const { result } = renderHook(() => useChatStream(defaultOptions))

      // Start streaming (will not complete until we close the stream)
      let sendPromise: Promise<void>
      await act(async () => {
        sendPromise = result.current.sendMessage('test', 'discuss')
        // Let the conversation fetch and streaming setup resolve
        await new Promise((r) => setTimeout(r, 10))
      })

      // Abort
      act(() => {
        result.current.stopGenerating()
      })

      // The abort signal should have been triggered
      expect(capturedSignal?.aborted).toBe(true)

      // Close the stream manually in case abort didn't propagate in jsdom
      try { if (resolveStream) resolveStream() } catch { /* already closed by abort */ }

      // Wait for sendMessage to complete
      await act(async () => {
        await sendPromise!
      })

      // Streaming should be false after abort
      expect(result.current.streaming).toBe(false)
    })
  })

  // ── 4. startNewChat resets state ─────────────────────────────────────────

  describe('startNewChat', () => {
    it('resets messages and conversationId', async () => {
      mockFetch.mockImplementation(async (input) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url === '/api/conversations') {
          return {
            ok: true,
            json: () => Promise.resolve({ data: { id: 'conv-1' } }),
          } as Response
        }
        if (url === '/api/ai/chat') {
          return mockStreamResponse([
            'data: {"text":"response"}\n\n',
            'data: [DONE]\n\n',
          ])
        }
        return { ok: true, json: () => Promise.resolve({}) } as Response
      })

      const { result } = renderHook(() => useChatStream(defaultOptions))

      // Send a message first to populate state
      await act(async () => {
        await result.current.sendMessage('hello', 'discuss')
      })

      expect(result.current.messages).toHaveLength(2)
      expect(result.current.conversationId).toBe('conv-1')

      // Reset
      act(() => {
        result.current.startNewChat()
      })

      expect(result.current.messages).toEqual([])
      expect(result.current.conversationId).toBeNull()
    })
  })

  // ── 5. loadConversation fetches and sets messages ────────────────────────

  describe('loadConversation', () => {
    it('fetches conversation data and sets messages', async () => {
      const conversationData = {
        data: {
          mode: 'discuss',
          messages: [
            { id: 'msg-1', role: 'user', content: 'Hi' },
            { id: 'msg-2', role: 'assistant', content: 'Hello! How can I help?' },
          ],
        },
      }

      mockFetch.mockImplementation(async (input) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url === '/api/conversations/conv-existing') {
          return {
            ok: true,
            json: () => Promise.resolve(conversationData),
          } as Response
        }
        return { ok: true, json: () => Promise.resolve({}) } as Response
      })

      const mockSetMode = vi.fn()
      const { result } = renderHook(() => useChatStream(defaultOptions))

      await act(async () => {
        await result.current.loadConversation('conv-existing', mockSetMode)
      })

      expect(result.current.messages).toHaveLength(2)
      expect(result.current.messages[0]).toMatchObject({
        id: 'msg-1',
        role: 'user',
        content: 'Hi',
        mode: 'discuss',
      })
      expect(result.current.messages[1]).toMatchObject({
        id: 'msg-2',
        role: 'assistant',
        content: 'Hello! How can I help?',
        mode: 'discuss',
      })
      expect(result.current.conversationId).toBe('conv-existing')
      expect(mockSetMode).toHaveBeenCalledWith('discuss')
    })

    it('does not set messages when fetch returns non-ok response', async () => {
      mockFetch.mockImplementation(async () => {
        return { ok: false, status: 404 } as Response
      })

      const mockSetMode = vi.fn()
      const { result } = renderHook(() => useChatStream(defaultOptions))

      await act(async () => {
        await result.current.loadConversation('conv-missing', mockSetMode)
      })

      expect(result.current.messages).toEqual([])
      expect(result.current.conversationId).toBeNull()
      expect(mockSetMode).not.toHaveBeenCalled()
    })

    it('does not set messages when data is null', async () => {
      mockFetch.mockImplementation(async () => {
        return {
          ok: true,
          json: () => Promise.resolve({ data: null }),
        } as Response
      })

      const mockSetMode = vi.fn()
      const { result } = renderHook(() => useChatStream(defaultOptions))

      await act(async () => {
        await result.current.loadConversation('conv-empty', mockSetMode)
      })

      expect(result.current.messages).toEqual([])
      expect(mockSetMode).not.toHaveBeenCalled()
    })

    it('handles fetch failure gracefully', async () => {
      mockFetch.mockImplementation(async () => {
        throw new Error('Network error')
      })

      const mockSetMode = vi.fn()
      const { result } = renderHook(() => useChatStream(defaultOptions))

      // Should not throw
      await act(async () => {
        await result.current.loadConversation('conv-fail', mockSetMode)
      })

      expect(result.current.messages).toEqual([])
    })
  })

  // ── Edge cases ─────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('does not send when already streaming', async () => {
      let resolveStream: (() => void) | undefined

      mockFetch.mockImplementation(async (input) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url === '/api/conversations') {
          return {
            ok: true,
            json: () => Promise.resolve({ data: { id: 'conv-1' } }),
          } as Response
        }
        if (url === '/api/ai/chat') {
          // Return a stream we can close manually
          const stream = new ReadableStream<Uint8Array>({
            start(controller) {
              resolveStream = () => controller.close()
            },
          })
          return { ok: true, body: stream } as unknown as Response
        }
        return { ok: true, json: () => Promise.resolve({}) } as Response
      })

      const { result } = renderHook(() => useChatStream(defaultOptions))

      // Start first message (will hang until we close the stream)
      let sendPromise: Promise<void>
      await act(async () => {
        sendPromise = result.current.sendMessage('first', 'discuss')
        // Let the conversation fetch and streaming setup resolve
        await new Promise((r) => setTimeout(r, 10))
      })

      // Should be streaming now
      expect(result.current.streaming).toBe(true)

      // Try second message — should be ignored because streaming is true
      const chatCallsBefore = mockFetch.mock.calls.filter(
        (c) => (typeof c[0] === 'string' ? c[0] : '') === '/api/ai/chat'
      ).length

      await act(async () => {
        await result.current.sendMessage('second', 'discuss')
      })

      const chatCallsAfter = mockFetch.mock.calls.filter(
        (c) => (typeof c[0] === 'string' ? c[0] : '') === '/api/ai/chat'
      ).length

      // No additional chat call should have been made
      expect(chatCallsAfter).toBe(chatCallsBefore)

      // Cleanup: close the stream
      if (resolveStream) resolveStream()
      await act(async () => { await sendPromise! })
    })

    it('handles network error during stream', async () => {
      mockFetch.mockImplementation(async (input) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url === '/api/conversations') {
          return {
            ok: true,
            json: () => Promise.resolve({ data: { id: 'conv-1' } }),
          } as Response
        }
        if (url === '/api/ai/chat') {
          throw new TypeError('Failed to fetch')
        }
        return { ok: true, json: () => Promise.resolve({}) } as Response
      })

      const { result } = renderHook(() => useChatStream(defaultOptions))

      await act(async () => {
        await result.current.sendMessage('test', 'discuss')
      })

      const assistantMsg = result.current.messages[1]
      expect(assistantMsg.isError).toBe(true)
      expect(assistantMsg.content).toBe('Network error. Please try again.')
      expect(result.current.streaming).toBe(false)
    })
  })
})
