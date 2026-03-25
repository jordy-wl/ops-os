'use client'

import { useState } from 'react'
import { X, Plus, Copy, Check } from 'lucide-react'
import { FieldLabel, TextInput, SelectInput, EntitySelect } from '../shared/form-primitives'
import { VariablePickerInput } from '../shared/variable-picker'
import { TemplateRecordPicker } from '../shared/template-record-picker'
import { ConditionBuilder, type ConditionValue } from '../shared/condition-builder'
import { ScheduleConfig, type ScheduleValue } from '../shared/schedule-config'
import { makeConfigUpdater } from '../types'
import type { NodeConfigProps } from '../types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRIGGER_TYPE_OPTIONS = [
  { value: 'manual', label: 'Manual Start' },
  { value: 'event', label: 'When Event Occurs' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'schedule', label: 'Schedule' },
]

const EVENT_TYPE_GROUPS = [
  {
    group: 'Record Events',
    events: [
      { value: 'block.created', label: 'Record Created' },
      { value: 'block.updated', label: 'Record Updated' },
      { value: 'block.status_changed', label: 'Status Changed' },
      { value: 'block.deleted', label: 'Record Deleted' },
      { value: 'block.assigned', label: 'Record Assigned' },
      { value: 'block.field_changed', label: 'Field Changed' },
    ],
  },
  {
    group: 'Workflow Events',
    events: [
      { value: 'workflow.instance.completed', label: 'Workflow Completed' },
      { value: 'workflow.instance.failed', label: 'Workflow Failed' },
      { value: 'workflow.step.completed', label: 'Step Completed' },
    ],
  },
  {
    group: 'Integration Events',
    events: [
      { value: 'webhook.received', label: 'Webhook Received' },
      { value: 'email.received', label: 'Email Received' },
      { value: 'file.uploaded', label: 'File Uploaded' },
    ],
  },
  {
    group: 'Portal Events',
    events: [
      { value: 'portal.form.submitted', label: 'Form Submitted via Portal' },
      { value: 'portal.request.submitted', label: 'Request Submitted via Portal' },
      { value: 'portal_config.created', label: 'Portal Created' },
      { value: 'portal_config.deactivated', label: 'Portal Deactivated' },
    ],
  },
  {
    group: 'System Events',
    events: [{ value: 'custom', label: 'Custom Event' }],
  },
]

/** Flattened event options with group prefix for the SelectInput dropdown */
const EVENT_TYPE_OPTIONS = EVENT_TYPE_GROUPS.flatMap((g) =>
  g.events.map((e) => ({
    value: e.value,
    label: `${g.group.replace(' Events', '')}: ${e.label}`,
  })),
)

const EVENT_SCOPE_OPTIONS = [
  { value: 'all', label: 'All records' },
  { value: 'filter', label: 'Records matching filters' },
  { value: 'specific', label: 'Specific record' },
]

const PAYLOAD_FIELD_TYPE_OPTIONS = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'object', label: 'Object' },
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WebhookPayloadField {
  name: string
  type: string
}

// ---------------------------------------------------------------------------
// Default condition value for the filter builder
// ---------------------------------------------------------------------------

