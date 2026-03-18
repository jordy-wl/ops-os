'use client'

import type { NodeConfigProps } from '../types'
import { FieldLabel, SelectInput, TextInput } from '../shared/form-primitives'

const OUTPUT_TYPE_OPTIONS = [
  { value: 'update_fields', label: 'Save to Record' },
  { value: 'api_call', label: 'Send to External System' },
  { value: 'emit_event', label: 'Log Completion Activity' },
]

export function OutputConfig({ node, onUpdate }: Pick<NodeConfigProps, 'node' | 'onUpdate'>) {
  const data = node.data as Record<string, unknown>
  const config = (data.config ?? {}) as Record<string, unknown>

  function updateConfig(field: string, value: unknown) {
    onUpdate(node.id, { ...data, config: { ...config, [field]: value } })
  }

  return (
    <>
      <div className="mb-3">
        <FieldLabel htmlFor="output-type">Output Type</FieldLabel>
        <SelectInput
          id="output-type"
          value={(config.output_type as string) ?? 'update_fields'}
          onChange={(v) => updateConfig('output_type', v)}
          options={OUTPUT_TYPE_OPTIONS}
        />
      </div>
      {config.output_type === 'api_call' && (
        <>
          <div className="mb-3">
            <FieldLabel htmlFor="output-method">HTTP Method</FieldLabel>
            <SelectInput
              id="output-method"
              value={(config.method as string) ?? 'POST'}
              onChange={(v) => updateConfig('method', v)}
              options={[
                { value: 'GET', label: 'GET' },
                { value: 'POST', label: 'POST' },
                { value: 'PUT', label: 'PUT' },
                { value: 'PATCH', label: 'PATCH' },
              ]}
            />
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="output-endpoint">Endpoint</FieldLabel>
            <TextInput
              id="output-endpoint"
              value={(config.endpoint as string) ?? ''}
              onChange={(v) => updateConfig('endpoint', v)}
              placeholder="https://api.example.com/resource"
            />
          </div>
        </>
      )}
      <div className="mb-3">
        <FieldLabel htmlFor="output-description">Description</FieldLabel>
        <textarea
          id="output-description"
          value={(config.description as string) ?? ''}
          onChange={(e) => updateConfig('description', e.target.value)}
          placeholder="Describe what data this workflow produces..."
          rows={3}
          className="w-full rounded-md border border-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
        />
      </div>
    </>
  )
}
