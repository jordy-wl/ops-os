'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageCircle, X, Wrench, History, PanelRightOpen, PanelRightClose } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatWidget } from './chat-widget-provider'
import { ModeSelector } from './mode-selector'
import { ChatInput } from './chat-input'
import { PlanMessage } from './plan-message'
import { ExecuteConfirmation } from './execute-confirmation'
import { MessageBubble } from './message-bubble'
import { BlockCreationPreview, extractBlockCreationData } from './block-creation-preview'
import { ChatHistorySidebar } from './chat-history-sidebar'
import { parseSseChunk, stripStructuredTags } from '@/lib/chat/parse-sse'
import { ActionSuggestionChips } from './action-suggestion-chips'
import type { ChatMode } from './chat-widget-provider'
import type { ToolCallChunk, ActionSuggestion, PlanData } from '@/lib/chat/parse-sse'

// ─── Types ───────────────────────────────────────────────────────────────────

type WidgetMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  isError?: boolean
  mode?: ChatMode
  toolCalls?: ToolCallChunk[]
  suggestions?: ActionSuggestion[]
  planData?: PlanData | null
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

// ─── Component ───────────────────────────────────────────────────────────────

export function ChatWidget() {
  const { isOpen, mode, setMode, layout, setLayout, toggle, close, currentBlockId, pageContext } = useChatWidget()
  const [messages, setMessages] = useState<WidgetMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [panelWidth, setPanelWidth] = useState(420)
  const bottomRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null)

  const isPanel = layout === 'panel'

  // Resize handler for panel mode
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!resizeRef.current) return
      const delta = resizeRef.current.startX - e.clientX
      const newWidth = Math.min(Math.max(resizeRef.current.startWidth + delta, 320), 600)
      setPanelWidth(newWidth)
    }
    function onMouseUp() {
      resizeRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

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
  const loadConversation = useCallback(async (id: string) => {
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
      setShowHistory(false)
    } catch {
      // non-critical
    }
  }, [setMode])

  /** Start a fresh conversation */
  const startNewChat = useCallback(() => {
    setMessages([])
    setConversationId(null)
    setShowHistory(false)
  }, [])

  const sendMessage = useCallback(
    async (text: string, sendMode: ChatMode) => {
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
            } else if (chunk.type === 'done') {
              // Strip structured tags from final visible content
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
        // Auto-save messages to DB
        if (activeConvId && finalContent) {
          saveMessages(activeConvId, text, finalContent)
        }
      }
    },
    [streaming, messages, conversationId, createConversation, currentBlockId]
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
          'fixed z-50 bottom-16 right-4 md:bottom-4',
          'flex h-12 w-12 items-center justify-center rounded-full',
          'bg-primary text-primary-foreground shadow-lg',
          'hover:bg-primary/90 hover:scale-105 active:scale-95',
          'transition-all duration-200',
          'focus-ring'
        )}
        aria-label="Open chat"
      >
        <MessageCircle className="h-5 w-5" />
        {messages.length > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold ring-2 ring-background">
            {messages.length > 9 ? '9+' : messages.length}
          </span>
        )}
      </button>
    )
  }

  // ── Expanded state ─────────────────────────────────────────────────
  const onResizeStart = (e: React.MouseEvent) => {
    resizeRef.current = { startX: e.clientX, startWidth: panelWidth }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  return (
    <div
      className={cn(
        'flex bg-background',
        isPanel
          ? 'fixed top-0 right-0 z-40 h-full border-l border-border shadow-lg'
          : cn(
              'fixed z-50 animate-slide-up',
              'inset-0 rounded-none',
              'md:inset-auto md:bottom-5 md:right-5 md:h-[600px] md:max-h-[calc(100vh-4rem)]',
              'md:rounded-lg md:border md:border-border md:shadow-elevation-3',
            ),
        !isPanel && (showHistory
          ? 'md:w-[min(700px,calc(100vw-3rem))]'
          : 'md:w-[min(480px,calc(100vw-3rem))]')
      )}
      style={isPanel ? { width: `${panelWidth}px` } : undefined}
    >
      {/* Resize handle (panel mode only) */}
      {isPanel && (
        <div
          onMouseDown={onResizeStart}
          className="w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors shrink-0"
        />
      )}

      {/* History sidebar */}
      <ChatHistorySidebar
        activeConversationId={conversationId}
        onSelect={loadConversation}
        onNewChat={startNewChat}
        visible={showHistory}
      />

      {/* Main chat panel */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2 shrink-0">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                showHistory
                  ? 'text-foreground bg-muted'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
              aria-label="Toggle chat history"
            >
              <History className="h-4 w-4" />
            </button>
            <ModeSelector mode={mode} onModeChange={setMode} />
          </div>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setLayout(isPanel ? 'float' : 'panel')}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={isPanel ? 'Switch to floating mode' : 'Switch to panel mode'}
            >
              {isPanel ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={close}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-muted/50"
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
                    <PlanMessage
                      content={msg.content}
                      planData={msg.planData}
                      onAccept={(plan, steps) => {
                        const stepsDesc = plan.steps
                          .filter((s) => steps.includes(s.index))
                          .map((s) => `${s.index}. ${s.description}`)
                          .join('\n')
                        setMode('execute')
                        handleSend(`Execute this plan: ${plan.title}\n${stepsDesc}`)
                      }}
                      onReject={(reason) => {
                        handleSend(`Reject this plan: ${reason}`)
                      }}
                      onAddMore={(text) => {
                        handleSend(`Add to plan: ${text}`)
                      }}
                    />
                  </div>
                ) : (
                  <MessageBubble
                    role={msg.role}
                    content={msg.content}
                    streaming={msg.streaming}
                    isError={msg.isError}
                  />
                )}

                {/* Action suggestion chips (discuss mode) */}
                {msg.role === 'assistant' && msg.suggestions && msg.suggestions.length > 0 && !msg.streaming && (
                  <ActionSuggestionChips
                    suggestions={msg.suggestions}
                    onSelect={(suggestion) => {
                      handleSend(suggestion.label)
                    }}
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
                              ? 'bg-success/5 text-success border border-success/20'
                              : 'bg-destructive/5 text-destructive border border-destructive/20'
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
    </div>
  )
}
