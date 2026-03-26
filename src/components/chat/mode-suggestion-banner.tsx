'use client'

import { ArrowRight, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChatMode } from './chat-widget-provider'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ModeSuggestionBannerProps {
  suggestedMode: ChatMode
  reason: string
  onAccept: () => void
  onDismiss: () => void
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MODE_LABELS: Record<ChatMode, string> = {
  discuss: 'Discuss',
  plan: 'Plan',
  execute: 'Execute',
}

/**
 * Mode-specific color schemes.
 * Each mode maps to a set of Tailwind classes for background, hover, text,
 * and the "Switch to" button styling.
 */
const MODE_STYLES: Record<ChatMode, {
  banner: string
  bannerHover: string
  text: string
  button: string
  buttonHover: string
  icon: string
}> = {
  discuss: {
    banner: 'bg-blue-50 dark:bg-blue-950/40',
    bannerHover: 'hover:bg-blue-100 dark:hover:bg-blue-950/60',
    text: 'text-blue-800 dark:text-blue-200',
    button: 'bg-blue-600 text-white',
    buttonHover: 'hover:bg-blue-700',
    icon: 'text-blue-600 dark:text-blue-400',
  },
  plan: {
    banner: 'bg-amber-50 dark:bg-amber-950/40',
    bannerHover: 'hover:bg-amber-100 dark:hover:bg-amber-950/60',
    text: 'text-amber-800 dark:text-amber-200',
    button: 'bg-amber-600 text-white',
    buttonHover: 'hover:bg-amber-700',
    icon: 'text-amber-600 dark:text-amber-400',
  },
  execute: {
    banner: 'bg-green-50 dark:bg-green-950/40',
    bannerHover: 'hover:bg-green-100 dark:hover:bg-green-950/60',
    text: 'text-green-800 dark:text-green-200',
    button: 'bg-green-600 text-white',
    buttonHover: 'hover:bg-green-700',
    icon: 'text-green-600 dark:text-green-400',
  },
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * ModeSuggestionBanner -- a thin colored banner that appears above the chat
 * input area when the AI suggests switching to a different chat mode.
 *
 * The parent controls visibility; this component has no internal state.
 * Render it conditionally when `suggestedMode` is non-null.
 *
 * @param suggestedMode - The mode the AI suggests switching to
 * @param reason        - Short explanation of why the mode switch is suggested
 * @param onAccept      - Called when the user clicks "Switch to [Mode]"
 * @param onDismiss     - Called when the user clicks the dismiss X button
 */
export function ModeSuggestionBanner({
  suggestedMode,
  reason,
  onAccept,
  onDismiss,
}: ModeSuggestionBannerProps) {
  const styles = MODE_STYLES[suggestedMode]
  const label = MODE_LABELS[suggestedMode]

  return (
    <div
      className={cn(
        'flex h-9 items-center gap-2 px-3 transition-colors',
        'animate-in fade-in slide-in-from-top duration-200',
        styles.banner,
        styles.bannerHover
      )}
      role="status"
      aria-label={`AI suggests switching to ${label} mode: ${reason}`}
    >
      {/* Left side: icon + reason text */}
      <Sparkles
        className={cn('h-3.5 w-3.5 shrink-0', styles.icon)}
        aria-hidden="true"
      />
      <span
        className={cn('min-w-0 flex-1 truncate text-xs font-medium', styles.text)}
        title={reason}
      >
        {reason}
      </span>

      {/* Right side: switch button + dismiss */}
      <button
        type="button"
        onClick={onAccept}
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          styles.button,
          styles.buttonHover
        )}
      >
        Switch to {label}
        <ArrowRight className="h-3 w-3" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss mode suggestion"
        className={cn(
          'shrink-0 rounded p-0.5 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          styles.text,
          'hover:bg-black/10 dark:hover:bg-white/10'
        )}
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}
