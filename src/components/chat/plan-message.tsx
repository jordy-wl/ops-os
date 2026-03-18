'use client'

import { useState } from 'react'
import { Check, X, Plus } from 'lucide-react'
import type { PlanData } from '@/lib/chat/parse-sse'

interface PlanMessageProps {
  content: string
  planData?: PlanData | null
  onAccept?: (plan: PlanData, acceptedSteps: number[]) => void
  onReject?: (reason: string) => void
  onAddMore?: (text: string) => void
}

/**
 * PlanMessage — renders plan-mode structured output with numbered steps.
 * When planData is available, shows interactive accept/reject/modify buttons.
 * Falls back to text-only rendering when no structured data is present.
 */
export function PlanMessage({ content, planData, onAccept, onReject, onAddMore }: PlanMessageProps) {
  const [accepted, setAccepted] = useState<boolean | null>(null)
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(
    () => new Set(planData?.steps.map((s) => s.index) ?? [])
  )
  const [rejectMode, setRejectMode] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [addMoreMode, setAddMoreMode] = useState(false)
  const [addMoreText, setAddMoreText] = useState('')

  // Strip structured tags from visible content
  const visibleContent = content
    .replace(/<PLAN_JSON>[\s\S]*?<\/PLAN_JSON>/g, '')
    .trim()

  // Parse text content into sections
  const lines = visibleContent.split('\n')
  const sections: Array<{ type: 'text' | 'step'; content: string; number?: number }> = []
  let currentText: string[] = []

  for (const line of lines) {
    const stepMatch = line.match(/^(\d+)\.\s+(.+)/)
    if (stepMatch) {
      if (currentText.length > 0) {
        sections.push({ type: 'text', content: currentText.join('\n') })
        currentText = []
      }
      sections.push({ type: 'step', content: stepMatch[2], number: parseInt(stepMatch[1]) })
    } else {
      currentText.push(line)
    }
  }
  if (currentText.length > 0) {
    sections.push({ type: 'text', content: currentText.join('\n') })
  }

  const hasSteps = sections.some((s) => s.type === 'step')
  const hasInteractiveData = !!planData && !!onAccept

  const toggleStep = (index: number) => {
    setCheckedSteps((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const handleAccept = () => {
    if (planData && onAccept) {
      setAccepted(true)
      onAccept(planData, Array.from(checkedSteps))
    }
  }

  const handleReject = () => {
    if (rejectReason.trim() && onReject) {
      setAccepted(false)
      onReject(rejectReason.trim())
      setRejectMode(false)
    }
  }

  const handleAddMore = () => {
    if (addMoreText.trim() && onAddMore) {
      onAddMore(addMoreText.trim())
      setAddMoreMode(false)
      setAddMoreText('')
    }
  }

  // Plain text fallback
  if (!hasSteps) {
    return <p className="text-sm text-foreground whitespace-pre-wrap">{visibleContent}</p>
  }

  return (
    <div className="space-y-2">
      {sections.map((section, i) => {
        if (section.type === 'text') {
          const trimmed = section.content.trim()
          if (!trimmed) return null
          const boldMatch = trimmed.match(/^\*\*(.+?)\*\*$/)
          if (boldMatch) {
            return (
              <p key={i} className="text-sm font-semibold text-foreground">
                {boldMatch[1]}
              </p>
            )
          }
          return (
            <p key={i} className="text-sm text-foreground whitespace-pre-wrap">
              {trimmed}
            </p>
          )
        }

        const stepNum = section.number ?? 0
        const isChecked = checkedSteps.has(stepNum)

        return (
          <div key={i} className="flex gap-2.5 items-start">
            {hasInteractiveData && accepted === null ? (
              <button
                onClick={() => toggleStep(stepNum)}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs transition-colors ${
                  isChecked
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-muted-foreground/30 hover:border-primary/50'
                }`}
              >
                {isChecked && <Check className="h-3 w-3" />}
              </button>
            ) : (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                {section.number}
              </span>
            )}
            <p className="text-sm text-foreground pt-0.5">{section.content}</p>
          </div>
        )
      })}

      {/* Action bar — only when plan data is available and not yet acted on */}
      {hasInteractiveData && accepted === null && (
        <div className="flex flex-wrap gap-2 pt-3 border-t border-border/50 mt-3">
          <button
            onClick={handleAccept}
            disabled={checkedSteps.size === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
              bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Check className="h-3.5 w-3.5" />
            Accept Plan
          </button>
          <button
            onClick={() => setRejectMode(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
              bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Reject
          </button>
          <button
            onClick={() => setAddMoreMode(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
              bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add More
          </button>
        </div>
      )}

      {/* Reject reason input */}
      {rejectMode && (
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection..."
            className="flex-1 text-xs border rounded-md px-2 py-1.5 bg-background"
            onKeyDown={(e) => e.key === 'Enter' && handleReject()}
            autoFocus
          />
          <button
            onClick={handleReject}
            disabled={!rejectReason.trim()}
            className="text-xs px-2 py-1.5 rounded-md bg-destructive text-destructive-foreground disabled:opacity-50"
          >
            Send
          </button>
        </div>
      )}

      {/* Add more input */}
      {addMoreMode && (
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={addMoreText}
            onChange={(e) => setAddMoreText(e.target.value)}
            placeholder="Add to plan..."
            className="flex-1 text-xs border rounded-md px-2 py-1.5 bg-background"
            onKeyDown={(e) => e.key === 'Enter' && handleAddMore()}
            autoFocus
          />
          <button
            onClick={handleAddMore}
            disabled={!addMoreText.trim()}
            className="text-xs px-2 py-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
          >
            Send
          </button>
        </div>
      )}

      {/* Status badge after action */}
      {accepted === true && (
        <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium mt-2">
          <Check className="h-3.5 w-3.5" />
          Plan accepted — switching to Execute mode
        </div>
      )}
      {accepted === false && (
        <div className="flex items-center gap-1.5 text-xs text-destructive font-medium mt-2">
          <X className="h-3.5 w-3.5" />
          Plan rejected
        </div>
      )}
    </div>
  )
}
