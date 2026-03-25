'use client'

import { useState, useMemo } from 'react'
import { GitBranch, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FormQuestion } from '@/lib/form-types'
import { evaluateBranching, LIKERT_LABELS_DEFAULT } from '@/lib/form-types'

// ─── Types ──────────────────────────────────────────────────────────────────

interface FormPreviewPanelProps {
  questions: FormQuestion[]
  formTitle: string
}

// ─── Component ──────────────────────────────────────────────────────────────

export function FormPreviewPanel({ questions, formTitle }: FormPreviewPanelProps) {
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, unknown>>({})

  const questionVisibility = useMemo(() => {
    const visibility: Record<string, boolean> = {}
    for (const q of questions) {
      if (!q.branching) {
        visibility[q.id] = true
      } else {
        visibility[q.id] = evaluateBranching(q.branching, previewAnswers)
      }
    }
    return visibility
  }, [questions, previewAnswers])

  const handleAnswer = (questionId: string, value: unknown) => {
    setPreviewAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 py-16">
        <p className="text-sm text-muted-foreground">No questions yet</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Add questions from the left panel to see a preview.
        </p>
      </div>
    )
  }

  const visibleCount = Object.values(questionVisibility).filter(Boolean).length

  return (
    <div className="max-w-2xl mx-auto">
      {/* Form header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">
          {formTitle || 'Untitled Form'}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          {visibleCount} of {questions.length} question{questions.length !== 1 ? 's' : ''} visible
        </p>
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((question) => {
          const isVisible = questionVisibility[question.id]

          if (!isVisible) {
            return (
              <div
                key={question.id}
                className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 opacity-50"
              >
                <EyeOff className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground truncate">
                  Hidden by condition: {question.label || '(untitled)'}
                </span>
                <GitBranch className="w-3 h-3 text-muted-foreground shrink-0 ml-auto" />
              </div>
            )
          }

          return (
            <PreviewQuestion
              key={question.id}
              question={question}
              value={previewAnswers[question.id]}
              onChange={(val) => handleAnswer(question.id, val)}
            />
          )
        })}
      </div>

      {/* Disabled submit button */}
      <div className="mt-8 pt-4 border-t border-border">
        <button
          type="button"
          disabled
          className="rounded-md bg-primary/50 px-6 py-2.5 text-sm font-medium text-primary-foreground cursor-not-allowed"
        >
          Submit (Preview Only)
        </button>
      </div>
    </div>
  )
}

// ─── Preview Question ───────────────────────────────────────────────────────

function PreviewQuestion({
  question,
  value,
  onChange,
}: {
  question: FormQuestion
  value: unknown
  onChange: (val: unknown) => void
}) {
  const inputBase = cn(
    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
    'focus:outline-none focus:ring-2 focus:ring-ring/50'
  )

  const labelEl = (
    <label className="block text-sm font-medium text-foreground mb-1.5">
      {question.label || '(untitled)'}
      {question.required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  )

  const descriptionEl = question.description ? (
    <p className="text-xs text-muted-foreground mb-2">{question.description}</p>
  ) : null

  const wrapper = (children: React.ReactNode) => (
    <div className="rounded-lg border border-border bg-card p-4">
      {labelEl}
      {descriptionEl}
      {children}
      {question.branching && (
        <div className="flex items-center gap-1 mt-2">
          <GitBranch className="w-3 h-3 text-primary/50" />
          <span className="text-[10px] text-primary/50">Conditional</span>
        </div>
      )}
    </div>
  )

  switch (question.type) {
    case 'text':
      return wrapper(
        <input
          type="text"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || undefined)}
          maxLength={question.max_length}
          placeholder="Short answer..."
          className={inputBase}
        />
      )

    case 'textarea':
      return wrapper(
        <textarea
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || undefined)}
          maxLength={question.max_length}
          rows={3}
          placeholder="Long answer..."
          className={cn(inputBase, 'resize-y')}
        />
      )

    case 'number':
      return wrapper(
        <input
          type="number"
          value={value != null ? String(value) : ''}
          onChange={(e) =>
            onChange(e.target.value ? Number(e.target.value) : undefined)
          }
          placeholder="0"
          className={inputBase}
        />
      )

    case 'select':
      return wrapper(
        <select
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={inputBase}
        >
          <option value="">Select an option...</option>
          {(question.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )

    case 'multi_select':
      return wrapper(
        <MultiSelectPreview
          options={question.options ?? []}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange}
        />
      )

    case 'scale':
      return wrapper(
        <ScalePreview
          min={question.scale_min ?? 1}
          max={question.scale_max ?? 5}
          scaleLabels={question.scale_labels}
          value={typeof value === 'number' ? value : null}
          onChange={onChange}
        />
      )

    case 'likert':
      return wrapper(
        <LikertPreview
          labels={
            Array.isArray(question.scale_labels)
              ? question.scale_labels
              : LIKERT_LABELS_DEFAULT
          }
          value={typeof value === 'string' ? value : null}
          onChange={onChange}
        />
      )

    case 'emoji':
      return wrapper(
        <EmojiPreview
          value={typeof value === 'string' ? value : null}
          onChange={onChange}
        />
      )

    case 'date':
      return wrapper(
        <input
          type="date"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={inputBase}
        />
      )

    case 'url':
      return wrapper(
        <input
          type="url"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || undefined)}
          placeholder="https://..."
          className={inputBase}
        />
      )

    case 'file_upload':
      return wrapper(
        <div className="flex items-center gap-2">
          <input
            type="file"
            disabled
            className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-medium"
          />
          <span className="text-[10px] text-muted-foreground">(disabled in preview)</span>
        </div>
      )

    case 'yes_no':
      return wrapper(
        <div className="flex gap-2">
          {['yes', 'no'].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={cn(
                'flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                value === opt
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-background hover:bg-muted text-foreground'
              )}
            >
              {opt === 'yes' ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      )

    default:
      return wrapper(
        <input
          type="text"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || undefined)}
          placeholder={`(${question.type})`}
          className={inputBase}
        />
      )
  }
}

