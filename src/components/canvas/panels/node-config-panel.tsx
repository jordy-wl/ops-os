'use client'

import { X } from 'lucide-react'
import type { Node } from '@xyflow/react'

interface NodeConfigPanelProps {
  node: Node
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void
  onClose: () => void
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-gray-700 mb-1">
      {children}
    </label>
  )
}

function TextInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <input
      id={id}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
    />
  )
}

function SelectInput({
  id,
  value,
  onChange,
  options,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

function NumberInput({
  id,
  value,
  onChange,
  min,
  placeholder,
}: {
  id: string
  value: number
  onChange: (v: number) => void
  min?: number
  placeholder?: string
}) {
  return (
    <input
      id={id}
      type="number"
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value) || 0)}
      min={min}
      placeholder={placeholder}
      className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
    />
  )
}

// ─── Trigger Config ─────────────────────────────────────────────────────────

function TriggerConfig({ node, onUpdate }: Pick<NodeConfigPanelProps, 'node' | 'onUpdate'>) {
  const data = node.data as Record<string, unknown>
  const config = (data.config ?? {}) as Record<string, unknown>
  const triggerType = (config.triggerType as string) ?? 'manual'
  const eventPattern = (config.event_pattern as string) ?? ''

  function update(field: string, value: unknown) {
    onUpdate(node.id, {
      ...data,
      config: { ...config, [field]: value },
    })
  }

  return (
    <>
      <div className="mb-3">
        <FieldLabel htmlFor="trigger-type">Trigger Type</FieldLabel>
        <SelectInput
          id="trigger-type"
          value={triggerType}
          onChange={(v) => update('triggerType', v)}
          options={[
            { value: 'manual', label: 'Manual Start' },
            { value: 'event', label: 'Event Trigger' },
            { value: 'webhook', label: 'Webhook' },
          ]}
        />
      </div>
      {triggerType === 'event' && (
        <div className="mb-3">
          <FieldLabel htmlFor="event-pattern">Event Pattern</FieldLabel>
          <TextInput
            id="event-pattern"
            value={eventPattern}
            onChange={(v) => update('event_pattern', v)}
            placeholder="e.g. block.created"
          />
        </div>
      )}
      {triggerType === 'webhook' && (
        <div className="mb-3">
          <FieldLabel htmlFor="connector-id">Connector ID</FieldLabel>
          <TextInput
            id="connector-id"
            value={(config.connector_id as string) ?? ''}
            onChange={(v) => update('connector_id', v)}
            placeholder="UUID of integration connector"
          />
        </div>
      )}
    </>
  )
}

// ─── Action Config ──────────────────────────────────────────────────────────

function ActionConfig({ node, onUpdate }: Pick<NodeConfigPanelProps, 'node' | 'onUpdate'>) {
  const data = node.data as Record<string, unknown>
  const config = (data.config ?? {}) as Record<string, unknown>
  const stepType = (data.stepType as string) ?? 'emit_event'

  function updateData(field: string, value: unknown) {
    onUpdate(node.id, { ...data, [field]: value })
  }

  function updateConfig(field: string, value: unknown) {
    onUpdate(node.id, { ...data, config: { ...config, [field]: value } })
  }

  return (
    <>
      <div className="mb-3">
        <FieldLabel htmlFor="step-name">Step Name</FieldLabel>
        <TextInput
          id="step-name"
          value={(data.stepName as string) ?? ''}
          onChange={(v) => updateData('stepName', v)}
          placeholder="e.g. notify_team"
        />
      </div>
      <div className="mb-3">
        <FieldLabel htmlFor="step-type">Action Type</FieldLabel>
        <SelectInput
          id="step-type"
          value={stepType}
          onChange={(v) => updateData('stepType', v)}
          options={[
            { value: 'emit_event', label: 'Emit Event' },
            { value: 'run_action', label: 'Run Action' },
            { value: 'call_api', label: 'Call API' },
            { value: 'send_email', label: 'Send Email' },
            { value: 'generate_document', label: 'Generate Document' },
            { value: 'book_meeting', label: 'Book Meeting' },
          ]}
        />
      </div>

      {stepType === 'emit_event' && (
        <div className="mb-3">
          <FieldLabel htmlFor="event-type">Event Type</FieldLabel>
          <TextInput
            id="event-type"
            value={(config.event_type as string) ?? ''}
            onChange={(v) => updateConfig('event_type', v)}
            placeholder="e.g. onboarding.started"
          />
        </div>
      )}
      {stepType === 'run_action' && (
        <div className="mb-3">
          <FieldLabel htmlFor="action-type">Action Type</FieldLabel>
          <TextInput
            id="action-type"
            value={(config.action_type as string) ?? ''}
            onChange={(v) => updateConfig('action_type', v)}
            placeholder="e.g. block.create"
          />
        </div>
      )}
      {stepType === 'call_api' && (
        <>
          <div className="mb-3">
            <FieldLabel htmlFor="api-connector">Connector ID</FieldLabel>
            <TextInput
              id="api-connector"
              value={(config.connector_id as string) ?? ''}
              onChange={(v) => updateConfig('connector_id', v)}
              placeholder="UUID of integration connector"
            />
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="api-method">HTTP Method</FieldLabel>
            <SelectInput
              id="api-method"
              value={(config.method as string) ?? 'POST'}
              onChange={(v) => updateConfig('method', v)}
              options={[
                { value: 'GET', label: 'GET' },
                { value: 'POST', label: 'POST' },
                { value: 'PUT', label: 'PUT' },
                { value: 'PATCH', label: 'PATCH' },
                { value: 'DELETE', label: 'DELETE' },
              ]}
            />
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="api-path">Path</FieldLabel>
            <TextInput
              id="api-path"
              value={(config.path as string) ?? ''}
              onChange={(v) => updateConfig('path', v)}
              placeholder="/api/resource"
            />
          </div>
        </>
      )}
      {stepType === 'send_email' && (
        <>
          <div className="mb-3">
            <FieldLabel htmlFor="email-connector">Google Connector ID</FieldLabel>
            <TextInput
              id="email-connector"
              value={(config.connector_id as string) ?? ''}
              onChange={(v) => updateConfig('connector_id', v)}
              placeholder="UUID of Google connector"
            />
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="email-to">To</FieldLabel>
            <TextInput
              id="email-to"
              value={(config.to as string) ?? ''}
              onChange={(v) => updateConfig('to', v)}
              placeholder="recipient@example.com"
            />
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="email-subject">Subject</FieldLabel>
            <TextInput
              id="email-subject"
              value={(config.subject as string) ?? ''}
              onChange={(v) => updateConfig('subject', v)}
              placeholder="Email subject"
            />
          </div>
        </>
      )}
      {stepType === 'book_meeting' && (
        <>
          <div className="mb-3">
            <FieldLabel htmlFor="meeting-connector">Google Connector ID</FieldLabel>
            <TextInput
              id="meeting-connector"
              value={(config.connector_id as string) ?? ''}
              onChange={(v) => updateConfig('connector_id', v)}
              placeholder="UUID of Google connector"
            />
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="meeting-title">Meeting Title</FieldLabel>
            <TextInput
              id="meeting-title"
              value={(config.title as string) ?? ''}
              onChange={(v) => updateConfig('title', v)}
              placeholder="Meeting title"
            />
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="meeting-attendees">Attendees</FieldLabel>
            <TextInput
              id="meeting-attendees"
              value={(config.attendees as string) ?? ''}
              onChange={(v) => updateConfig('attendees', v)}
              placeholder="Comma-separated emails"
            />
          </div>
        </>
      )}
    </>
  )
}

