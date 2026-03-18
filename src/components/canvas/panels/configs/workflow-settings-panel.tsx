'use client'

import { useId } from 'react'
import { FieldLabel, SelectInput, TextInput } from '../shared/form-primitives'
import { DurationPicker } from '../shared/duration-picker'

interface WorkflowSettings {
  completion_behavior?: string
  completion_delay_seconds?: number
  completion_trigger_template_id?: string
}

interface WorkflowSettingsPanelProps {
  settings: WorkflowSettings
  onUpdate: (settings: WorkflowSettings) => void
}

const COMPLETION_OPTIONS: { value: string; label: string }[] = [
  { value: 'none', label: 'Do nothing' },
  { value: 'restart_after_delay', label: 'Restart after delay' },
  { value: 'trigger_workflow', label: 'Trigger another workflow' },
]

export function WorkflowSettingsPanel({ settings, onUpdate }: WorkflowSettingsPanelProps) {
  const reactId = useId()
  const behavior = settings.completion_behavior ?? 'none'

  function handleBehaviorChange(value: string) {
    const next: WorkflowSettings = { ...settings, completion_behavior: value }

    // Clear irrelevant fields when switching behavior
    if (value !== 'restart_after_delay') {
      delete next.completion_delay_seconds
    }
    if (value !== 'trigger_workflow') {
      delete next.completion_trigger_template_id
    }

    // Set sensible default when switching to restart
    if (value === 'restart_after_delay' && !next.completion_delay_seconds) {
      next.completion_delay_seconds = 3600
    }

    onUpdate(next)
  }

  function handleDelayChange(seconds: number) {
    onUpdate({ ...settings, completion_delay_seconds: seconds })
  }

  function handleTemplateIdChange(value: string) {
    onUpdate({ ...settings, completion_trigger_template_id: value || undefined })
  }

  return (
    <div className="space-y-3">
      <div>
        <FieldLabel htmlFor={`${reactId}-completion-behavior`}>
          When this workflow completes
        </FieldLabel>
        <SelectInput
          id={`${reactId}-completion-behavior`}
          value={behavior}
          onChange={handleBehaviorChange}
          options={COMPLETION_OPTIONS}
        />
      </div>

      {behavior === 'restart_after_delay' && (
        <DurationPicker
          label="Restart delay"
          value={settings.completion_delay_seconds ?? 3600}
          onChange={handleDelayChange}
        />
      )}

      {behavior === 'trigger_workflow' && (
        <div>
          <FieldLabel htmlFor={`${reactId}-trigger-template`}>
            Workflow to trigger
          </FieldLabel>
          <TextInput
            id={`${reactId}-trigger-template`}
            value={settings.completion_trigger_template_id ?? ''}
            onChange={handleTemplateIdChange}
            placeholder="Enter workflow template ID"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Paste a workflow template ID. A searchable dropdown will be available once org entities are wired in.
          </p>
        </div>
      )}
    </div>
  )
}
