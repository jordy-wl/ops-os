'use client'

import { useCallback, useRef, useState } from 'react'
import { parseSseChunk, stripStructuredTags } from '@/lib/chat/parse-sse'
import type { ChatMode } from '@/components/chat/chat-widget-provider'
import type { ToolCallChunk, ActionSuggestion, PlanData, ActionPreview, ModeSuggestion } from '@/lib/chat/parse-sse'
import type { MentionResolution } from '@/lib/chat/mention-engine'

// ─── Types ───────────────────────────────────────────────────────────────────

export type WidgetMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  isError?: boolean
  mode?: ChatMode
  toolCalls?: ToolCallChunk[]
  suggestions?: ActionSuggestion[]
  planData?: PlanData | null
  actionPreviews?: ActionPreview[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_HISTORY = 20

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Generate a short title from the first user message */
function generateTitle(text: string): string {
  const cleaned = text.replace(/\n/g, ' ').trim()
  return cleaned.length > 60 ? cleaned.slice(0, 57) + '...' : cleaned
}

/** Persist messages to conversation (fire-and-forget) */
async function saveMessages(
  conversationId: string,
  userContent: string,
  assistantContent: string
) {
  try {
    await fetch(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: userContent },
          { role: 'assistant', content: assistantContent },
        ],
      }),
    })
  } catch {
    // non-critical — messages still visible in current session
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

interface UseChatStreamOptions {
  mode: ChatMode
  currentBlockId: string | null
  pageContext: unknown | null
  onModeSuggestion?: (suggestion: ModeSuggestion) => void
}

export function useChatStream({ mode, currentBlockId, pageContext, onModeSuggestion }: UseChatStreamOptions) {
  const [messages, setMessages] = useState<WidgetMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  /** Create a new conversation in the DB */
  const createConversation = useCallback(async (title: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          mode,
          page_context: pageContext ?? {},
        }),
      })
      if (!res.ok) return null
      const { data } = await res.json()
      return data?.id ?? null
    } catch {
      return null
    }
  }, [mode, pageContext])

  /** Load a conversation from history */
  const loadConversation = useCallback(async (id: string, setMode: (m: ChatMode) => void) => {
    try {
      const res = await fetch(`/api/conversations/${id}`)
      if (!res.ok) return
      const { data } = await res.json()
      if (!data) return

      const loaded: WidgetMessage[] = (data.messages ?? []).map((m: { id: string; role: string; content: string }) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        mode: data.mode,
      }))

      setMessages(loaded)
      setConversationId(id)
      if (data.mode) setMode(data.mode)
    } catch {
      // non-critical
    }
  }, [])

  /** Start a fresh conversation */
  const startNewChat = useCallback(() => {
    setMessages([])
    setConversationId(null)
  }, [])

  /** Stop generating (abort in-flight stream) */
  const stopGenerating = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }, [])

  /** Send a message and stream the response */
  const sendMessage = useCallback(
    async (text: string, sendMode: ChatMode, mentions?: MentionResolution[]) => {
      if (streaming) return

      const userId = crypto.randomUUID()
      const assistantId = crypto.randomUUID()

      // Create conversation on first message
      let activeConvId = conversationId
      if (!activeConvId) {
        activeConvId = await createConversation(generateTitle(text))
        if (activeConvId) setConversationId(activeConvId)
      }

      const historySnapshot = messages
        .filter((m) => !m.streaming && !m.isError)
        .map((m) => ({ role: m.role, content: m.content }))
        .slice(-MAX_HISTORY)

      setMessages((prev) => [
        ...prev,
        { id: userId, role: 'user', content: text, mode: sendMode },
        { id: assistantId, role: 'assistant', content: '', streaming: true, mode: sendMode, toolCalls: [] },
      ])
      setStreaming(true)

      let finalContent = ''
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            mode: sendMode,
            blockId: currentBlockId ?? undefined,
            conversationHistory: historySnapshot,
            mentions: mentions && mentions.length > 0 ? mentions : undefined,
          }),
          signal: controller.signal,
        })

        if (!res.ok || !res.body) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: 'AI unavailable. Please try again.', streaming: false, isError: true }
                : m
            )
          )
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let accumulated = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const raw = decoder.decode(value, { stream: true })
          const chunks = parseSseChunk(raw)

          for (const chunk of chunks) {
            if (chunk.type === 'text') {
              accumulated += chunk.text
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: accumulated } : m
                )
              )
            } else if (chunk.type === 'tool_call') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, toolCalls: [...(m.toolCalls ?? []), chunk.tool_call] }
                    : m
                )
              )
            } else if (chunk.type === 'suggestions') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, suggestions: chunk.suggestions }
                    : m
                )
              )
            } else if (chunk.type === 'plan_data') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, planData: chunk.plan_data }
                    : m
                )
              )
            } else if (chunk.type === 'action_preview') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, actionPreviews: [...(m.actionPreviews ?? []), ...chunk.actions] }
                    : m
                )
              )
            } else if (chunk.type === 'mode_suggestion') {
              onModeSuggestion?.(chunk.mode_suggestion)
            } else if (chunk.type === 'done') {
              finalContent = stripStructuredTags(accumulated)
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: finalContent!, streaming: false }
                    : m
                )
              )
            } else if (chunk.type === 'error') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: chunk.message, streaming: false, isError: true }
                    : m
                )
              )
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // User stopped generation — mark message as complete with current content
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId && m.streaming
                ? { ...m, streaming: false }
                : m
            )
          )
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: 'Network error. Please try again.', streaming: false, isError: true }
                : m
            )
          )
        }
      } finally {
        setStreaming(false)
        abortRef.current = null
        // Auto-save messages to DB
        if (activeConvId && finalContent) {
          saveMessages(activeConvId, text, finalContent)
        }
      }
    },
    [streaming, messages, conversationId, createConversation, currentBlockId, onModeSuggestion]
  )

  return {
    messages,
    setMessages,
    streaming,
    conversationId,
    sendMessage,
    loadConversation,
    startNewChat,
    stopGenerating,
  }
}
