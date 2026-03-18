'use client'

import { Zap } from 'lucide-react'
import type { ActionSuggestion } from '@/lib/chat/parse-sse'

interface ActionSuggestionChipsProps {
  suggestions: ActionSuggestion[]
  onSelect: (suggestion: ActionSuggestion) => void
}

/**
 * Renders a horizontal row of interactive pill buttons for AI-suggested actions.
 * Displayed below discuss-mode messages when the AI identifies actionable next steps.
 */
export function ActionSuggestionChips({ suggestions, onSelect }: ActionSuggestionChipsProps) {
  if (suggestions.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {suggestions.map((suggestion, i) => (
        <button
          key={i}
          onClick={() => onSelect(suggestion)}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full
            bg-primary/10 text-primary hover:bg-primary/20 transition-colors
            border border-primary/20 hover:border-primary/30"
        >
          <Zap className="h-3 w-3" />
          {suggestion.label}
        </button>
      ))}
    </div>
  )
}
