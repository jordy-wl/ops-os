'use client'

import { useMemo } from 'react'
import { FieldLabel, SelectInput } from './form-primitives'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PreviousStep {
  id: string
  name: string
  label: string
  stepType: string
  /** Fields this step outputs that contain block IDs */
  outputFields: string[]
}

export interface TemplateRecordPickerProps {
  id: string
  value: string
  onChange: (value: string) => void
  label?: string
  /** Hint shown below the picker describing the template context */
  hint?: string
  /** Block type this workflow applies to (for display) */
  appliesToType?: string
  /** Steps preceding this node in the canvas */
  previousSteps?: PreviousStep[]
  /** Available edge types for Related Record mode */
  edgeTypes?: { value: string; label: string }[]
  /** Whether to default to triggering record when value is empty */
  defaultToTriggering?: boolean
}

// ---------------------------------------------------------------------------
// Reference mode detection
// ---------------------------------------------------------------------------

type RefMode = 'triggering' | 'from_step' | 'related' | 'legacy_uuid'

function detectMode(value: string): RefMode {
  if (!value || value === '{{context.source_block_id}}') return 'triggering'
  if (value.startsWith('{{steps.')) return 'from_step'
  if (value.startsWith('{{related:')) return 'related'
  // UUID pattern — legacy reference to a specific block instance
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return 'legacy_uuid'
  return 'triggering'
}

/** Parse {{steps.step_name.field}} into parts */
function parseStepRef(value: string): { stepName: string; field: string } | null {
  const match = value.match(/^\{\{steps\.([^.]+)\.(.+)\}\}$/)
  if (!match) return null
  return { stepName: match[1], field: match[2] }
}

/** Parse {{related:<source>:<edge_type>:<direction>}} into parts */
function parseRelatedRef(value: string): {
  source: string
  edgeType: string
  direction: string
} | null {
  const match = value.match(/^\{\{related:([^:]+):([^:]+):([^}]+)\}\}$/)
  if (!match) return null
  return { source: match[1], edgeType: match[2], direction: match[3] }
}

// ---------------------------------------------------------------------------
// Default edge types (subset of STANDARD_EDGE_TYPES)
// ---------------------------------------------------------------------------

const DEFAULT_EDGE_TYPES = [
  { value: 'part_of', label: 'Part Of' },
  { value: 'owned_by', label: 'Owned By' },
  { value: 'governed_by', label: 'Governed By' },
  { value: 'counterparty_to', label: 'Counterparty To' },
  { value: 'related_to', label: 'Related To' },
  { value: 'processing', label: 'Processing' },
  { value: 'spawned', label: 'Spawned' },
  { value: 'triggered_by', label: 'Triggered By' },
]

// ---------------------------------------------------------------------------
// Step output fields by step type
// ---------------------------------------------------------------------------

