'use client'

import { Settings2, X, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { FormQuestion } from '@/lib/form-types'
import { LIKERT_LABELS_DEFAULT } from '@/lib/form-types'
import { BranchingEditor } from './branching-editor'

// ─── Types ──────────────────────────────────────────────────────────────────

interface QuestionConfigPanelProps {
  question: FormQuestion
  allQuestions: FormQuestion[]
  onChange: (updates: Partial<FormQuestion>) => void
}

// ─── Component ──────────────────────────────────────────────────────────────

export function QuestionConfigPanel({
  question,
  allQuestions,
  onChange,
}: QuestionConfigPanelProps) {
  const previousQuestions = allQuestions.filter((q) => q.order < question.order)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 px-1">
        <Settings2 className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">
          Question Settings
        </h3>
      </div>

      {/* ─── Common Fields ──────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <label
            htmlFor="q-label"
            className="block text-xs font-medium text-muted-foreground mb-1"
          >
            Label
          </label>
          <Input
            id="q-label"
            type="text"
            value={question.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Enter question text..."
          />
        </div>

        <div>
          <label
            htmlFor="q-description"
            className="block text-xs font-medium text-muted-foreground mb-1"
          >
            Description
            <span className="text-muted-foreground/60 font-normal ml-1">(optional)</span>
          </label>
          <textarea
            id="q-description"
            value={question.description ?? ''}
            onChange={(e) =>
              onChange({ description: e.target.value || undefined })
            }
            placeholder="Add a help text for respondents..."
            rows={2}
            className={cn(
              'w-full rounded-md border border-input bg-transparent px-3 py-2 text-[13px]',
              'placeholder:text-muted-foreground resize-y',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background'
            )}
          />
        </div>

        <div className="flex items-center justify-between">
          <label
            htmlFor="q-required"
            className="text-xs font-medium text-muted-foreground"
          >
            Required
          </label>
          <button
            id="q-required"
            type="button"
            role="switch"
            aria-checked={question.required}
            onClick={() => onChange({ required: !question.required })}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full',
              'border-2 border-transparent shadow-sm transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              question.required ? 'bg-primary' : 'bg-input'
            )}
          >
            <span
              className={cn(
                'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform',
                question.required ? 'translate-x-4' : 'translate-x-0'
              )}
            />
          </button>
        </div>
      </section>

      {/* ─── Type-Specific Fields ────────────────────────────────────── */}
      <TypeSpecificFields question={question} onChange={onChange} />

      {/* ─── Branching Section ───────────────────────────────────────── */}
      <section>
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Conditional Logic
        </p>
        <BranchingEditor
          branching={question.branching}
          previousQuestions={previousQuestions}
          onChange={(branching) => onChange({ branching })}
        />
      </section>
    </div>
  )
}

// ─── Empty State ────────────────────────────────────────────────────────────

export function QuestionConfigEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12">
      <Settings2 className="w-8 h-8 text-muted-foreground/30 mb-3" />
      <p className="text-sm font-medium text-muted-foreground">
        Select a question to configure it
      </p>
      <p className="text-xs text-muted-foreground/70 mt-1">
        Click on any question in the list to view and edit its settings.
      </p>
    </div>
  )
}

// ─── Type-Specific Fields ───────────────────────────────────────────────────

