'use client'

import { X, Plus } from 'lucide-react'
import { FieldLabel, TextInput, SelectInput, TextArea } from './form-primitives'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConditionOperator =
  | 'is'
  | 'is_not'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'is_empty'
  | 'is_not_empty'

export type ConditionLogic = 'and' | 'or'

export interface SingleCondition {
  field: string
  operator: ConditionOperator
  value: string
}

export interface ConditionGroup {
  logic: ConditionLogic
  conditions: SingleCondition[]
}

export interface ConditionValue {
  mode: 'simple' | 'compound' | 'advanced'
  simple?: SingleCondition
  compound?: ConditionGroup
  advanced?: string
}

export interface ConditionBuilderProps {
  value: ConditionValue
  onChange: (value: ConditionValue) => void
  /** Available fields for the field dropdown. Falls back to a free-text input when empty. */
  fields?: { value: string; label: string }[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: 'is', label: 'is' },
  { value: 'is_not', label: 'is not' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'greater_than', label: 'greater than' },
  { value: 'less_than', label: 'less than' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
]

const VALUE_HIDDEN_OPERATORS: ConditionOperator[] = ['is_empty', 'is_not_empty']

const DEFAULT_CONDITION: SingleCondition = { field: '', operator: 'is', value: '' }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValueHidden(operator: ConditionOperator): boolean {
  return VALUE_HIDDEN_OPERATORS.includes(operator)
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** A single condition row: field, operator, value (plus optional remove button). */
function ConditionRow({
  condition,
  index,
  fields,
  onChange,
  onRemove,
  idPrefix,
}: {
  condition: SingleCondition
  index: number
  fields: { value: string; label: string }[]
  onChange: (updated: SingleCondition) => void
  onRemove?: () => void
  idPrefix: string
}) {
  const fieldId = `${idPrefix}-field-${index}`
  const opId = `${idPrefix}-op-${index}`
  const valId = `${idPrefix}-val-${index}`
  const hideValue = isValueHidden(condition.operator)

  const fieldOptions =
    fields.length > 0
      ? [{ value: '', label: 'Select field...' }, ...fields]
      : []

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-2">
        {/* Field */}
        <div className="flex-1 min-w-0">
          <FieldLabel htmlFor={fieldId}>Field</FieldLabel>
          {fieldOptions.length > 0 ? (
            <SelectInput
              id={fieldId}
              value={condition.field}
              onChange={(v) => onChange({ ...condition, field: v })}
              options={fieldOptions}
            />
          ) : (
            <TextInput
              id={fieldId}
              value={condition.field}
              onChange={(v) => onChange({ ...condition, field: v })}
              placeholder="e.g. block.status"
            />
          )}
        </div>

        {/* Operator */}
        <div className="flex-1 min-w-0">
          <FieldLabel htmlFor={opId}>Operator</FieldLabel>
          <SelectInput
            id={opId}
            value={condition.operator}
            onChange={(v) =>
              onChange({
                ...condition,
                operator: v as ConditionOperator,
                // Clear value when switching to a value-hidden operator
                value: VALUE_HIDDEN_OPERATORS.includes(v as ConditionOperator)
                  ? ''
                  : condition.value,
              })
            }
            options={OPERATORS}
          />
        </div>

        {/* Value */}
        {!hideValue && (
          <div className="flex-1 min-w-0">
            <FieldLabel htmlFor={valId}>Value</FieldLabel>
            <TextInput
              id={valId}
              value={condition.value}
              onChange={(v) => onChange({ ...condition, value: v })}
              placeholder="comparison value"
            />
          </div>
        )}

        {/* Remove button */}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove condition ${index + 1}`}
            className="mt-5 p-1 text-muted-foreground hover:text-destructive rounded transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

/** AND/OR toggle rendered as two small buttons. */
function LogicToggle({
  logic,
  onChange,
}: {
  logic: ConditionLogic
  onChange: (v: ConditionLogic) => void
}) {
  const base = 'px-2 py-0.5 text-xs rounded transition-colors'
  const active = 'bg-primary text-primary-foreground'
  const inactive = 'bg-muted text-muted-foreground hover:text-foreground'

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Condition logic">
      <button
        type="button"
        onClick={() => onChange('and')}
        className={`${base} ${logic === 'and' ? active : inactive}`}
        aria-pressed={logic === 'and'}
      >
        ALL must be true
      </button>
      <button
        type="button"
        onClick={() => onChange('or')}
        className={`${base} ${logic === 'or' ? active : inactive}`}
        aria-pressed={logic === 'or'}
      >
        ANY must be true
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mode renderers
// ---------------------------------------------------------------------------

function SimpleMode({
  value,
  fields,
  onChange,
  onSwitchToCompound,
}: {
  value: ConditionValue
  fields: { value: string; label: string }[]
  onChange: (v: ConditionValue) => void
  onSwitchToCompound: () => void
}) {
  const condition = value.simple ?? { ...DEFAULT_CONDITION }

  function handleConditionChange(updated: SingleCondition) {
    onChange({ ...value, simple: updated })
  }

  return (
    <div>
      <ConditionRow
        condition={condition}
        index={0}
        fields={fields}
        onChange={handleConditionChange}
        idPrefix="simple"
      />
      <button
        type="button"
        onClick={onSwitchToCompound}
        className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Plus className="h-3 w-3" />
        Add condition
      </button>
    </div>
  )
}

function CompoundMode({
  value,
  fields,
  onChange,
}: {
  value: ConditionValue
  fields: { value: string; label: string }[]
  onChange: (v: ConditionValue) => void
}) {
  const group: ConditionGroup = value.compound ?? {
    logic: 'and',
    conditions: [{ ...DEFAULT_CONDITION }],
  }
  const { logic, conditions } = group

  function updateGroup(next: ConditionGroup) {
    onChange({ ...value, compound: next })
  }

  function updateCondition(index: number, updated: SingleCondition) {
    const next = [...conditions]
    next[index] = updated
    updateGroup({ logic, conditions: next })
  }

  function removeCondition(index: number) {
    if (conditions.length <= 1) return
    updateGroup({ logic, conditions: conditions.filter((_, i) => i !== index) })
  }

  function addCondition() {
    updateGroup({ logic, conditions: [...conditions, { ...DEFAULT_CONDITION }] })
  }

  return (
    <div>
      <LogicToggle logic={logic} onChange={(v) => updateGroup({ ...group, logic: v })} />

      <div className="mt-3 flex flex-col gap-3">
        {conditions.map((cond, i) => (
          <ConditionRow
            key={i}
            condition={cond}
            index={i}
            fields={fields}
            onChange={(updated) => updateCondition(i, updated)}
            onRemove={conditions.length > 1 ? () => removeCondition(i) : undefined}
            idPrefix="compound"
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addCondition}
        className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Plus className="h-3 w-3" />
        Add condition
      </button>
    </div>
  )
}

function AdvancedMode({
  value,
  onChange,
}: {
  value: ConditionValue
  onChange: (v: ConditionValue) => void
}) {
  return (
    <div>
      <FieldLabel htmlFor="adv-expression">Expression</FieldLabel>
      <TextArea
        id="adv-expression"
        value={value.advanced ?? ''}
        onChange={(v) => onChange({ ...value, advanced: v })}
        placeholder='e.g. {{block.status}} === "approved" && {{block.amount}} > 1000'
        rows={4}
      />
      <p className="mt-1 text-xs text-muted-foreground">
        Use {'{{variable}}'} syntax for dynamic values.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mode switcher
// ---------------------------------------------------------------------------

type Mode = ConditionValue['mode']

const MODES: { key: Mode; label: string }[] = [
  { key: 'simple', label: 'Simple' },
  { key: 'compound', label: 'Compound' },
  { key: 'advanced', label: 'Advanced' },
]

function ModeSwitcher({
  current,
  onSwitch,
}: {
  current: Mode
  onSwitch: (mode: Mode) => void
}) {
  return (
    <nav className="flex gap-2 mt-3 text-xs" aria-label="Condition builder mode">
      {MODES.map((m) => (
        <button
          key={m.key}
          type="button"
          onClick={() => onSwitch(m.key)}
          className={
            m.key === current
              ? 'font-semibold text-foreground'
              : 'text-muted-foreground hover:text-foreground cursor-pointer'
          }
          aria-current={m.key === current ? 'true' : undefined}
        >
          {m.label}
        </button>
      ))}
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ConditionBuilder({ value, onChange, fields = [] }: ConditionBuilderProps) {
  const { mode } = value

  /**
   * Switch modes while preserving data where possible.
   * - simple -> compound: copies the single condition into the group
   * - compound -> simple: takes the first condition from the group
   * - other transitions: leave existing data in place (it stays serialised)
   */
  function switchMode(next: Mode) {
    if (next === mode) return

    const updated: ConditionValue = { ...value, mode: next }

    // simple -> compound: seed the group from the single condition
    if (mode === 'simple' && next === 'compound') {
      const seed = value.simple ?? { ...DEFAULT_CONDITION }
      updated.compound = {
        logic: value.compound?.logic ?? 'and',
        conditions: [seed],
      }
    }

    // compound -> simple: take first condition
    if (mode === 'compound' && next === 'simple') {
      const first = value.compound?.conditions[0]
      if (first) {
        updated.simple = { ...first }
      }
    }

    onChange(updated)
  }

  /** Shortcut: clicking "Add condition" in simple mode auto-switches to compound. */
  function switchToCompound() {
    switchMode('compound')
  }

  return (
    <div>
      {mode === 'simple' && (
        <SimpleMode
          value={value}
          fields={fields}
          onChange={onChange}
          onSwitchToCompound={switchToCompound}
        />
      )}

      {mode === 'compound' && (
        <CompoundMode value={value} fields={fields} onChange={onChange} />
      )}

      {mode === 'advanced' && <AdvancedMode value={value} onChange={onChange} />}

      <ModeSwitcher current={mode} onSwitch={switchMode} />
    </div>
  )
}
