'use client'

import {
  Type,
  AlignLeft,
  Link,
  ChevronDown,
  CheckSquare,
  ToggleLeft,
  BarChart3,
  SlidersHorizontal,
  Smile,
  Hash,
  Calendar,
  Upload,
} from 'lucide-react'
import type { FormQuestion } from '@/lib/form-types'
import { cn } from '@/lib/utils'

// ─── Type Picker Data ───────────────────────────────────────────────────────

interface QuestionTypeInfo {
  type: FormQuestion['type']
  label: string
  icon: React.ElementType
}

interface QuestionTypeGroup {
  name: string
  types: QuestionTypeInfo[]
}

const QUESTION_TYPE_GROUPS: QuestionTypeGroup[] = [
  {
    name: 'Text',
    types: [
      { type: 'text', label: 'Short Text', icon: Type },
      { type: 'textarea', label: 'Long Text', icon: AlignLeft },
      { type: 'url', label: 'URL', icon: Link },
    ],
  },
  {
    name: 'Choice',
    types: [
      { type: 'select', label: 'Dropdown', icon: ChevronDown },
      { type: 'multi_select', label: 'Multi-Select', icon: CheckSquare },
      { type: 'yes_no', label: 'Yes / No', icon: ToggleLeft },
    ],
  },
  {
    name: 'Rating',
    types: [
      { type: 'scale', label: 'Number Scale', icon: BarChart3 },
      { type: 'likert', label: 'Likert Scale', icon: SlidersHorizontal },
      { type: 'emoji', label: 'Emoji Rating', icon: Smile },
    ],
  },
  {
    name: 'Data',
    types: [
      { type: 'number', label: 'Number', icon: Hash },
      { type: 'date', label: 'Date', icon: Calendar },
      { type: 'file_upload', label: 'File Upload', icon: Upload },
    ],
  },
]

// ─── Component ──────────────────────────────────────────────────────────────

interface QuestionTypePickerProps {
  onAddQuestion: (type: FormQuestion['type']) => void
}

export function QuestionTypePicker({ onAddQuestion }: QuestionTypePickerProps) {
  return (
    <nav aria-label="Question types" className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
        Add Question
      </p>
      {QUESTION_TYPE_GROUPS.map((group) => (
        <div key={group.name}>
          <p className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wide mb-1.5 px-1">
            {group.name}
          </p>
          <div className="space-y-1">
            {group.types.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => onAddQuestion(type)}
                className={cn(
                  'w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm',
                  'text-foreground hover:bg-muted/70 active:bg-muted transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1'
                )}
              >
                <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}

/** Get the label for a given question type */
export function getQuestionTypeLabel(type: FormQuestion['type']): string {
  for (const group of QUESTION_TYPE_GROUPS) {
    const found = group.types.find((t) => t.type === type)
    if (found) return found.label
  }
  return type
}

/** Get the category name for a given question type */
export function getQuestionTypeCategory(type: FormQuestion['type']): string {
  for (const group of QUESTION_TYPE_GROUPS) {
    if (group.types.some((t) => t.type === type)) return group.name
  }
  return 'Other'
}
