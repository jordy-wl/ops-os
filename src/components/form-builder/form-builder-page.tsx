'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import {
  Eye,
  Pencil,
  ChevronRight,
  Loader2,
  CheckCircle2,
  LayoutList,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { FormQuestion } from '@/lib/form-types'
import { QUESTION_TYPES } from '@/lib/form-types'
import { QuestionTypePicker, getQuestionTypeLabel } from './question-type-picker'
import { QuestionCard } from './question-card'
import { QuestionConfigPanel, QuestionConfigEmptyState } from './question-config-panel'
import { FormPreviewPanel } from './form-preview-panel'

// ─── Types ──────────────────────────────────────────────────────────────────

interface FormBuilderPageProps {
  blockId: string
  formName: string
  formTitle: string
  initialQuestions: FormQuestion[]
}

// ─── Debounce helper ────────────────────────────────────────────────────────

function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return useCallback(
    (...args: unknown[]) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args)
      }, delay)
    },
    [delay]
  ) as T
}

// ─── Save Status Type ───────────────────────────────────────────────────────

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

// ─── Component ──────────────────────────────────────────────────────────────

export function FormBuilderPage({
  blockId,
  formName,
  formTitle,
  initialQuestions,
}: FormBuilderPageProps) {
  const [questions, setQuestions] = useState<FormQuestion[]>(
    () => [...initialQuestions].sort((a, b) => a.order - b.order)
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isPreview, setIsPreview] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  // Keep a ref to the latest metadata for merging
  const metadataRef = useRef<Record<string, unknown>>({})

  // Load initial metadata
  useEffect(() => {
    fetch(`/api/blocks/${blockId}`)
      .then((res) => res.json())
      .then((data) => {
        const block = data.data ?? data
        if (block?.metadata && typeof block.metadata === 'object') {
          metadataRef.current = block.metadata as Record<string, unknown>
        }
      })
      .catch(() => {
        // Non-critical — we can still save with just questions
      })
  }, [blockId])

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Save function
  const saveQuestions = useCallback(
    async (updatedQuestions: FormQuestion[]) => {
      setSaveStatus('saving')
      try {
        const response = await fetch(`/api/blocks/${blockId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            metadata: {
              ...metadataRef.current,
              questions: updatedQuestions,
            },
          }),
        })

        if (!response.ok) {
          throw new Error(`Save failed: ${response.status}`)
        }

        // Update metadata ref with any server-side changes
        const data = await response.json()
        const block = data.data ?? data
        if (block?.metadata && typeof block.metadata === 'object') {
          metadataRef.current = block.metadata as Record<string, unknown>
        }

        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      } catch {
        setSaveStatus('error')
        setTimeout(() => setSaveStatus('idle'), 3000)
      }
    },
    [blockId]
  )

  const debouncedSave = useDebouncedCallback(
    (updatedQuestions: unknown) => {
      saveQuestions(updatedQuestions as FormQuestion[])
    },
    500
  )

  // Update questions and trigger save
  const updateQuestions = useCallback(
    (updater: (prev: FormQuestion[]) => FormQuestion[]) => {
      setQuestions((prev) => {
        const next = updater(prev)
        debouncedSave(next)
        return next
      })
    },
    [debouncedSave]
  )

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      updateQuestions((prev) => {
        const oldIndex = prev.findIndex((q) => q.id === active.id)
        const newIndex = prev.findIndex((q) => q.id === over.id)
        if (oldIndex === -1 || newIndex === -1) return prev

        const reordered = arrayMove(prev, oldIndex, newIndex)
        return reordered.map((q, i) => ({ ...q, order: i }))
      })
    },
    [updateQuestions]
  )

  const handleAddQuestion = useCallback(
    (type: FormQuestion['type']) => {
      const typeLabel = getQuestionTypeLabel(type)
      const newQuestion: FormQuestion = {
        id: crypto.randomUUID(),
        type,
        label: `New ${typeLabel}`,
        required: false,
        order: questions.length,
        ...(type === 'select' || type === 'multi_select'
          ? { options: ['Option 1', 'Option 2'] }
          : {}),
        ...(type === 'scale' ? { scale_min: 1, scale_max: 5 } : {}),
      }

      updateQuestions((prev) => [...prev, newQuestion])
      setSelectedId(newQuestion.id)
      setIsPreview(false)
    },
    [questions.length, updateQuestions]
  )

  const handleDeleteQuestion = useCallback(
    (questionId: string) => {
      if (selectedId === questionId) {
        setSelectedId(null)
      }

      updateQuestions((prev) => {
        let updated = prev.filter((q) => q.id !== questionId)
        // Clear branching refs to deleted question
        updated = updated.map((q) => {
          if (q.branching?.condition_field === questionId) {
            return { ...q, branching: undefined }
          }
          return q
        })
        return updated.map((q, i) => ({ ...q, order: i }))
      })
    },
    [selectedId, updateQuestions]
  )

  const handleDuplicateQuestion = useCallback(
    (questionId: string) => {
      updateQuestions((prev) => {
        const source = prev.find((q) => q.id === questionId)
        if (!source) return prev

        const sourceIndex = prev.findIndex((q) => q.id === questionId)
        const duplicated: FormQuestion = {
          ...source,
          id: crypto.randomUUID(),
          label: `${source.label} (copy)`,
          branching: undefined, // Don't copy branching conditions
        }

        const next = [...prev]
        next.splice(sourceIndex + 1, 0, duplicated)
        return next.map((q, i) => ({ ...q, order: i }))
      })
    },
    [updateQuestions]
  )

  const handleLabelChange = useCallback(
    (questionId: string, label: string) => {
      updateQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? { ...q, label } : q))
      )
    },
    [updateQuestions]
  )

  const handleQuestionConfigChange = useCallback(
    (updates: Partial<FormQuestion>) => {
      if (!selectedId) return
      updateQuestions((prev) =>
        prev.map((q) => (q.id === selectedId ? { ...q, ...updates } : q))
      )
    },
    [selectedId, updateQuestions]
  )

  const selectedQuestion = questions.find((q) => q.id === selectedId) ?? null

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-border bg-background px-4 py-3 lg:px-6">
        <div className="flex items-center justify-between">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
            <Link
              href={`/blocks/${blockId}`}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {formName || 'Form'}
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
            <span className="font-medium text-foreground">Builder</span>
          </nav>

          <div className="flex items-center gap-3">
            {/* Save status indicator */}
            <SaveStatusIndicator status={saveStatus} />

            {/* Preview toggle */}
            <Button
              variant={isPreview ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsPreview(!isPreview)}
            >
              {isPreview ? (
                <>
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  Edit
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 mr-1.5" />
                  Preview
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* ─── Body ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — Type picker (hidden in preview mode and on mobile) */}
        {!isPreview && (
          <aside className="hidden lg:block w-56 shrink-0 border-r border-border overflow-y-auto p-3">
            <QuestionTypePicker onAddQuestion={handleAddQuestion} />
          </aside>
        )}

        {/* Center — Question list or Preview */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {isPreview ? (
            <FormPreviewPanel
              questions={questions}
              formTitle={formTitle || formName}
            />
          ) : (
            <div className="max-w-2xl mx-auto">
              {/* Question count header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-muted-foreground">
                  {questions.length} question{questions.length !== 1 ? 's' : ''}
                </h2>

                {/* Mobile add button (shown when sidebar is hidden) */}
                <div className="lg:hidden">
                  <MobileAddMenu onAddQuestion={handleAddQuestion} />
                </div>
              </div>

              {questions.length === 0 ? (
                <QuestionListEmptyState onAddQuestion={handleAddQuestion} />
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={questions.map((q) => q.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2" role="list" aria-label="Form questions">
                      {questions.map((question) => (
                        <QuestionCard
                          key={question.id}
                          question={question}
                          isSelected={selectedId === question.id}
                          onSelect={() =>
                            setSelectedId(
                              selectedId === question.id ? null : question.id
                            )
                          }
                          onDelete={() => handleDeleteQuestion(question.id)}
                          onDuplicate={() => handleDuplicateQuestion(question.id)}
                          onLabelChange={(label) =>
                            handleLabelChange(question.id, label)
                          }
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          )}
        </main>

        {/* Right sidebar — Config panel (hidden in preview mode and on mobile) */}
        {!isPreview && (
          <aside className="hidden lg:block w-72 shrink-0 border-l border-border overflow-y-auto p-4">
            {selectedQuestion ? (
              <QuestionConfigPanel
                question={selectedQuestion}
                allQuestions={questions}
                onChange={handleQuestionConfigChange}
              />
            ) : (
              <QuestionConfigEmptyState />
            )}
          </aside>
        )}
      </div>

      {/* ─── Mobile config sheet (shown below on small screens) ──────────── */}
      {!isPreview && selectedQuestion && (
        <div className="lg:hidden border-t border-border bg-background overflow-y-auto max-h-[40vh] p-4">
          <QuestionConfigPanel
            question={selectedQuestion}
            allQuestions={questions}
            onChange={handleQuestionConfigChange}
          />
        </div>
      )}
    </div>
  )
}

// ─── Save Status Indicator ──────────────────────────────────────────────────

function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-xs transition-opacity',
        status === 'saving' && 'text-muted-foreground',
        status === 'saved' && 'text-emerald-600 dark:text-emerald-400',
        status === 'error' && 'text-destructive'
      )}
      role="status"
      aria-label={
        status === 'saving'
          ? 'Saving changes...'
          : status === 'saved'
            ? 'Changes saved'
            : 'Failed to save'
      }
    >
      {status === 'saving' && (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Saving...</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <CheckCircle2 className="w-3 h-3" />
          <span>Saved</span>
        </>
      )}
      {status === 'error' && <span>Save failed</span>}
    </div>
  )
}

// ─── Empty State ────────────────────────────────────────────────────────────

function QuestionListEmptyState({
  onAddQuestion,
}: {
  onAddQuestion: (type: FormQuestion['type']) => void
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
      <LayoutList className="w-10 h-10 text-muted-foreground/30 mb-4" />
      <h3 className="text-sm font-medium text-foreground mb-1">
        No questions yet
      </h3>
      <p className="text-xs text-muted-foreground mb-6 max-w-xs">
        Start building your form by adding questions from the sidebar, or click
        below to add your first question.
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onAddQuestion('text')}
      >
        Add First Question
      </Button>
    </div>
  )
}

// ─── Mobile Add Menu ────────────────────────────────────────────────────────

function MobileAddMenu({
  onAddQuestion,
}: {
  onAddQuestion: (type: FormQuestion['type']) => void
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
      >
        Add Question
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-border bg-card shadow-lg py-1">
            {QUESTION_TYPES.map((qt) => (
              <button
                key={qt.value}
                type="button"
                onClick={() => {
                  onAddQuestion(qt.value as FormQuestion['type'])
                  setIsOpen(false)
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
              >
                {qt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
