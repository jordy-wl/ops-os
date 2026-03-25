'use client'

import { GitBranch, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { FormQuestion, BranchingConfig } from '@/lib/form-types'
import { BRANCHING_OPERATORS, LIKERT_LABELS_DEFAULT } from '@/lib/form-types'

// ─── Types ──────────────────────────────────────────────────────────────────

interface BranchingEditorProps {
  branching: BranchingConfig | undefined
  previousQuestions: FormQuestion[]
  onChange: (branching: BranchingConfig | undefined) => void
}

// ─── Component ──────────────────────────────────────────────────────────────

export function BranchingEditor({
  branching,
  previousQuestions,
  onChange,
}: BranchingEditorProps) {
  if (previousQuestions.length === 0) {
    return null
  }

  if (!branching) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() =>
          onChange({
            condition_field: previousQuestions[0]?.id ?? '',
            condition_value: '',
            condition_operator: 'equals',
          })
        }
        className="w-full justify-start text-muted-foreground hover:text-foreground"
      >
        <GitBranch className="w-3.5 h-3.5 mr-1.5" />
        Add condition
      </Button>
    )
  }

  const conditionField = previousQuestions.find(
    (q) => q.id === branching.condition_field
  )

  const selectClass =
    'w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50'

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">
          Show this question when...
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => onChange(undefined)}
          aria-label="Remove condition"
          className="text-muted-foreground hover:text-destructive"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>

      {/* Depends on */}
      <div>
        <label className="block text-[11px] font-medium text-muted-foreground mb-1">
          Question
        </label>
        <select
          value={branching.condition_field}
          onChange={(e) =>
            onChange({
              condition_field: e.target.value,
              condition_value: '',
              condition_operator: 'equals',
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
      </div>

      {/* Operator */}
      {branching.condition_field && (
        <div>
          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
            Operator
          </label>
          <select
            value={branching.condition_operator}
            onChange={(e) =>
              onChange({
                ...branching,
                condition_operator: e.target.value as BranchingConfig['condition_operator'],
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
        </div>
      )}

      {/* Value */}
      {branching.condition_field && conditionField && (
        <div>
          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
            Value
          </label>
          <ConditionValueInput
            conditionField={conditionField}
            value={branching.condition_value}
            onChange={(val) =>
              onChange({ ...branching, condition_value: val })
            }
          />
        </div>
      )}
    </div>
  )
}

// ─── Condition Value Input ──────────────────────────────────────────────────

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
    'w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50'

  if (conditionField.type === 'select' || conditionField.type === 'multi_select') {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={selectClass}
      >
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
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={selectClass}
      >
        <option value="">Select...</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    )
  }

  if (conditionField.type === 'likert') {
    const labels = Array.isArray(conditionField.scale_labels)
      ? conditionField.scale_labels
      : LIKERT_LABELS_DEFAULT

    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={selectClass}
      >
        <option value="">Select...</option>
        {labels.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
    )
  }

  return (
    <Input
      type={
        conditionField.type === 'number' || conditionField.type === 'scale'
          ? 'number'
          : 'text'
      }
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Value to match..."
    />
  )
}