// ─── Multi Select Preview ───────────────────────────────────────────────────

function MultiSelectPreview({
  options,
  value,
  onChange,
}: {
  options: string[]
  value: string[]
  onChange: (val: unknown) => void
}) {
  const toggle = (opt: string) => {
    if (value.includes(opt)) {
      const next = value.filter((v) => v !== opt)
      onChange(next.length > 0 ? next : undefined)
    } else {
      onChange([...value, opt])
    }
  }

  return (
    <div className="space-y-1.5">
      {options.map((opt) => (
        <label
          key={opt}
          className="flex items-center gap-2.5 rounded-md px-2 py-1.5 cursor-pointer hover:bg-muted/30 transition-colors"
        >
          <input
            type="checkbox"
            checked={value.includes(opt)}
            onChange={() => toggle(opt)}
            className="rounded border-input w-4 h-4"
          />
          <span className="text-sm text-foreground">{opt}</span>
        </label>
      ))}
      {options.length === 0 && (
        <p className="text-xs text-muted-foreground italic">No options defined</p>
      )}
    </div>
  )
}

// ─── Scale Preview ──────────────────────────────────────────────────────────

function ScalePreview({
  min,
  max,
  scaleLabels,
  value,
  onChange,
}: {
  min: number
  max: number
  scaleLabels: FormQuestion['scale_labels']
  value: number | null
  onChange: (val: unknown) => void
}) {
  const count = Math.min(Math.max(max - min + 1, 2), 11)
  const numbers = Array.from({ length: count }, (_, i) => min + i)

  const minLabel =
    typeof scaleLabels === 'object' && !Array.isArray(scaleLabels)
      ? scaleLabels?.min
      : undefined
  const maxLabel =
    typeof scaleLabels === 'object' && !Array.isArray(scaleLabels)
      ? scaleLabels?.max
      : undefined

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {numbers.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              'w-9 h-9 rounded-md border text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              value === n
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-background hover:bg-muted text-foreground'
            )}
          >
            {n}
          </button>
        ))}
      </div>
      {(minLabel || maxLabel) && (
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] text-muted-foreground">{minLabel}</span>
          <span className="text-[10px] text-muted-foreground">{maxLabel}</span>
        </div>
      )}
    </div>
  )
}

// ─── Likert Preview ─────────────────────────────────────────────────────────

function LikertPreview({
  labels,
  value,
  onChange,
}: {
  labels: string[]
  value: string | null
  onChange: (val: unknown) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {labels.map((label) => (
        <button
          key={label}
          type="button"
          onClick={() => onChange(label)}
          className={cn(
            'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === label
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-input bg-background hover:bg-muted text-foreground'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ─── Emoji Preview ──────────────────────────────────────────────────────────

const EMOJI_OPTIONS = [
  { value: '1', emoji: '\uD83D\uDE1E', label: 'Very Bad' },
  { value: '2', emoji: '\uD83D\uDE41', label: 'Bad' },
  { value: '3', emoji: '\uD83D\uDE10', label: 'Neutral' },
  { value: '4', emoji: '\uD83D\uDE42', label: 'Good' },
  { value: '5', emoji: '\uD83D\uDE04', label: 'Great' },
]

function EmojiPreview({
  value,
  onChange,
}: {
  value: string | null
  onChange: (val: unknown) => void
}) {
  return (
    <div className="flex gap-2 justify-center">
      {EMOJI_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          title={opt.label}
          aria-label={opt.label}
          className={cn(
            'flex flex-col items-center gap-1 rounded-lg border px-3 py-2 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === opt.value
              ? 'border-primary bg-primary/10 scale-110'
              : 'border-input bg-background hover:bg-muted'
          )}
        >
          <span className="text-2xl" role="img" aria-hidden="true">
            {opt.emoji}
          </span>
          <span className="text-[9px] text-muted-foreground">{opt.label}</span>
        </button>
      ))}
    </div>
  )
}