/** Known output fields that contain block IDs, keyed by step type */
export const STEP_OUTPUT_FIELDS: Record<string, string[]> = {
  run_action: ['block_id'],
  create_edge: ['edge_id'],
  search_blocks: ['results', 'results[0]', 'count'],
  generate_task: ['task_id', 'block_id'],
  update_block: ['block_id'],
  provision_portal: ['portal_url', 'portal_token', 'block_id'],
  create_shared_link: ['url', 'link_id', 'block_id'],
  run_sub_workflow: ['result', 'instance_id'],
  ai_analysis: ['result', 'block_id'],
  ai_classify: ['category', 'block_id'],
  ai_summarize: ['summary', 'block_id'],
  ai_risk_assessment: ['risk_level', 'block_id'],
  emit_event: ['event_id'],
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplateRecordPicker({
  id,
  value,
  onChange,
  label,
  hint,
  appliesToType,
  previousSteps = [],
  edgeTypes,
}: TemplateRecordPickerProps) {
  const mode = detectMode(value)
  const resolvedEdgeTypes = edgeTypes ?? DEFAULT_EDGE_TYPES
  const stepRef = mode === 'from_step' ? parseStepRef(value) : null
  const relatedRef = mode === 'related' ? parseRelatedRef(value) : null

  // Steps that produce block-related outputs
  const stepsWithOutputs = useMemo(() => {
    return previousSteps.filter((s) => s.outputFields.length > 0)
  }, [previousSteps])

  // Handle mode change
  function handleModeChange(newMode: string) {
    switch (newMode) {
      case 'triggering':
        onChange('{{context.source_block_id}}')
        break
      case 'from_step':
        if (stepsWithOutputs.length > 0) {
          const first = stepsWithOutputs[0]
          const firstField = first.outputFields.includes('block_id') ? 'block_id' : first.outputFields[0]
          onChange(`{{steps.${first.name}.${firstField}}}`)
        }
        break
      case 'related':
        onChange('{{related:triggering:related_to:outgoing}}')
        break
      case 'legacy_uuid':
        // Can't switch TO legacy mode — it's detected from existing values
        break
    }
  }

  // Handle step selection change
  function handleStepChange(stepName: string) {
    const step = stepsWithOutputs.find((s) => s.name === stepName)
    if (!step) return
    const field = step.outputFields.includes('block_id') ? 'block_id' : step.outputFields[0]
    onChange(`{{steps.${stepName}.${field}}}`)
  }

  // Handle step output field change
  function handleFieldChange(field: string) {
    if (!stepRef) return
    onChange(`{{steps.${stepRef.stepName}.${field}}}`)
  }

  // Handle related record sub-field changes
  function handleRelatedSourceChange(source: string) {
    const ref = relatedRef ?? { source: 'triggering', edgeType: 'related_to', direction: 'outgoing' }
    onChange(`{{related:${source}:${ref.edgeType}:${ref.direction}}}`)
  }

  function handleRelatedEdgeTypeChange(edgeType: string) {
    const ref = relatedRef ?? { source: 'triggering', edgeType: 'related_to', direction: 'outgoing' }
    onChange(`{{related:${ref.source}:${edgeType}:${ref.direction}}}`)
  }

  function handleRelatedDirectionChange(direction: string) {
    const ref = relatedRef ?? { source: 'triggering', edgeType: 'related_to', direction: 'outgoing' }
    onChange(`{{related:${ref.source}:${ref.edgeType}:${direction}}}`)
  }

  // Related record source options: triggering record + any step outputs
  const relatedSourceOptions = useMemo(() => {
    const opts = [{ value: 'triggering', label: 'Triggering Record' }]
    for (const s of stepsWithOutputs) {
      if (s.outputFields.includes('block_id')) {
        opts.push({ value: `steps.${s.name}`, label: s.label })
      }
    }
    return opts
  }, [stepsWithOutputs])

  // Get output fields for the currently selected step
  const currentStepOutputFields = useMemo(() => {
    if (!stepRef) return []
    const step = stepsWithOutputs.find((s) => s.name === stepRef.stepName)
    return step?.outputFields ?? []
  }, [stepRef, stepsWithOutputs])

  const typeLabel = appliesToType
    ? appliesToType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'record'

  return (
    <div className="mb-3">
      {label && <FieldLabel htmlFor={id}>{label}</FieldLabel>}

      {/* Mode selector */}
      <div className="space-y-1.5">
        {/* Triggering Record */}
        <label className="flex items-start gap-2 cursor-pointer rounded-md border border-border p-2 hover:bg-muted/50 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
          <input
            type="radio"
            name={`${id}-mode`}
            value="triggering"
            checked={mode === 'triggering' || (mode === 'legacy_uuid' && false)}
            onChange={() => handleModeChange('triggering')}
            className="mt-0.5 shrink-0"
          />
          <div className="min-w-0">
            <span className="text-xs font-medium text-foreground">Triggering Record</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              The {typeLabel} that started this workflow
            </p>
          </div>
        </label>

        {/* From a Previous Step */}
        {stepsWithOutputs.length > 0 && (
          <label className="flex items-start gap-2 cursor-pointer rounded-md border border-border p-2 hover:bg-muted/50 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
            <input
              type="radio"
              name={`${id}-mode`}
              value="from_step"
              checked={mode === 'from_step'}
              onChange={() => handleModeChange('from_step')}
              className="mt-0.5 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <span className="text-xs font-medium text-foreground">From a Previous Step</span>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                A record created or found by an earlier step
              </p>
              {mode === 'from_step' && (
                <div className="mt-2 space-y-1.5">
                  <SelectInput
                    id={`${id}-step`}
                    value={stepRef?.stepName ?? ''}
                    onChange={handleStepChange}
                    options={stepsWithOutputs.map((s) => ({
                      value: s.name,
                      label: s.label,
                    }))}
                  />
                  {currentStepOutputFields.length > 1 && (
                    <SelectInput
                      id={`${id}-field`}
                      value={stepRef?.field ?? 'block_id'}
                      onChange={handleFieldChange}
                      options={currentStepOutputFields.map((f) => ({
                        value: f,
                        label: f.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                      }))}
                    />
                  )}
                </div>
              )}
            </div>
          </label>
        )}

        {/* Related Record */}
        <label className="flex items-start gap-2 cursor-pointer rounded-md border border-border p-2 hover:bg-muted/50 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
          <input
            type="radio"
            name={`${id}-mode`}
            value="related"
            checked={mode === 'related'}
            onChange={() => handleModeChange('related')}
            className="mt-0.5 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <span className="text-xs font-medium text-foreground">Related Record</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Follow a relationship edge to find a linked record
            </p>
            {mode === 'related' && (
              <div className="mt-2 space-y-1.5">
                <div>
                  <span className="text-[10px] font-medium text-muted-foreground">Starting from</span>
                  <SelectInput
                    id={`${id}-rel-source`}
                    value={relatedRef?.source ?? 'triggering'}
                    onChange={handleRelatedSourceChange}
                    options={relatedSourceOptions}
                  />
                </div>
                <div>
                  <span className="text-[10px] font-medium text-muted-foreground">Relationship</span>
                  <SelectInput
                    id={`${id}-rel-edge`}
                    value={relatedRef?.edgeType ?? 'related_to'}
                    onChange={handleRelatedEdgeTypeChange}
                    options={resolvedEdgeTypes}
                  />
                </div>
                <div>
                  <span className="text-[10px] font-medium text-muted-foreground">Direction</span>
                  <SelectInput
                    id={`${id}-rel-dir`}
                    value={relatedRef?.direction ?? 'outgoing'}
                    onChange={handleRelatedDirectionChange}
                    options={[
                      { value: 'outgoing', label: 'Outgoing (this record \u2192 target)' },
                      { value: 'incoming', label: 'Incoming (target \u2192 this record)' },
                    ]}
                  />
                </div>
              </div>
            )}
          </div>
        </label>

        {/* Legacy UUID warning */}
        {mode === 'legacy_uuid' && (
          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 p-2">
            <p className="text-[10px] font-medium text-amber-800 dark:text-amber-200">
              This references a specific record ({value.slice(0, 8)}...). Convert to a template reference so this workflow works for any record.
            </p>
            <button
              type="button"
              onClick={() => handleModeChange('triggering')}
              className="mt-1.5 text-[10px] font-medium text-amber-700 dark:text-amber-300 hover:underline"
            >
              Convert to Triggering Record
            </button>
          </div>
        )}
      </div>

      {/* Hint text */}
      {hint && (
        <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}
