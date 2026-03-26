'use client'

import { useEffect, useRef } from 'react'
import { MessageCircle, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PlanMessage } from './plan-message'
import { MessageBubble } from './message-bubble'
import { BlockCreationPreview, extractBlockCreationData } from './block-creation-preview'
import { ActionNavigation } from './action-navigation'
import { ActionSuggestionChips } from './action-suggestion-chips'
import { ResponseActions } from './response-actions'
import { ChangePreview } from './change-preview'
import { useChatWidget } from './chat-widget-provider'
import type { WidgetMessage } from '@/hooks/use-chat-stream'
import type { ChatMode } from './chat-widget-provider'
import type { PlanData } from '@/lib/chat/parse-sse'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatMessageListProps {
  messages: WidgetMessage[]
  mode: ChatMode
  isOpen: boolean
  conversationId: string | null
  onAcceptPlan: (plan: PlanData, steps: number[]) => void
  onRejectPlan: (reason: string) => void
  onAddMore: (text: string) => void
  onSuggestionSelect: (label: string) => void
  onRegenerate: () => void
  onApproveAction: (actionId: string, editedInput?: Record<string, unknown>) => void
  onSkipAction: (actionId: string) => void
  onApproveAllActions: () => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ChatMessageList({
  messages,
  mode,
  isOpen,
  conversationId,
  onAcceptPlan,
  onRejectPlan,
  onAddMore,
  onSuggestionSelect,
  onRegenerate,
  onApproveAction,
  onSkipAction,
  onApproveAllActions,
}: ChatMessageListProps) {
  const { trustedToolTypes, trustToolType } = useChatWidget()
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll on new messages
  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isOpen])

  return (
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
          <div key={msg.id} className={msg.role === 'assistant' ? 'group' : undefined}>
            {/* Plan mode: structured rendering for assistant messages */}
            {msg.role === 'assistant' && msg.mode === 'plan' && !msg.isError && !msg.streaming && msg.content ? (
              <div className="bg-background border border-border rounded-2xl rounded-bl-sm px-4 py-2.5 max-w-[85%]">
                <PlanMessage
                  content={msg.content}
                  planData={msg.planData}
                  onAccept={(plan, steps) => onAcceptPlan(plan, steps)}
                  onReject={(reason) => onRejectPlan(reason)}
                  onAddMore={(text) => onAddMore(text)}
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

            {/* Response actions (completed assistant messages only) */}
            {msg.role === 'assistant' && !msg.streaming && !msg.isError && msg.content && (
              <ResponseActions
                content={msg.content}
                conversationId={conversationId}
                messageId={msg.id}
                onRegenerate={onRegenerate}
              />
            )}

            {/* Action suggestion chips (discuss mode) */}
            {msg.role === 'assistant' && msg.suggestions && msg.suggestions.length > 0 && !msg.streaming && (
              <ActionSuggestionChips
                suggestions={msg.suggestions}
                onSelect={(suggestion) => onSuggestionSelect(suggestion.label)}
              />
            )}

            {/* Action preview cards (execute mode) */}
            {msg.actionPreviews && msg.actionPreviews.length > 0 && !msg.streaming && (
              <div className="mt-2">
                <ChangePreview
                  actions={msg.actionPreviews}
                  onApprove={onApproveAction}
                  onSkip={onSkipAction}
                  onApproveAll={onApproveAllActions}
                  trustedToolTypes={trustedToolTypes}
                  onTrustToolType={trustToolType}
                />
              </div>
            )}

            {/* Tool call indicators */}
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div className="mt-1.5 space-y-1.5">
                {msg.toolCalls.map((tc, i) => {
                  const creationData = extractBlockCreationData(tc)
                  if (creationData) {
                    return (
                      <div key={i}>
                        <BlockCreationPreview {...creationData} />
                        <ActionNavigation toolCall={tc} className="ml-1" />
                      </div>
                    )
                  }
                  return (
                    <div key={i}>
                      <div
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
                      <ActionNavigation toolCall={tc} className="ml-1" />
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
  )
}
