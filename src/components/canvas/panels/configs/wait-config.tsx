'use client'

import type { NodeConfigProps } from '../types'
import { FieldLabel, TextInput } from '../shared/form-primitives'
import { DurationPicker } from '../shared/duration-picker'

export function WaitConfig({ node, onUpdate }: Pick<NodeConfigProps, 'node' | 'onUpdate'>) {
  const data = node.data as Record<string, unknown>
  const config = (data.config ?? {}) as Record<string, unknown>

  function updateData(field: string, value: unknown) {
    onUpdate(node.id, { ...data, [field]: value })
  }

  function updateConfig(field: string, value: unknown) {
    onUpdate(node.id, { ...data, config: { ...config, [field]: value } })
  }

  return (
    <>
      <div className="mb-3">
        <FieldLabel htmlFor="wait-name">Step Name</FieldLabel>
        <TextInput
          id="wait-name"
          value={(data.stepName as string) ?? ''}
          onChange={(v) => updateData('stepName', v)}
          placeholder="e.g. wait_for_approval"
        />
      </div>
      <div className="mb-3">
        <DurationPicker
          value={(config.wait_seconds as number) ?? 60}
          onChange={(seconds) => updateConfig('wait_seconds', seconds)}
          label="Wait Duration"
        />
      </div>
    </>
  )
}
