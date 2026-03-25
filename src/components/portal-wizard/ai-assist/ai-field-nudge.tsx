'use client'

import { Sparkles } from 'lucide-react'

interface AiFieldNudgeProps {
  fieldKey: string
  hint?: string
  disabled?: boolean
}

export function AiFieldNudge({
  fieldKey,
  hint,
  disabled = true,
}: AiFieldNudgeProps) {
  if (disabled || !hint) {
    return (
      <span
        data-field={fieldKey}
        className="inline-flex opacity-40"
        title="AI field hints coming soon"
      >
        <Sparkles className="w-3 h-3 text-muted-foreground" />
      </span>
    )
  }

  return (
    <span
      data-field={fieldKey}
      className="inline-flex"
      title={hint}
    >
      <Sparkles className="w-3 h-3 text-primary" />
    </span>
  )
}
