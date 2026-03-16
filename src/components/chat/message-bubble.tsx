import { cn } from '@/lib/utils'

export type MessageRole = 'user' | 'assistant'

interface MessageBubbleProps {
  role: MessageRole
  content: string
  streaming?: boolean
  isError?: boolean
}

/**
 * MessageBubble — renders a single chat message.
 * User messages right-aligned in gray. Assistant messages left-aligned in white.
 * Streaming assistant messages show a blinking cursor while content arrives.
 * Error messages shown in red tint.
 *
 * @param role      - 'user' or 'assistant'
 * @param content   - The message text
 * @param streaming - True while SSE stream is in progress (shows cursor)
 * @param isError   - True if this message represents an error state
 */
export function MessageBubble({ role, content, streaming, isError }: MessageBubbleProps) {
  const isUser = role === 'user'

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-relaxed',
          isUser
            ? 'bg-muted text-foreground'
            : isError
              ? 'bg-destructive/5 text-destructive border border-destructive/20'
              : 'bg-card border border-border text-foreground'
        )}
      >
        {content.length === 0 && streaming ? (
          // Empty streaming bubble — show typing indicator
          <span aria-label="AI is typing" className="flex gap-1 items-center py-0.5">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce"
                style={{ animationDelay: `${delay}ms` }}
                aria-hidden="true"
              />
            ))}
          </span>
        ) : (
          <span className="whitespace-pre-wrap break-words">
            {content}
            {streaming && (
              <span
                className="inline-block w-0.5 h-3.5 bg-gray-400 dark:bg-gray-500 ml-0.5 align-middle animate-pulse"
                aria-hidden="true"
              />
            )}
          </span>
        )}
      </div>
    </div>
  )
}