// ─── Condition Config ───────────────────────────────────────────────────────

function ConditionConfig({ node, onUpdate }: Pick<NodeConfigPanelProps, 'node' | 'onUpdate'>) {
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
        <p className="mt-1 text-xs text-gray-400">
          True branch goes left, false goes right.
        </p>
      </div>
    </>
  )
}

// ─── Wait Config ────────────────────────────────────────────────────────────

function WaitConfig({ node, onUpdate }: Pick<NodeConfigPanelProps, 'node' | 'onUpdate'>) {
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
        <FieldLabel htmlFor="wait-seconds">Wait Duration (seconds)</FieldLabel>
        <NumberInput
          id="wait-seconds"
          value={(config.wait_seconds as number) ?? 60}
          onChange={(v) => updateConfig('wait_seconds', v)}
          min={1}
        />
        <p className="mt-1 text-xs text-gray-400">
          {formatDuration((config.wait_seconds as number) ?? 60)}
        </p>
      </div>
    </>
  )
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

// ─── Main Config Panel ──────────────────────────────────────────────────────

const NODE_TYPE_LABELS: Record<string, string> = {
  trigger: 'Trigger',
  action: 'Action',
  condition: 'Condition',
  wait: 'Wait / Delay',
}

export function NodeConfigPanel({ node, onUpdate, onClose }: NodeConfigPanelProps) {
  const nodeType = node.type ?? 'action'
  const data = node.data as Record<string, unknown>

  return (
    <div className="w-64 border-l bg-white flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div>
          <h3 className="text-xs font-semibold text-gray-900">
            {NODE_TYPE_LABELS[nodeType] ?? 'Node'} Config
          </h3>
          <p className="text-xs text-gray-400 truncate mt-0.5" title={node.id}>
            {(data.label as string) ?? node.id}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
          aria-label="Close config panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Config fields */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {/* Label field (common to all) */}
        <div className="mb-3">
          <FieldLabel htmlFor="node-label">Label</FieldLabel>
          <TextInput
            id="node-label"
            value={(data.label as string) ?? ''}
            onChange={(v) => onUpdate(node.id, { ...data, label: v })}
            placeholder="Node label"
          />
        </div>

        {/* Type-specific config */}
        {nodeType === 'trigger' && <TriggerConfig node={node} onUpdate={onUpdate} />}
        {nodeType === 'action' && <ActionConfig node={node} onUpdate={onUpdate} />}
        {nodeType === 'condition' && <ConditionConfig node={node} onUpdate={onUpdate} />}
        {nodeType === 'wait' && <WaitConfig node={node} onUpdate={onUpdate} />}
      </div>
    </div>
  )
}
