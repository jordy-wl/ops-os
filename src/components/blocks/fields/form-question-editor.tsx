'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  GripVertical,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Eye,
  Pencil,
  ArrowUp,
  ArrowDown,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { FieldComponentProps } from './field-props'
import {
  type FormQuestion,
  type BranchingConfig,
  QUESTION_TYPES,
  BRANCHING_OPERATORS,
  LIKERT_LABELS_DEFAULT,
  evaluateBranching,
} from '@/lib/form-types'

// ─── Main Editor ────────────────────────────────────────────────────────────

export function FormQuestionEditor({ name, value, onChange, mode }: FieldComponentProps) {
  const questions: FormQuestion[] = Array.isArray(value) ? (value as FormQuestion[]) : []
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [previewMode, setPreviewMode] = useState(false)
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, unknown>>({})

  const addQuestion = useCallback(() => {
    const newQ: FormQuestion = {
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'text',
      label: '',
      required: false,
      order: questions.length,
    }
    const updated = [...questions, newQ]
    onChange(updated)
    setExpandedIds((prev) => new Set(prev).add(newQ.id))
  }, [questions, onChange])

  const updateQuestion = useCallback(
    (questionId: string, updates: Partial<FormQuestion>) => {
      onChange(questions.map((q) => (q.id === questionId ? { ...q, ...updates } : q)))
    },
    [questions, onChange]
  )

  const deleteQuestion = useCallback(
    (questionId: string) => {
      // Remove the question and re-index order
      let updated = questions
        .filter((q) => q.id !== questionId)
        .map((q, i) => ({ ...q, order: i }))

      // Also remove branching refs to the deleted question
      updated = updated.map((q) => {
        if (q.branching?.condition_field === questionId) {
          return { ...q, branching: undefined }
        }
        return q
      })

      onChange(updated)
    },
    [questions, onChange]
  )

  const moveQuestion = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (toIndex < 0 || toIndex >= questions.length) return
      const updated = [...questions]
      const [moved] = updated.splice(fromIndex, 1)
      updated.splice(toIndex, 0, moved)
      onChange(updated.map((q, i) => ({ ...q, order: i })))
    },
    [questions, onChange]
  )

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // ─── View mode ──────────────────────────────────────────────────────────
  if (mode === 'view') {
    return (
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-1 capitalize">
          {name.replace(/_/g, ' ')}
        </p>
        <p className="text-sm text-foreground">
          {questions.length} question{questions.length !== 1 ? 's' : ''}
        </p>
      </div>
    )
  }

  // ─── Preview mode ───────────────────────────────────────────────────────
  if (previewMode) {
    const visibleQuestions = questions.filter((q) => {
      if (!q.branching) return true
      return evaluateBranching(q.branching, previewAnswers)
    })

    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-foreground">
            Preview ({visibleQuestions.length} visible)
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPreviewMode(false)
              setPreviewAnswers({})
            }}
          >
            <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
          </Button>
        </div>
        <div className="space-y-3">
          {visibleQuestions.map((q) => (
            <PreviewQuestionField
              key={q.id}
              question={q}
              value={previewAnswers[q.id]}
              onChange={(val) =>
                setPreviewAnswers((prev) => ({ ...prev, [q.id]: val }))
              }
            />
          ))}
          {visibleQuestions.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              No questions to preview. Add some questions first.
            </p>
          )}
        </div>
      </div>
    )
  }

  // ─── Edit mode ──────────────────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className="block text-sm font-medium text-muted-foreground capitalize">
          {name.replace(/_/g, ' ')} ({questions.length})
        </label>
        <Button variant="outline" size="sm" onClick={() => setPreviewMode(true)}>
          <Eye className="w-3.5 h-3.5 mr-1" /> Preview
        </Button>
      </div>

      <div className="space-y-2">
        {questions.map((question, index) => (
          <QuestionCard
            key={question.id}
            question={question}
            index={index}
            totalQuestions={questions.length}
            expanded={expandedIds.has(question.id)}
            onToggleExpand={() => toggleExpand(question.id)}
            onUpdate={(updates) => updateQuestion(question.id, updates)}
            onDelete={() => deleteQuestion(question.id)}
            onMoveUp={() => moveQuestion(index, index - 1)}
            onMoveDown={() => moveQuestion(index, index + 1)}
            allQuestions={questions}
          />
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={addQuestion} className="mt-3 w-full">
        <Plus className="w-3.5 h-3.5 mr-1" /> Add Question
      </Button>
    </div>
  )
}

// ─── Question Card ──────────────────────────────────────────────────────────

interface QuestionCardProps {
  question: FormQuestion
  index: number
  totalQuestions: number
  expanded: boolean
  onToggleExpand: () => void
  onUpdate: (updates: Partial<FormQuestion>) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  allQuestions: FormQuestion[]
}

function QuestionCard({
  question,
  index,
  totalQuestions,
  expanded,
  onToggleExpand,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  allQuestions,
}: QuestionCardProps) {
  const typeLabel = QUESTION_TYPES.find((t) => t.value === question.type)?.label ?? question.type

  const inputClass =
    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Collapsed header */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
      >
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        )}
        <span className="text-xs font-medium text-muted-foreground shrink-0">
          Q{index + 1}
        </span>
        <span className="text-sm text-foreground truncate flex-1">
          {question.label || '(untitled)'}
        </span>
        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground shrink-0">
          {typeLabel}
        </span>
        {question.required && (
          <span className="text-[10px] text-destructive shrink-0">Required</span>
        )}
        {question.branching && (
          <span className="text-[10px] text-primary shrink-0">Conditional</span>
        )}
      </button>

      {/* Expanded form */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-border pt-3 space-y-3">
          {/* Label */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Question Text
            </label>
            <input
              type="text"
              value={question.label}
              onChange={(e) => onUpdate({ label: e.target.value })}
              placeholder="Enter your question..."
              className={inputClass}
            />
          </div>

          {/* Type + Required row */}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Answer Type
              </label>
              <select
                value={question.type}
                onChange={(e) =>
                  onUpdate({ type: e.target.value as FormQuestion['type'] })
                }
                className={inputClass}
              >
                {QUESTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 pb-1">
              <label className="text-xs text-muted-foreground">Required</label>
              <button
                type="button"
                role="switch"
                aria-checked={question.required}
                onClick={() => onUpdate({ required: !question.required })}
                className={`
                  relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full
                  border-2 border-transparent shadow-sm transition-colors
                  ${question.required ? 'bg-primary' : 'bg-input'}
                `}
              >
                <span
                  className={`
                    pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform
                    ${question.required ? 'translate-x-4' : 'translate-x-0'}
                  `}
                />
              </button>
            </div>
          </div>

          {/* Type-specific config */}
          <TypeSpecificConfig question={question} onUpdate={onUpdate} />

          {/* Branching */}
          <BranchingSection
            question={question}
            allQuestions={allQuestions}
            onUpdate={onUpdate}
          />

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onMoveUp}
                disabled={index === 0}
                className="rounded p-1 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Move up"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onMoveDown}
                disabled={index === totalQuestions - 1}
                className="rounded p-1 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Move down"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={onDelete}
              className="rounded p-1 text-destructive hover:bg-destructive/10"
              aria-label="Delete question"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Type-Specific Config ───────────────────────────────────────────────────

function TypeSpecificConfig({
  question,
  onUpdate,
}: {
  question: FormQuestion
  onUpdate: (u: Partial<FormQuestion>) => void
}) {
  const inputClass =
    'w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

  switch (question.type) {
    case 'select':
    case 'multi_select':
      return (
        <OptionsEditor
          options={question.options ?? []}
          onChange={(opts) => onUpdate({ options: opts })}
        />
      )

    case 'scale':
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Min
              </label>
              <input
                type="number"
                value={question.scale_min ?? 1}
                onChange={(e) => onUpdate({ scale_min: Number(e.target.value) || 1 })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Max
              </label>
              <input
                type="number"
                value={question.scale_max ?? 5}
                onChange={(e) => onUpdate({ scale_max: Number(e.target.value) || 5 })}
                className={inputClass}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Min Label
              </label>
              <input
                type="text"
                value={
                  typeof question.scale_labels === 'object' && !Array.isArray(question.scale_labels)
                    ? (question.scale_labels as { min: string; max: string })?.min ?? ''
                    : ''
                }
                onChange={(e) =>
                  onUpdate({
                    scale_labels: {
                      min: e.target.value,
                      max:
                        typeof question.scale_labels === 'object' && !Array.isArray(question.scale_labels)
                          ? (question.scale_labels as { min: string; max: string })?.max ?? ''
                          : '',
                    },
                  })
                }
                placeholder="e.g. Not likely"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Max Label
              </label>
              <input
                type="text"
                value={
                  typeof question.scale_labels === 'object' && !Array.isArray(question.scale_labels)
                    ? (question.scale_labels as { min: string; max: string })?.max ?? ''
                    : ''
                }
                onChange={(e) =>
                  onUpdate({
                    scale_labels: {
                      min:
                        typeof question.scale_labels === 'object' && !Array.isArray(question.scale_labels)
                          ? (question.scale_labels as { min: string; max: string })?.min ?? ''
                          : '',
                      max: e.target.value,
                    },
                  })
                }
                placeholder="e.g. Very likely"
                className={inputClass}
              />
            </div>
          </div>
        </div>
      )

    case 'likert': {
      const labels = Array.isArray(question.scale_labels)
        ? question.scale_labels
        : [...LIKERT_LABELS_DEFAULT]

      return (
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Scale Labels (5 points)
          </label>
          <div className="space-y-1.5">
            {labels.map((label, i) => (
              <input
                key={i}
                type="text"
                value={label}
                onChange={(e) => {
                  const updated = [...labels]
                  updated[i] = e.target.value
                  onUpdate({ scale_labels: updated })
                }}
                placeholder={LIKERT_LABELS_DEFAULT[i]}
                className={inputClass}
              />
            ))}
          </div>
        </div>
      )
    }

    case 'text':
    case 'textarea':
      return (
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Max Length (optional)
          </label>
          <input
            type="number"
            value={question.max_length ?? ''}
            onChange={(e) =>
              onUpdate({
                max_length: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            placeholder="No limit"
            className={inputClass}
          />
        </div>
      )

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
  const inputClass =
    'w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">
        Options
      </label>
      <div className="space-y-1.5">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={opt}
              onChange={(e) => {
                const updated = [...options]
                updated[i] = e.target.value
                onChange(updated)
              }}
              placeholder={`Option ${i + 1}`}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => onChange(options.filter((_, idx) => idx !== i))}
              className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              aria-label="Remove option"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...options, ''])}
        className="mt-1.5 text-xs text-primary hover:underline"
      >
        + Add option
      </button>
    </div>
  )
}

