'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageCircle, X, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatWidget } from './chat-widget-provider'
import { ModeSelector } from './mode-selector'
import { ChatInput } from './chat-input'
import { PlanMessage } from './plan-message'
import { ExecuteConfirmation } from './execute-confirmation'
import { MessageBubble } from './message-bubble'
import { BlockCreationPreview, extractBlockCreationData } from './block-creation-preview'
import { parseSseChunk } from '@/lib/chat/parse-sse'
import type { ChatMode } from './chat-widget-provider'
import type { ToolCallChunk } from '@/lib/chat/parse-sse'

// ─── Types ───────────────────────────────────────────────────────────────────

type WidgetMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  isError?: boolean
  mode?: ChatMode
  toolCalls?: ToolCallChunk[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_HISTORY = 20

// ─── Component ───────────────────────────────────────────────────────────────

export function ChatWidget() {
  const { isOpen, mode, setMode, toggle, close, currentBlockId } = useChatWidget()
  const [messages, setMessages] = useState<WidgetMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll on new messages
  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isOpen])

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, close])

  const sendMessage = useCallback(
    async (text: string, sendMode: ChatMode) => {
      if (streaming) return

      const userId = crypto.randomUUID()
      const assistantId = crypto.randomUUID()

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

      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            mode: sendMode,
            blockId: currentBlockId ?? undefined,
            conversationHistory: historySnapshot,
          }),
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
    [streaming, messages]
  )

  function handleSend(text: string) {
    if (mode === 'execute') {
      setPendingMessage(text)
    } else {
      sendMessage(text, mode)
    }
  }

  function handleExecuteConfirm() {
    if (pendingMessage) {
      sendMessage(pendingMessage, 'execute')
      setPendingMessage(null)
    }
  }

  function handleExecuteCancel() {
    setPendingMessage(null)
  }

  // ── Collapsed state: floating button ────────────────────────────────
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={toggle}
        className={cn(
          'fixed bottom-5 right-5 z-50',
          'flex h-12 w-12 items-center justify-center rounded-full',
          'bg-gray-900 text-white shadow-lg dark:bg-gray-100 dark:text-gray-900',
          'hover:bg-gray-700 dark:hover:bg-gray-300 transition-all hover:scale-105',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 dark:focus-visible:ring-gray-100 focus-visible:ring-offset-2'
        )}
        aria-label="Open chat"
      >
        <MessageCircle className="h-5 w-5" />
      </button>
    )
  }

  // ── Expanded state: widget card ─────────────────────────────────────
  return (
    <div
      className={cn(
        'fixed bottom-5 right-5 z-50',
        'flex flex-col w-[min(480px,calc(100vw-3rem))] h-[600px] max-h-[calc(100vh-4rem)]',
        'rounded-xl border border-border bg-background shadow-2xl',
        'animate-slide-up'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2 shrink-0">
        <ModeSelector mode={mode} onModeChange={setMode} />
        <button
          type="button"
          onClick={close}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-muted"
        role="log"
        aria-label="Chat messages"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <MessageCircle className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-muted-foreground mb-1">How can I help?</p>
            <p className="text-xs text-muted-foreground max-w-[280px]">
              {mode === 'discuss' && 'Ask questions about your blocks, workflows, and events.'}
              {mode === 'plan' && 'Describe what you want to achieve and I\'ll create a step-by-step plan.'}
              {mode === 'execute' && 'Tell me what to do and I\'ll take action in the system.'}
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id}>
              {/* Plan mode: structured rendering for assistant messages */}
              {msg.role === 'assistant' && msg.mode === 'plan' && !msg.isError && !msg.streaming && msg.content ? (
                <div className="bg-background border border-border rounded-2xl rounded-bl-sm px-4 py-2.5 max-w-[85%]">
                  <PlanMessage content={msg.content} />
                </div>
              ) : (
                <MessageBubble
                  role={msg.role}
                  content={msg.content}
                  streaming={msg.streaming}
                  isError={msg.isError}
                />
              )}

              {/* Tool call indicators */}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mt-1.5 space-y-1.5">
                  {msg.toolCalls.map((tc, i) => {
                    const creationData = extractBlockCreationData(tc)
                    if (creationData) {
                      return <BlockCreationPreview key={i} {...creationData} />
                    }
                    return (
                      <div
                        key={i}
                        className={cn(
                          'flex items-center gap-1.5 text-xs rounded-md px-2.5 py-1 max-w-[85%]',
                          tc.result.success
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        )}
                      >
                        <Wrench className="h-3 w-3 shrink-0" />
                        <span className="font-medium">{tc.name}</span>
                        <span className="text-muted-foreground">—</span>
                        <span className="truncate">
                          {tc.result.success
                            ? JSON.stringify(tc.result.data).slice(0, 60)
                            : tc.result.error}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} aria-hidden="true" />
      </div>

      {/* Execute mode confirmation */}
      {pendingMessage && (
        <ExecuteConfirmation onConfirm={handleExecuteConfirm} onCancel={handleExecuteCancel} />
      )}

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={streaming} />
    </div>
  )
}
