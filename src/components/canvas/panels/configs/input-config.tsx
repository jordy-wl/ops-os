'use client'

import type { NodeConfigProps } from '../types'
import { FieldLabel, SelectInput, TextInput } from '../shared/form-primitives'

const SOURCE_TYPE_OPTIONS = [
  { value: 'block_fields', label: 'Block Fields' },
  { value: 'webhook', label: 'Webhook Payload' },
  { value: 'api', label: 'API Request' },
]

export function InputConfig({ node, onUpdate }: Pick<NodeConfigProps, 'node' | 'onUpdate'>) {
  const data = node.data as Record<string, unknown>
  const config = (data.config ?? {}) as Record<string, unknown>

  function updateConfig(field: string, value: unknown) {
    onUpdate(node.id, { ...data, config: { ...config, [field]: value } })
  }

  return (
    <>
      <div className="mb-3">
        <FieldLabel htmlFor="source-type">Source Type</FieldLabel>
        <SelectInput
          id="source-type"
          value={(config.source_type as string) ?? 'block_fields'}
          onChange={(v) => updateConfig('source_type', v)}
          options={SOURCE_TYPE_OPTIONS}
        />
      </div>
      {config.source_type === 'webhook' && (
        <div className="mb-3">
          <FieldLabel htmlFor="input-endpoint">Webhook Path</FieldLabel>
          <TextInput
            id="input-endpoint"
            value={(config.endpoint as string) ?? ''}
            onChange={(v) => updateConfig('endpoint', v)}
            placeholder="/webhooks/my-trigger"
          />
        </div>
      )}
      {config.source_type === 'api' && (
        <div className="mb-3">
          <FieldLabel htmlFor="input-api-path">API Endpoint</FieldLabel>
          <TextInput
            id="input-api-path"
            value={(config.endpoint as string) ?? ''}
            onChange={(v) => updateConfig('endpoint', v)}
            placeholder="/api/external/ingest"
          />
        </div>
      )}
      <div className="mb-3">
        <FieldLabel htmlFor="input-description">Description</FieldLabel>
        <textarea
          id="input-description"
          value={(config.description as string) ?? ''}
          onChange={(e) => updateConfig('description', e.target.value)}
          placeholder="Describe what data enters the workflow..."
          rows={3}
          className="w-full rounded-md border border-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
        />
      </div>
    </>
  )
}