const DEFAULT_CONDITION_VALUE: ConditionValue = {
  mode: 'simple',
  simple: { field: '', operator: 'is', value: '' },
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ManualTriggerInfo() {
  return (
    <p className="text-sm text-muted-foreground py-2">
      No configuration needed &mdash; this workflow is started manually.
    </p>
  )
}

function EventTriggerConfig({
  eventPattern,
  eventScope,
  eventFilters,
  eventSpecificBlockId,
  onUpdateConfig,
  previousSteps,
}: {
  eventPattern: string
  eventScope: string
  eventFilters: ConditionValue
  eventSpecificBlockId: string
  onUpdateConfig: (field: string, value: unknown) => void
  previousSteps?: import('../shared/template-record-picker').PreviousStep[]
}) {
  return (
    <div className="space-y-3">
      {/* Event type selector */}
      <div>
        <FieldLabel htmlFor="event-pattern">Event Type</FieldLabel>
        <SelectInput
          id="event-pattern"
          value={eventPattern}
          onChange={(v) => onUpdateConfig('event_pattern', v)}
          options={[{ value: '', label: 'Select an event...' }, ...EVENT_TYPE_OPTIONS]}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          The event that starts this workflow
        </p>
      </div>

      {/* Event scope */}
      <div>
        <FieldLabel htmlFor="event-scope">Event Scope</FieldLabel>
        <SelectInput
          id="event-scope"
          value={eventScope}
          onChange={(v) => onUpdateConfig('event_scope', v)}
          options={EVENT_SCOPE_OPTIONS}
        />
      </div>

      {/* Conditional: filter builder */}
      {eventScope === 'filter' && (
        <div>
          <FieldLabel htmlFor="event-filters">Filter Conditions</FieldLabel>
          <ConditionBuilder
            value={eventFilters}
            onChange={(v) => onUpdateConfig('event_filters', v)}
          />
        </div>
      )}

      {/* Conditional: specific record reference */}
      {eventScope === 'specific' && (
        <div>
          <TemplateRecordPicker
            id="event-specific-block-id"
            value={eventSpecificBlockId || '{{context.source_block_id}}'}
            onChange={(v) => onUpdateConfig('event_specific_block_id', v)}
            label="Specific Record"
            previousSteps={previousSteps}
            defaultToTriggering
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Only events on this record will trigger the workflow
          </p>
        </div>
      )}
    </div>
  )
}

function WebhookTriggerConfig({
  connectorId,
  connectorOptions,
  payloadFields,
  onUpdateConfig,
}: {
  connectorId: string
  connectorOptions: { value: string; label: string }[]
  payloadFields: WebhookPayloadField[]
  onUpdateConfig: (field: string, value: unknown) => void
}) {
  const [copied, setCopied] = useState(false)
  const webhookUrl = connectorId
    ? `/api/webhooks/${connectorId}`
    : '/api/webhooks/{connector_id}'

  function handleCopy() {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function addPayloadField() {
    onUpdateConfig('webhook_payload_fields', [
      ...payloadFields,
      { name: '', type: 'string' },
    ])
  }

  function removePayloadField(index: number) {
    const next = payloadFields.filter((_, i) => i !== index)
    onUpdateConfig('webhook_payload_fields', next)
  }

  function updatePayloadField(
    index: number,
    field: keyof WebhookPayloadField,
    value: string,
  ) {
    const next = payloadFields.map((pf, i) =>
      i === index ? { ...pf, [field]: value } : pf,
    )
    onUpdateConfig('webhook_payload_fields', next)
  }

  return (
    <div className="space-y-3">
      {/* Connector dropdown */}
      <div>
        <FieldLabel htmlFor="webhook-connector">Integration</FieldLabel>
        {connectorOptions.length > 0 ? (
          <EntitySelect
            id="webhook-connector"
            value={connectorId}
            onChange={(v) => onUpdateConfig('connector_id', v)}
            options={connectorOptions}
            placeholder="Select integration..."
            allowFreeText
          />
        ) : (
          <TextInput
            id="webhook-connector"
            value={connectorId}
            onChange={(v) => onUpdateConfig('connector_id', v)}
            placeholder="Integration connector ID"
          />
        )}
      </div>

      {/* Webhook URL with copy */}
      <div>
        <FieldLabel htmlFor="webhook-url">Webhook URL</FieldLabel>
        <div className="flex items-center gap-2">
          <input
            id="webhook-url"
            type="text"
            readOnly
            value={webhookUrl}
            className="flex-1 rounded-md border border-border bg-muted px-2.5 py-1.5 text-sm text-muted-foreground focus:outline-none"
            aria-label="Webhook URL"
          />
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy webhook URL"
            className="flex items-center justify-center rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Send POST requests to this URL to trigger the workflow
        </p>
      </div>

      {/* Expected payload schema */}
      <div>
        <FieldLabel htmlFor="webhook-payload">Expected Payload</FieldLabel>
        <div className="space-y-2">
          {payloadFields.map((pf, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <TextInput
                  id={`payload-name-${i}`}
                  value={pf.name}
                  onChange={(v) => updatePayloadField(i, 'name', v)}
                  placeholder="Field name"
                />
              </div>
              <div className="w-28">
                <SelectInput
                  id={`payload-type-${i}`}
                  value={pf.type}
                  onChange={(v) => updatePayloadField(i, 'type', v)}
                  options={PAYLOAD_FIELD_TYPE_OPTIONS}
                />
              </div>
              <button
                type="button"
                onClick={() => removePayloadField(i)}
                aria-label={`Remove payload field ${pf.name || i + 1}`}
                className="mt-1 p-1 text-muted-foreground hover:text-destructive rounded transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addPayloadField}
          className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-3 w-3" />
          Add field
        </button>
      </div>
    </div>
  )
}

function ScheduleTriggerConfig({
  scheduleValue,
  onUpdateConfig,
}: {
  scheduleValue: ScheduleValue
  onUpdateConfig: (field: string, value: unknown) => void
}) {
  return (
    <ScheduleConfig
      value={scheduleValue}
      onChange={(v) => onUpdateConfig('schedule_value', v)}
    />
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TriggerConfig({ node, onUpdate, entities, previousSteps }: NodeConfigProps) {
  const { config, updateConfig } = makeConfigUpdater(node, onUpdate)

  const triggerType = (config.triggerType as string) ?? 'manual'
  const eventPattern = (config.event_pattern as string) ?? ''
  const eventScope = (config.event_scope as string) ?? 'all'
  const eventFilters = (config.event_filters as ConditionValue) ?? DEFAULT_CONDITION_VALUE
  const eventSpecificBlockId = (config.event_specific_block_id as string) ?? ''
  const connectorId = (config.connector_id as string) ?? ''
  const payloadFields = (config.webhook_payload_fields as WebhookPayloadField[]) ?? []
  const scheduleValue = (config.schedule_value as ScheduleValue) ?? {}

  const connectorOptions = (entities?.connectors ?? [])
    .filter((c) => c.status === 'active')
    .map((c) => ({ value: c.id, label: c.label }))

  return (
    <>
      {/* Trigger type selector */}
      <div className="mb-3">
        <FieldLabel htmlFor="trigger-type">Trigger Type</FieldLabel>
        <SelectInput
          id="trigger-type"
          value={triggerType}
          onChange={(v) => updateConfig('triggerType', v)}
          options={TRIGGER_TYPE_OPTIONS}
        />
      </div>

      {/* Manual */}
      {triggerType === 'manual' && <ManualTriggerInfo />}

      {/* Event */}
      {triggerType === 'event' && (
        <EventTriggerConfig
          eventPattern={eventPattern}
          eventScope={eventScope}
          eventFilters={eventFilters}
          eventSpecificBlockId={eventSpecificBlockId}
          onUpdateConfig={updateConfig}
          previousSteps={previousSteps}
        />
      )}

      {/* Webhook */}
      {triggerType === 'webhook' && (
        <WebhookTriggerConfig
          connectorId={connectorId}
          connectorOptions={connectorOptions}
          payloadFields={payloadFields}
          onUpdateConfig={updateConfig}
        />
      )}

      {/* Schedule */}
      {triggerType === 'schedule' && (
        <ScheduleTriggerConfig
          scheduleValue={scheduleValue}
          onUpdateConfig={updateConfig}
        />
      )}
    </>
  )
}