// ─── Branching Section ──────────────────────────────────────────────────────

function BranchingSection({
  question,
  allQuestions,
  onUpdate,
}: {
  question: FormQuestion
  allQuestions: FormQuestion[]
  onUpdate: (u: Partial<FormQuestion>) => void
}) {
  const hasBranching = !!question.branching

  // Previous questions only (by order)
  const previousQuestions = allQuestions.filter((q) => q.order < question.order)

  // Find the condition field question for smart value input
  const conditionField = previousQuestions.find(
    (q) => q.id === question.branching?.condition_field
  )

  const selectClass =
    'w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring'
  const textClass =
    'w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring'

  if (previousQuestions.length === 0) return null

  return (
    <div className="border-t border-border pt-2 mt-2">
      <button
        type="button"
        onClick={() => {
          if (hasBranching) {
            onUpdate({ branching: undefined })
          } else {
            onUpdate({
              branching: {
                condition_field: previousQuestions[0]?.id ?? '',
                condition_value: '',
                condition_operator: 'equals',
              },
            })
          }
        }}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {hasBranching ? '✕ Remove condition' : '+ Show conditionally'}
      </button>

      {hasBranching && question.branching && (
        <div className="mt-2 space-y-2 pl-3 border-l-2 border-primary/20">
          <p className="text-xs text-muted-foreground">
            Show this question when...
          </p>

          {/* Condition field */}
          <select
            value={question.branching.condition_field}
            onChange={(e) =>
              onUpdate({
                branching: {
                  condition_field: e.target.value,
                  condition_value: '',
                  condition_operator: 'equals',
                },
              })
            }
            className={selectClass}
          >
            <option value="">Select a question...</option>
            {previousQuestions.map((q) => (
              <option key={q.id} value={q.id}>
                Q{q.order + 1}: {q.label || '(untitled)'}
              </option>
            ))}
          </select>

          {/* Operator */}
          {question.branching.condition_field && (
            <select
              value={question.branching.condition_operator}
              onChange={(e) =>
                onUpdate({
                  branching: {
                    ...question.branching!,
                    condition_operator: e.target
                      .value as BranchingConfig['condition_operator'],
                  },
                })
              }
              className={selectClass}
            >
              {BRANCHING_OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
          )}

          {/* Value — smart based on condition field type */}
          {question.branching.condition_field && conditionField && (
            <ConditionValueInput
              conditionField={conditionField}
              value={question.branching.condition_value}
              onChange={(val) =>
                onUpdate({
                  branching: {
                    ...question.branching!,
                    condition_value: val,
                  },
                })
              }
            />
          )}
        </div>
      )}
    </div>
  )
}

function ConditionValueInput({
  conditionField,
  value,
  onChange,
}: {
  conditionField: FormQuestion
  value: string
  onChange: (val: string) => void
}) {
  const selectClass =
    'w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring'

  if (conditionField.type === 'select' || conditionField.type === 'multi_select') {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        <option value="">Select value...</option>
        {(conditionField.options ?? []).map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    )
  }

  if (conditionField.type === 'yes_no') {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        <option value="">Select...</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    )
  }

  if (conditionField.type === 'likert') {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        <option value="">Select...</option>
        {LIKERT_LABELS_DEFAULT.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
    )
  }

  return (
    <input
      type={
        conditionField.type === 'number' || conditionField.type === 'scale'
          ? 'number'
          : 'text'
      }
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Value to match..."
      className={selectClass}
    />
  )
}

