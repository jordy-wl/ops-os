'use client'

import { X } from 'lucide-react'
import type { MentionResolution } from '@/lib/chat/mention-engine'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

interface MentionPillProps {
  mention: MentionResolution
  onRemove: () => void
}

// ─── Color mapping by mention kind ──────────────────────────────────────────

const KIND_STYLES: Record<MentionResolution['kind'], string> = {
  block: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  type_query: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  field_query: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  value_query: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * MentionPill — inline chip displayed in the input area after a mention is resolved.
 * Shows the mention path with type-colored background. Removable via X or Backspace.
 */
export function MentionPill({ mention, onRemove }: MentionPillProps) {
  const label = getLabel(mention)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium leading-tight',
        'max-w-[200px] shrink-0',
        KIND_STYLES[mention.kind]
      )}
      role="status"
      aria-label={`Mention: ${label}`}
    >
      <span className="truncate">@{label}</span>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onRemove()
        }}
        className={cn(
          'ml-0.5 shrink-0 rounded-sm p-0.5 transition-colors',
          'hover:bg-black/10 dark:hover:bg-white/10',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
        )}
        aria-label={`Remove mention ${label}`}
      >
        <X className="h-2.5 w-2.5" aria-hidden="true" />
      </button>
    </span>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getLabel(mention: MentionResolution): string {
  switch (mention.kind) {
    case 'block':
      return mention.blockName
    case 'type_query':
      return mention.displayName
    case 'field_query':
      return mention.displayName
    case 'value_query':
      return mention.displayName
  }
}

// ─── Pill row component ─────────────────────────────────────────────────────

interface MentionPillRowProps {
  mentions: MentionResolution[]
  onRemove: (index: number) => void
}

/**
 * MentionPillRow — renders a horizontal row of mention pills above the textarea.
 * Hidden when no mentions are present.
 */
export function MentionPillRow({ mentions, onRemove }: MentionPillRowProps) {
  if (mentions.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1 px-1 pb-1" aria-label="Active mentions">
      {mentions.map((mention, index) => (
        <MentionPill
          key={`${mention.kind}-${getMentionKey(mention)}-${index}`}
          mention={mention}
          onRemove={() => onRemove(index)}
        />
      ))}
    </div>
  )
}

function getMentionKey(mention: MentionResolution): string {
  switch (mention.kind) {
    case 'block':
      return mention.blockId
    case 'type_query':
      return mention.type
    case 'field_query':
      return `${mention.type}/${mention.field}`
    case 'value_query':
      return `${mention.type}/${mention.field}/${mention.value}`
  }
}
