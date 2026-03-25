'use client'

import { Sparkles } from 'lucide-react'
import type { AiSuggestion } from '../wizard-types'

interface AiSuggestBarProps {
  stepId: string
  suggestions: AiSuggestion[]
  disabled?: boolean
  placeholderText?: string
}

export function AiSuggestBar({
  stepId,
  suggestions,
  disabled = true,
  placeholderText = 'AI suggestions will appear here',
}: AiSuggestBarProps) {
  // When active (future): render clickable suggestion chips
  if (!disabled && suggestions.length > 0) {
    return (
      <div
        data-step={stepId}
        className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2"
      >
        <Sparkles className="w-4 h-4 text-primary shrink-0" />
        <div className="flex items-center gap-2 flex-wrap">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={s.action}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  s.confidence === 'high'
                    ? 'bg-green-500'
                    : s.confidence === 'medium'
                      ? 'bg-amber-500'
                      : 'bg-gray-400'
                }`}
              />
              {s.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Stub mode: placeholder strip
  return (
    <div
      data-step={stepId}
      className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 opacity-50"
      title="AI suggestions coming in a future update"
    >
      <Sparkles className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground">{placeholderText}</span>
    </div>
  )
}
