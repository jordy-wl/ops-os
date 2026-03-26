'use client'

import { useState } from 'react'
import { Check, Copy, RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ResponseActionsProps {
  content: string
  conversationId: string | null
  messageId: string
  onRegenerate: () => void
}

/**
 * ResponseActions — action bar below completed assistant messages.
 *
 * Actions: Copy (clipboard), Regenerate (re-send last user message),
 * Thumbs up/down (stores feedback via POST /api/conversations/{id}/feedback).
 * Visible on hover (desktop) or always visible (mobile).
 */
export function ResponseActions({
  content,
  conversationId,
  messageId,
  onRegenerate,
}: ResponseActionsProps) {
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API not available
    }
  }

  async function handleFeedback(rating: 'up' | 'down') {
    if (feedback === rating) return // Already submitted
    setFeedback(rating)

    if (!conversationId) return
    try {
      await fetch(`/api/conversations/${conversationId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, messageId }),
      })
    } catch {
      // Non-critical — visual feedback already shown
    }
  }

  return (
    <div className="flex items-center gap-0.5 mt-1 ml-8 opacity-0 group-hover:opacity-100 md:transition-opacity md:duration-150 max-md:opacity-100">
      <ActionButton
        icon={copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        label={copied ? 'Copied' : 'Copy'}
        onClick={handleCopy}
        active={copied}
      />
      <ActionButton
        icon={<RefreshCw className="h-3 w-3" />}
        label="Regenerate"
        onClick={onRegenerate}
      />
      <ActionButton
        icon={<ThumbsUp className="h-3 w-3" />}
        label="Good response"
        onClick={() => handleFeedback('up')}
        active={feedback === 'up'}
      />
      <ActionButton
        icon={<ThumbsDown className="h-3 w-3" />}
        label="Bad response"
        onClick={() => handleFeedback('down')}
        active={feedback === 'down'}
      />
    </div>
  )
}

function ActionButton({
  icon,
  label,
  onClick,
  active,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-6 w-6 items-center justify-center rounded-md transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'text-primary bg-primary/10'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      )}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  )
}
