'use client'

import type { NodeConfigProps } from '../types'
import { FieldLabel, TextInput } from '../shared/form-primitives'

export function ConditionConfig({ node, onUpdate }: Pick<NodeConfigProps, 'node' | 'onUpdate'>) {
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
        <FieldLabel htmlFor="cond-name">Step Name</FieldLabel>
        <TextInput
          id="cond-name"
          value={(data.stepName as string) ?? ''}
          onChange={(v) => updateData('stepName', v)}
          placeholder="e.g. check_status"
        />
      </div>
      <div className="mb-3">
        <FieldLabel htmlFor="cond-expression">Condition Expression</FieldLabel>
        <TextInput
          id="cond-expression"
          value={(config.condition as string) ?? ''}
          onChange={(v) => updateConfig('condition', v)}
          placeholder="e.g. block.metadata.status === 'approved'"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          True branch goes left, false goes right.
        </p>
      </div>
    </>
  )
}