function TypeSpecificFields({
  question,
  onChange,
}: {
  question: FormQuestion
  onChange: (updates: Partial<FormQuestion>) => void
}) {
  switch (question.type) {
    case 'select':
    case 'multi_select':
      return (
        <section>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Options
          </p>
          <OptionsEditor
            options={question.options ?? []}
            onChange={(opts) => onChange({ options: opts })}
          />
        </section>
      )

    case 'text':
    case 'textarea':
      return (
        <section>
          <label
            htmlFor="q-maxlen"
            className="block text-xs font-medium text-muted-foreground mb-1"
          >
            Max Length
            <span className="text-muted-foreground/60 font-normal ml-1">(optional)</span>
          </label>
          <Input
            id="q-maxlen"
            type="number"
            value={question.max_length ?? ''}
            onChange={(e) =>
              onChange({
                max_length: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            placeholder="No limit"
            min={1}
          />
        </section>
      )

    case 'scale':
      return <ScaleConfig question={question} onChange={onChange} />

    case 'likert':
      return <LikertConfig question={question} onChange={onChange} />

    default:
      return null
  }
}

// ─── Options Editor ─────────────────────────────────────────────────────────

function OptionsEditor({
  options,
  onChange,
}: {
  options: string[]
  onChange: (opts: string[]) => void
}) {
  return (
    <div className="space-y-1.5">
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground/60 tabular-nums w-4 text-center shrink-0">
            {i + 1}
          </span>
          <Input
            type="text"
            value={opt}
            onChange={(e) => {
              const updated = [...options]
              updated[i] = e.target.value
              onChange(updated)
            }}
            placeholder={`Option ${i + 1}`}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => onChange(options.filter((_, idx) => idx !== i))}
            aria-label={`Remove option ${i + 1}`}
            className="text-muted-foreground hover:text-destructive shrink-0"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...options, ''])}
        className="w-full mt-1"
      >
        <Plus className="w-3 h-3 mr-1" />
        Add Option
      </Button>
    </div>
  )
}

// ─── Scale Config ───────────────────────────────────────────────────────────

function ScaleConfig({
  question,
  onChange,
}: {
  question: FormQuestion
  onChange: (updates: Partial<FormQuestion>) => void
}) {
  const scaleLabels =
    typeof question.scale_labels === 'object' && !Array.isArray(question.scale_labels)
      ? (question.scale_labels as { min: string; max: string })
      : { min: '', max: '' }

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label
            htmlFor="q-scale-min"
            className="block text-xs font-medium text-muted-foreground mb-1"
          >
            Min Value
          </label>
          <Input
            id="q-scale-min"
            type="number"
            value={question.scale_min ?? 1}
            onChange={(e) =>
              onChange({ scale_min: Number(e.target.value) || 1 })
            }
          />
        </div>
        <div>
          <label
            htmlFor="q-scale-max"
            className="block text-xs font-medium text-muted-foreground mb-1"
          >
            Max Value
          </label>
          <Input
            id="q-scale-max"
            type="number"
            value={question.scale_max ?? 5}
            onChange={(e) =>
              onChange({ scale_max: Number(e.target.value) || 5 })
            }
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label
            htmlFor="q-scale-label-min"
            className="block text-xs font-medium text-muted-foreground mb-1"
          >
            Min Label
          </label>
          <Input
            id="q-scale-label-min"
            type="text"
            value={scaleLabels.min}
            onChange={(e) =>
              onChange({
                scale_labels: { ...scaleLabels, min: e.target.value },
              })
            }
            placeholder="e.g. Not likely"
          />
        </div>
        <div>
          <label
            htmlFor="q-scale-label-max"
            className="block text-xs font-medium text-muted-foreground mb-1"
          >
            Max Label
          </label>
          <Input
            id="q-scale-label-max"
            type="text"
            value={scaleLabels.max}
            onChange={(e) =>
              onChange({
                scale_labels: { ...scaleLabels, max: e.target.value },
              })
            }
            placeholder="e.g. Very likely"
          />
        </div>
      </div>
    </section>
  )
}

// ─── Likert Config ──────────────────────────────────────────────────────────

function LikertConfig({
  question,
  onChange,
}: {
  question: FormQuestion
  onChange: (updates: Partial<FormQuestion>) => void
}) {
  const labels = Array.isArray(question.scale_labels)
    ? question.scale_labels
    : [...LIKERT_LABELS_DEFAULT]

  return (
    <section>
      <p className="text-xs font-medium text-muted-foreground mb-2">
        Scale Labels (5 points)
      </p>
      <div className="space-y-1.5">
        {labels.map((label, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground/60 tabular-nums w-4 text-center shrink-0">
              {i + 1}
            </span>
            <Input
              type="text"
              value={label}
              onChange={(e) => {
                const updated = [...labels]
                updated[i] = e.target.value
                onChange({ scale_labels: updated })
              }}
              placeholder={LIKERT_LABELS_DEFAULT[i]}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