// ─── Preview Question Field ─────────────────────────────────────────────────

function PreviewQuestionField({
  question,
  value,
  onChange,
}: {
  question: FormQuestion
  value: unknown
  onChange: (val: unknown) => void
}) {
  const inputBase =
    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

  const labelEl = (
    <label className="block text-sm font-medium text-foreground mb-1">
      {question.label || '(untitled)'}
      {question.required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  )

  switch (question.type) {
    case 'text':
      return (
        <div className="rounded-lg border border-border p-3">
          {labelEl}
          <input
            type="text"
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value || undefined)}
            className={inputBase}
          />
        </div>
      )
    case 'textarea':
      return (
        <div className="rounded-lg border border-border p-3">
          {labelEl}
          <textarea
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value || undefined)}
            rows={3}
            className={`${inputBase} resize-y`}
          />
        </div>
      )
    case 'number':
      return (
        <div className="rounded-lg border border-border p-3">
          {labelEl}
          <input
            type="number"
            value={value != null ? String(value) : ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
            className={inputBase}
          />
        </div>
      )
    case 'select':
      return (
        <div className="rounded-lg border border-border p-3">
          {labelEl}
          <select
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value || undefined)}
            className={inputBase}
          >
            <option value="">Select...</option>
            {(question.options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      )
    case 'yes_no':
      return (
        <div className="rounded-lg border border-border p-3">
          {labelEl}
          <div className="flex gap-2">
            {['yes', 'no'].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(opt)}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors
                  ${value === opt ? 'border-primary bg-primary text-primary-foreground' : 'border-input hover:bg-muted'}`}
              >
                {opt === 'yes' ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        </div>
      )
    default:
      return (
        <div className="rounded-lg border border-border p-3">
          {labelEl}
          <input
            type="text"
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value || undefined)}
            placeholder={`(${question.type})`}
            className={inputBase}
          />
        </div>
      )
  }
}
