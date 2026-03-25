'use client'

import { useState, useRef, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Copy, Trash2, GitBranch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { FormQuestion } from '@/lib/form-types'
import { getQuestionTypeLabel, getQuestionTypeCategory } from './question-type-picker'

// ─── Category badge colors ──────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Text: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Choice: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  Rating: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Data: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
}

// ─── Component ──────────────────────────────────────────────────────────────

interface QuestionCardProps {
  question: FormQuestion
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
  onDuplicate: () => void
  onLabelChange: (label: string) => void
}

export function QuestionCard({
  question,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
  onLabelChange,
}: QuestionCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(question.label)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const typeLabel = getQuestionTypeLabel(question.type)
  const category = getQuestionTypeCategory(question.type)
  const categoryColor = CATEGORY_COLORS[category] ?? 'bg-muted text-muted-foreground'

  // Focus the input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditValue(question.label)
    setIsEditing(true)
  }

  const handleLabelBlur = () => {
    setIsEditing(false)
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== question.label) {
      onLabelChange(trimmed)
    } else {
      setEditValue(question.label)
    }
  }

  const handleLabelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLabelBlur()
    }
    if (e.key === 'Escape') {
      setEditValue(question.label)
      setIsEditing(false)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group rounded-lg border bg-card transition-all',
        isSelected && 'border-l-[3px] border-l-primary bg-primary/[0.03]',
        !isSelected && 'border-border hover:border-muted-foreground/30',
        isDragging && 'opacity-50 shadow-lg z-50'
      )}
    >
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer"
        onClick={onSelect}
        role="button"
        tabIndex={0}
        aria-label={`Select question ${question.order + 1}: ${question.label || 'Untitled'}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelect()
          }
        }}
      >
        {/* Drag handle */}
        <button
          type="button"
          className={cn(
            'shrink-0 cursor-grab rounded p-0.5 text-muted-foreground/50',
            'hover:text-muted-foreground hover:bg-muted/50 active:cursor-grabbing',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {/* Question number */}
        <span className="shrink-0 text-xs font-semibold text-muted-foreground tabular-nums w-5 text-center">
          {question.order + 1}
        </span>

        {/* Type badge */}
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
            categoryColor
          )}
        >
          {typeLabel}
        </span>

        {/* Label — inline editable */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleLabelBlur}
              onKeyDown={handleLabelKeyDown}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'w-full bg-transparent text-sm text-foreground px-1 py-0',
                'border-b border-primary outline-none'
              )}
            />
          ) : (
            <button
              type="button"
              onClick={handleLabelClick}
              className={cn(
                'text-sm truncate text-left w-full',
                question.label ? 'text-foreground' : 'text-muted-foreground italic'
              )}
            >
              {question.label || 'Untitled question'}
            </button>
          )}
        </div>

        {/* Branching indicator */}
        {question.branching && (
          <span
            className="shrink-0 text-primary"
            title="Has branching condition"
          >
            <GitBranch className="w-3.5 h-3.5" />
          </span>
        )}

        {/* Required asterisk */}
        {question.required && (
          <span
            className="shrink-0 text-destructive text-sm font-bold"
            title="Required"
            aria-label="Required question"
          >
            *
          </span>
        )}

        {/* Action buttons */}
        <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={(e) => {
              e.stopPropagation()
              onDuplicate()
            }}
            aria-label="Duplicate question"
          >
            <Copy className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            aria-label="Delete question"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}
