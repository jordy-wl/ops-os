'use client'

import { useEffect, useRef } from 'react'
import { MessageBubble } from './message-bubble'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  isError?: boolean
}

interface MessageListProps {
  messages: ChatMessage[]
}

/**
 * MessageList — scrollable list of chat messages.
 * Auto-scrolls to the bottom when new messages arrive or content streams in.
 * Shows a welcome state when no messages exist yet.
 *
 * @param messages - Array of chat messages to display
 */
export function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom whenever messages change (new message or streaming update)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div
      className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
      role="log"
      aria-label="Chat messages"
      aria-live="polite"
      aria-atomic="false"
    >
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center py-12">
          <p className="text-lg font-medium text-gray-700 mb-2">Ask about your operations</p>
          <p className="text-sm text-gray-400 max-w-xs">
            Select a block above to ask about a specific client, deal, or project — or ask
            org-level questions without a block selected.
          </p>
          <p className="mt-4 text-xs text-gray-400 italic">
            Try: &quot;What&apos;s the status of Thornfield Capital?&quot;
          </p>
        </div>
      ) : (
        messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
            streaming={msg.streaming}
            isError={msg.isError}
          />
        ))
      )}
      {/* Scroll anchor */}
      <div ref={bottomRef} aria-hidden="true" />
    </div>
  )
}
