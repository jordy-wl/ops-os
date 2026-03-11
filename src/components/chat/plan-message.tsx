'use client'

/**
 * PlanMessage — renders plan-mode structured output with numbered steps.
 * Detects numbered list patterns in markdown-like text and renders them
 * as a clean step list.
 */
export function PlanMessage({ content }: { content: string }) {
  // Split content by numbered lines (1. Step, 2. Step, etc.)
  const lines = content.split('\n')
  const sections: Array<{ type: 'text' | 'step'; content: string; number?: number }> = []
  let currentText: string[] = []

  for (const line of lines) {
    const stepMatch = line.match(/^(\d+)\.\s+(.+)/)
    if (stepMatch) {
      // Flush accumulated text
      if (currentText.length > 0) {
        sections.push({ type: 'text', content: currentText.join('\n') })
        currentText = []
      }
      sections.push({ type: 'step', content: stepMatch[2], number: parseInt(stepMatch[1]) })
    } else {
      currentText.push(line)
    }
  }

  // Flush remaining text
  if (currentText.length > 0) {
    sections.push({ type: 'text', content: currentText.join('\n') })
  }

  // If no steps detected, render as plain text
  const hasSteps = sections.some((s) => s.type === 'step')
  if (!hasSteps) {
    return <p className="text-sm text-gray-700 whitespace-pre-wrap">{content}</p>
  }

  return (
    <div className="space-y-2">
      {sections.map((section, i) => {
        if (section.type === 'text') {
          const trimmed = section.content.trim()
          if (!trimmed) return null
          // Detect bold titles like **Plan: Title**
          const boldMatch = trimmed.match(/^\*\*(.+?)\*\*$/)
          if (boldMatch) {
            return (
              <p key={i} className="text-sm font-semibold text-gray-900">
                {boldMatch[1]}
              </p>
            )
          }
          return (
            <p key={i} className="text-sm text-gray-700 whitespace-pre-wrap">
              {trimmed}
            </p>
          )
        }
        return (
          <div key={i} className="flex gap-2.5 items-start">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
              {section.number}
            </span>
            <p className="text-sm text-gray-700 pt-0.5">{section.content}</p>
          </div>
        )
      })}
    </div>
  )
}
