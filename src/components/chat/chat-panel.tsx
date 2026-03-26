'use client'

import { useCallback, useState } from 'react'
import { MessageList, type ChatMessage } from './message-list'
import { ChatInput } from './chat-input'
import { BlockContextPicker } from './block-context-picker'
import { parseSseChunk } from '@/lib/chat/parse-sse'
import type { ChatMode } from './chat-widget-provider'
import type { Block } from '@/lib/context-assembly'

interface ChatPanelProps {
  blocks: Block[]
  /** 'full-page' fills the viewport height; 'sidebar' uses a compact layout */
  mode?: 'full-page' | 'sidebar'
}

const MAX_HISTORY = 20

/**
 * ChatPanel — main chat component managing all state and streaming logic.
 *
 * Handles:
 *   - Message history (capped at MAX_HISTORY, in-memory only — not persisted)
 *   - SSE streaming from POST /api/ai/chat
 *   - Block context selection (passed as blockId on every request)
 *   - Error states (HTTP error + mid-stream error)
 *
 * Conversation history is sent with each request so the server can pass it
 * to Claude (the chat route is stateless).
 *
 * @param blocks - All org blocks for the BlockContextPicker (pre-fetched by server)
 * @param mode   - Layout mode: 'full-page' (default) or 'sidebar'
 */
export function ChatPanel({ blocks, mode = 'full-page' }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [chatMode, setChatMode] = useState<ChatMode>('discuss')

  const selectedBlock = selectedBlockId
    ? blocks.find((b) => b.id === selectedBlockId) ?? null
    : null

  const send = useCallback(
    async (userText: string, _mentions?: unknown) => {
      if (streaming) return

      const userId = crypto.randomUUID()
      const assistantId = crypto.randomUUID()

      // Snapshot history before adding new messages (used for the API request)
      const historySnapshot: Array<{ role: 'user' | 'assistant'; content: string }> = messages
        .filter((m) => !m.streaming && !m.isError)
        .map((m) => ({ role: m.role, content: m.content }))
        .slice(-MAX_HISTORY)

      setMessages((prev) => [
        ...prev,
        { id: userId, role: 'user', content: userText },
        { id: assistantId, role: 'assistant', content: '', streaming: true },
      ])
      setStreaming(true)

      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userText,
            blockId: selectedBlockId ?? undefined,
            conversationHistory: historySnapshot,
          }),
        })

        // HTTP-level error (e.g. 503 AI unavailable, 401, 500)
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

        // Read SSE stream
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
            } else if (chunk.type === 'done') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, streaming: false } : m
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
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: 'Network error. Please try again.', streaming: false, isError: true }
              : m
          )
        )
      } finally {
        setStreaming(false)
      }
    },
    [streaming, messages, selectedBlockId]
  )

  const heightClass = mode === 'full-page' ? 'h-[calc(100vh-3.5rem)]' : 'h-[600px]'

  return (
    <div className={`flex flex-col ${heightClass} bg-muted`}>
      {/* Chat header — context picker + selected block name */}
      <div className="flex items-center gap-3 border-b bg-background px-4 py-2.5 flex-wrap">
        <BlockContextPicker
          blocks={blocks}
          selectedId={selectedBlockId}
          onChange={setSelectedBlockId}
        />
        {selectedBlock && (
          <p className="text-sm font-medium text-foreground truncate" aria-live="polite">
            Asking about: <span className="text-foreground">{selectedBlock.name}</span>
          </p>
        )}
      </div>

      {/* Message list — fills remaining height */}
      <MessageList messages={messages} />

      {/* Input */}
      <ChatInput onSend={send} disabled={streaming} currentMode={chatMode} onModeChange={setChatMode} />
    </div>
  )
}
