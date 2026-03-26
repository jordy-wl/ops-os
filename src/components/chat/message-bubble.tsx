import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MarkdownRenderer } from './markdown-renderer'

export type MessageRole = 'user' | 'assistant'

interface MessageBubbleProps {
  role: MessageRole
  content: string
  streaming?: boolean
  isError?: boolean
}

/**
 * MessageBubble — renders a single chat message with asymmetric layout.
 *
 * User messages: right-aligned, compact, plain text, muted bg, max-w-[75%].
 * Assistant messages: left-aligned, full-width, markdown-rendered, card bg, AI sparkle avatar.
 * Streaming: shimmer skeleton (empty) → markdown + blinking cursor (with content).
 * Hover: shows relative timestamp.
 */
export function MessageBubble({ role, content, streaming, isError }: MessageBubbleProps) {
  const isUser = role === 'user'
  const [showTimestamp, setShowTimestamp] = useState(false)
  const [createdAt] = useState(() => new Date())

  if (isUser) {
    return (
      <div
        className="flex justify-end gap-2"
        onMouseEnter={() => setShowTimestamp(true)}
        onMouseLeave={() => setShowTimestamp(false)}
      >
        <div className="flex flex-col items-end gap-0.5 min-w-0">
          <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-primary/10 text-foreground px-3.5 py-2 text-[13px] leading-relaxed">
            <span className="whitespace-pre-wrap break-words">{content}</span>
          </div>
          {showTimestamp && (
            <span className="text-[10px] text-muted-foreground px-1 animate-in fade-in duration-150">
              {formatRelativeTime(createdAt)}
            </span>
          )}
        </div>
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground mt-1">
          U
        </div>
      </div>
    )
  }

  // Assistant message
  return (
    <div
      className="flex gap-2"
      onMouseEnter={() => setShowTimestamp(true)}
      onMouseLeave={() => setShowTimestamp(false)}
    >
      <div className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full mt-1',
        isError ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
      )}>
        <Sparkles className="h-3 w-3" />
      </div>
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <div
          className={cn(
            'rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-[13px] leading-relaxed',
            isError
              ? 'bg-destructive/5 text-destructive border border-destructive/20'
              : 'bg-card border border-border text-foreground'
          )}
        >
          {content.length === 0 && streaming ? (
            <StreamingSkeleton />
          ) : (
            <>
              {isError ? (
                <span className="whitespace-pre-wrap break-words">{content}</span>
              ) : (
                <MarkdownRenderer content={content} streaming={streaming} />
              )}
              {streaming && content.length > 0 && (
                <span
                  className="inline-block w-0.5 h-3.5 bg-primary/40 ml-0.5 align-middle animate-pulse"
                  aria-hidden="true"
                />
              )}
            </>
          )}
        </div>
        {showTimestamp && !streaming && (
          <span className="text-[10px] text-muted-foreground px-1 animate-in fade-in duration-150">
            {formatRelativeTime(createdAt)}
          </span>
        )}
      </div>
    </div>
  )
}

/** Shimmer skeleton shown while assistant message is empty + streaming */
function StreamingSkeleton() {
  return (
    <div aria-label="AI is typing" className="flex flex-col gap-1.5 py-0.5">
      <div className="h-2.5 w-3/4 rounded-full bg-muted animate-pulse" />
      <div className="h-2.5 w-1/2 rounded-full bg-muted animate-pulse" style={{ animationDelay: '150ms' }} />
      <div className="h-2.5 w-2/3 rounded-full bg-muted animate-pulse" style={{ animationDelay: '300ms' }} />
    </div>
  )
}

/** Format relative time (e.g., "just now", "2m ago") */
function formatRelativeTime(date: Date): string {
  const now = Date.now()
  const diff = now - date.getTime()
  const seconds = Math.floor(diff / 1000)

  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
