'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatWidget } from './chat-widget-provider'
import type { ChatLayout } from './chat-widget-provider'
import { useChatStream } from '@/hooks/use-chat-stream'
import { ChatHeader } from './chat-header'
import { ChatMessageList } from './chat-message-list'
import { ChatInput } from './chat-input'
import { ExecuteConfirmation } from './execute-confirmation'
import { ChatHistorySidebar } from './chat-history-sidebar'
import { ModeSuggestionBanner } from './mode-suggestion-banner'

const PANEL_WIDTH_KEY = 'ops-os-chat-panel-width'

// ─── Component ───────────────────────────────────────────────────────────────

export function ChatWidget() {
  const { isOpen, mode, setMode, layout, setLayout, suggestedMode, setSuggestedMode, toggle, close, currentBlockId, pageContext } = useChatWidget()

  const handleModeSuggestion = useCallback(
    (suggestion: { suggested_mode: 'discuss' | 'plan' | 'execute'; reason: string }) => {
      setSuggestedMode(suggestion.suggested_mode)
    },
    [setSuggestedMode]
  )

  const {
    messages,
    setMessages,
    streaming,
    conversationId,
    sendMessage,
    loadConversation,
    startNewChat,
    stopGenerating,
  } = useChatStream({ mode, currentBlockId, pageContext, onModeSuggestion: handleModeSuggestion })

  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [panelWidth, setPanelWidth] = useState(() => {
    if (typeof window === 'undefined') return 420
    const saved = localStorage.getItem(PANEL_WIDTH_KEY)
    return saved ? Math.max(320, Math.min(800, Number(saved))) : 420
  })
  const [isDesktop, setIsDesktop] = useState(false)
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const lastPanelWidthRef = useRef(420)

  const isPanel = layout === 'panel'
  const isExpanded = layout === 'expanded'

  // Detect desktop viewport for panel mode inline rendering
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    setIsDesktop(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Resize handler for panel mode
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!resizeRef.current) return
      const delta = resizeRef.current.startX - e.clientX
      const maxW = Math.min(800, window.innerWidth * 0.5)
      const newWidth = Math.min(Math.max(resizeRef.current.startWidth + delta, 320), maxW)
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

  // Keyboard shortcuts: Escape to close, Cmd/Ctrl+Shift+L to cycle layout
  useEffect(() => {
    const LAYOUT_CYCLE: Record<ChatLayout, ChatLayout> = { float: 'panel', panel: 'expanded', expanded: 'float' }
    function onKeyDown(e: KeyboardEvent) {
      // Cmd/Ctrl+Shift+L → cycle layout
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'L') {
        e.preventDefault()
        setLayout(LAYOUT_CYCLE[layout])
        return
      }
      // Escape → expanded returns to float, otherwise close
      if (e.key === 'Escape' && isOpen) {
        if (isExpanded) {
          setLayout('float')
        } else {
          close()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, isExpanded, layout, close, setLayout])

  // Persist panel width to localStorage
  useEffect(() => {
    if (isPanel && isDesktop) {
      localStorage.setItem(PANEL_WIDTH_KEY, String(panelWidth))
    }
  }, [panelWidth, isPanel, isDesktop])

  const onResizeDoubleClick = () => {
    if (panelWidth <= 320) {
      setPanelWidth(lastPanelWidthRef.current)
    } else {
      lastPanelWidthRef.current = panelWidth
      setPanelWidth(320)
    }
  }

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

  function handleLoadConversation(id: string) {
    loadConversation(id, setMode)
    setShowHistory(false)
  }

  function handleNewChat() {
    startNewChat()
    setShowHistory(false)
  }

  function handleRegenerate() {
    // Find the last user message and re-send it
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
    if (!lastUserMsg) return
    // Remove the last assistant message
    setMessages((prev) => {
      const lastAssistantIdx = prev.findLastIndex((m) => m.role === 'assistant')
      if (lastAssistantIdx === -1) return prev
      return prev.filter((_, i) => i !== lastAssistantIdx)
    })
    sendMessage(lastUserMsg.content, mode)
  }

  // Action preview handlers (execute mode)
  function handleApproveAction(actionId: string, editedInput?: Record<string, unknown>) {
    // Find the action from the latest message's previews
    const lastMsg = [...messages].reverse().find((m) => m.actionPreviews?.length)
    const action = lastMsg?.actionPreviews?.find((a) => a.id === actionId)
    if (!action) return
    sendMessage(
      `Approved action: ${action.toolName}${editedInput ? ' (edited)' : ''}`,
      'execute'
    )
  }

  function handleSkipAction(_actionId: string) {
    // Skipping is handled visually in ChangePreview — no server call needed
  }

  function handleApproveAllActions() {
    const lastMsg = [...messages].reverse().find((m) => m.actionPreviews?.length)
    if (!lastMsg?.actionPreviews) return
    const names = lastMsg.actionPreviews.map((a) => a.toolName).join(', ')
    sendMessage(`Approved all actions: ${names}`, 'execute')
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
          ? cn(
              // Mobile: full-screen overlay (float fallback)
              'fixed inset-0 z-50',
              // Desktop: inline flex child in SidebarProvider layout
              'md:relative md:inset-auto md:z-auto md:h-screen md:sticky md:top-0 md:shrink-0',
              'md:border-l md:border-border md:shadow-lg',
            )
          : isExpanded
          ? 'fixed inset-0 z-50'
          : cn(
              'fixed z-50 animate-slide-up',
              'inset-0 rounded-none',
              'md:inset-auto md:bottom-5 md:right-5 md:h-[600px] md:max-h-[calc(100vh-4rem)]',
              'md:rounded-lg md:border md:border-border md:shadow-elevation-3',
            ),
        !isPanel && !isExpanded && (showHistory
          ? 'md:w-[min(700px,calc(100vw-3rem))]'
          : 'md:w-[min(480px,calc(100vw-3rem))]')
      )}
      style={isPanel && isDesktop ? { width: `${panelWidth}px` } : undefined}
    >
      {/* Resize handle (panel mode, desktop only) */}
      {isPanel && isDesktop && (
        <div
          onMouseDown={onResizeStart}
          onDoubleClick={onResizeDoubleClick}
          className={cn(
            'w-1 shrink-0 cursor-col-resize relative group',
            'before:absolute before:inset-y-0 before:-left-1.5 before:-right-1.5',
            'after:absolute after:inset-y-0 after:left-1/2 after:-translate-x-1/2 after:w-0.5',
            'after:transition-colors after:duration-150',
            'after:bg-transparent group-hover:after:bg-border group-active:after:bg-primary',
          )}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize chat panel"
        />
      )}

      {/* History sidebar */}
      <ChatHistorySidebar
        activeConversationId={conversationId}
        onSelect={handleLoadConversation}
        onNewChat={handleNewChat}
        visible={showHistory}
      />

      {/* Main chat panel */}
      <div className="flex flex-col flex-1 min-w-0">
        <ChatHeader
          mode={mode}
          onModeChange={setMode}
          layout={layout}
          onLayoutChange={setLayout}
          showHistory={showHistory}
          onToggleHistory={() => setShowHistory((v) => !v)}
          onClose={close}
        />

        <ChatMessageList
          messages={messages}
          mode={mode}
          isOpen={isOpen}
          conversationId={conversationId}
          onAcceptPlan={(plan, steps) => {
            const stepsDesc = plan.steps
              .filter((s) => steps.includes(s.index))
              .map((s) => `${s.index}. ${s.description}`)
              .join('\n')
            setMode('execute')
            handleSend(`Execute this plan: ${plan.title}\n${stepsDesc}`)
          }}
          onRejectPlan={(reason) => handleSend(`Reject this plan: ${reason}`)}
          onAddMore={(text) => handleSend(`Add to plan: ${text}`)}
          onSuggestionSelect={(label) => handleSend(label)}
          onRegenerate={handleRegenerate}
          onApproveAction={handleApproveAction}
          onSkipAction={handleSkipAction}
          onApproveAllActions={handleApproveAllActions}
        />

        {/* Stop generating button */}
        {streaming && (
          <div className="flex justify-center border-t px-3 py-2 shrink-0">
            <button
              type="button"
              onClick={stopGenerating}
              className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <span className="h-2 w-2 rounded-sm bg-current" />
              Stop generating
            </button>
          </div>
        )}

        {/* Execute mode confirmation */}
        {pendingMessage && (
          <ExecuteConfirmation onConfirm={handleExecuteConfirm} onCancel={handleExecuteCancel} />
        )}

        {/* Mode suggestion banner */}
        {suggestedMode && !streaming && (
          <ModeSuggestionBanner
            suggestedMode={suggestedMode}
            reason={`Switch to ${suggestedMode} mode`}
            onAccept={() => setMode(suggestedMode)}
            onDismiss={() => setSuggestedMode(null)}
          />
        )}

        {/* Input */}
        <ChatInput onSend={handleSend} disabled={streaming} currentMode={mode} onModeChange={setMode} />
      </div>
    </div>
  )
}
