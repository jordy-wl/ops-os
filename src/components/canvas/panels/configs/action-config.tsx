'use client'

import { useState, useMemo, useEffect } from 'react'
import type { NodeConfigProps } from '../types'
import { makeConfigUpdater } from '../types'
import {
  FieldLabel,
  TextInput,
  TextArea,
  SelectInput,
  EntitySelect,
  NumberInput,
  CheckboxInput,
} from '../shared/form-primitives'
import { DurationPicker } from '../shared/duration-picker'
import { RoutingSection } from '../shared/routing-section'
import { AITemplatePicker, type SaveResultDestination } from '../shared/ai-template-picker'
import { getTemplatesForProvider, type ConnectorTemplate } from '@/lib/workflow/connector-templates'
import { VariablePickerInput } from '../shared/variable-picker'

// ─── Action Type Options ─────────────────────────────────────────────────────

const ACTION_TYPE_OPTIONS = [
  { value: 'emit_event', label: 'Log Activity' },
  { value: 'run_action', label: 'Run Action' },
  { value: 'call_api', label: 'Call External API' },
  { value: 'send_email', label: 'Send Email' },
  { value: 'generate_document', label: 'Generate Document' },
  { value: 'book_meeting', label: 'Book Meeting' },
  { value: 'update_block', label: 'Update Record' },
  { value: 'run_sub_workflow', label: 'Run Sub-Workflow' },
]

// ─── Portal Config Selector (sub-component) ─────────────────────────────────

function PortalConfigSelector({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (v: string) => void
}) {
  const [options, setOptions] = useState<{ value: string; label: string }[]>([])

  useEffect(() => {
    fetch('/api/portal-configs')
      .then((r) => r.json())
      .then((data) => {
        const configs = Array.isArray(data) ? data : data.data ?? []
        setOptions(
          configs.map((c: Record<string, unknown>) => ({
            value: c.id as string,
            label: c.name as string,
          }))
        )
      })
      .catch(() => {})
  }, [])

  return (
    <EntitySelect
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      placeholder="Select a portal..."
    />
  )
}

// ─── Update Block Config (sub-component) ─────────────────────────────────────

const RECORD_TARGET_OPTIONS = [
  { value: 'triggering_record', label: 'Triggering Record' },
  { value: 'different_record', label: 'A different record' },
  { value: 'related_record', label: 'A related record' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'Select status...' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
]

function UpdateBlockConfig({ node, onUpdate, entities }: NodeConfigProps) {
  const { config } = makeConfigUpdater(node, onUpdate)
  const fields = (config.fields ?? {}) as Record<string, string>
  const fieldEntries = Object.entries(fields)

  const data = node.data as Record<string, unknown>
  const label = (data.label as string) ?? ''
  const isChangeStatus = label.toLowerCase().includes('change status') || label.toLowerCase().includes('status')

  // Determine record target mode
  const recordTarget = (config.record_target as string) ?? 'triggering_record'

  function updateConfig(field: string, value: unknown) {
    onUpdate(node.id, { ...data, config: { ...config, [field]: value } })
  }

  function setField(key: string, value: string) {
    updateConfig('fields', { ...fields, [key]: value })
  }

  function removeField(key: string) {
    const next = { ...fields }
    delete next[key]
    updateConfig('fields', next)
  }

  function addField() {
    const key = `field_${fieldEntries.length + 1}`
    updateConfig('fields', { ...fields, [key]: '' })
  }

  function renameField(oldKey: string, newKey: string) {
    if (newKey === oldKey || !newKey.trim()) return
    const next: Record<string, string> = {}
    for (const [k, v] of Object.entries(fields)) {
      next[k === oldKey ? newKey.trim() : k] = v
    }
    updateConfig('fields', next)
  }

  return (
    <>
      {/* Which record? */}
      <div className="mb-3">
        <FieldLabel htmlFor="ub-record-target">Which record?</FieldLabel>
        <SelectInput
          id="ub-record-target"
          value={recordTarget}
          onChange={(v) => {
            updateConfig('record_target', v)
            if (v === 'triggering_record') {
              updateConfig('block_id', '{{context.source_block_id}}')
            }
          }}
          options={RECORD_TARGET_OPTIONS}
        />
      </div>

      {/* Show block picker only when targeting a different or related record */}
      {recordTarget !== 'triggering_record' && (
        <div className="mb-3">
          <FieldLabel htmlFor="ub-block-id">Target Record</FieldLabel>
          {(entities?.blocks ?? []).length > 0 ? (
            <EntitySelect
              id="ub-block-id"
              value={(config.block_id as string) ?? ''}
              onChange={(v) => updateConfig('block_id', v)}
              options={(entities?.blocks ?? []).map((b) => ({ value: b.id, label: `${b.name} (${b.type})` }))}
              placeholder="Select target record..."
              allowFreeText
            />
          ) : (
            <TextInput
              id="ub-block-id"
              value={(config.block_id as string) ?? ''}
              onChange={(v) => updateConfig('block_id', v)}
              placeholder="UUID or {{variable}}"
            />
          )}
          {recordTarget === 'related_record' && (
            <p className="mt-1 text-xs text-muted-foreground">
              Pick a record linked to the triggering record
            </p>
          )}
        </div>
      )}

      {/* Change Status mode: show status dropdown */}
      {isChangeStatus && (
        <div className="mb-3">
          <FieldLabel htmlFor="ub-status">New Status</FieldLabel>
          <SelectInput
            id="ub-status"
            value={(config.new_status as string) ?? ''}
            onChange={(v) => updateConfig('new_status', v)}
            options={STATUS_OPTIONS}
          />
        </div>
      )}

      {/* Field updates */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-foreground">Fields to Update</span>
          <button
            type="button"
            onClick={addField}
            className="text-xs text-blue-700 hover:underline"
          >
            + Add field
          </button>
        </div>
        {fieldEntries.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No fields configured yet.</p>
        )}
        <div className="space-y-2">
          {fieldEntries.map(([key, val]) => (
            <div key={key} className="rounded border border-border p-2 bg-muted">
              <div className="flex items-center gap-1 mb-1">
                <input
                  type="text"
                  defaultValue={key}
                  onBlur={(e) => renameField(key, e.target.value)}
                  className="flex-1 rounded border border-border px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="field name"
                />
                <button
                  type="button"
                  onClick={() => removeField(key)}
                  className="text-xs text-destructive hover:text-destructive/80 px-1"
                  aria-label={`Remove field ${key}`}
                >
                  x
                </button>
              </div>
              <input
                type="text"
                value={val}
                onChange={(e) => setField(key, e.target.value)}
                className="w-full rounded border border-border px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="value or {{block.field_name}}"
              />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ─── Request Preview (B14) ───────────────────────────────────────────────────

/** Sample data used to preview template variable interpolation */
const SAMPLE_BLOCK: Record<string, string> = {
  name: 'Acme Corp',
  email: 'contact@acme.com',
  status: 'active',
  type: 'client',
  value: '50000',
  xero_contact_id: 'XC-001',
  hubspot_id: 'HS-001',
}

function interpolatePreview(template: string): string {
  return template.replace(/\{\{(\w+)\.(\w+)\}\}/g, (_match, _ns, key) => {
    return SAMPLE_BLOCK[key] ?? `[${key}]`
  })
}

function RequestPreview({
  method,
  path,
  bodyTemplate,
  connectorLabel,
  provider,
}: {
  method: string
  path: string
  bodyTemplate: string
  connectorLabel: string
  provider: string
}) {
  const [expanded, setExpanded] = useState(false)

  const hasConfig = path.trim().length > 0

  if (!hasConfig) return null

  const baseUrl = provider
    ? `https://api.${provider}.com`
    : 'https://your-service.com'
  const previewUrl = `${baseUrl}${interpolatePreview(path)}`
  const previewBody = bodyTemplate ? interpolatePreview(bodyTemplate) : ''

  // Try to pretty-print JSON body
  let formattedBody = previewBody
  if (previewBody) {
    try {
      formattedBody = JSON.stringify(JSON.parse(previewBody), null, 2)
    } catch {
      // Not valid JSON — show raw
    }
  }

  return (
    <div className="mb-3 rounded-md border border-border">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>Preview Request</span>
        <span className="text-xs">{expanded ? '−' : '+'}</span>
      </button>
      {expanded && (
        <div className="border-t px-3 py-2 space-y-2">
          <div>
            <span className="text-xs font-semibold text-foreground">{method}</span>
            <span className="ml-2 text-xs text-muted-foreground break-all">{previewUrl}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Headers</p>
            <pre className="bg-muted rounded px-2 py-1 text-xs overflow-x-auto whitespace-pre-wrap">
{`Content-Type: application/json
Authorization: Bearer [${connectorLabel || 'token'}]`}
            </pre>
          </div>
          {formattedBody && (
            <div className="text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Body</p>
              <pre className="bg-muted rounded px-2 py-1 text-xs overflow-x-auto whitespace-pre-wrap">
                {formattedBody}
              </pre>
            </div>
          )}
          <p className="text-xs text-muted-foreground italic">
            Template variables shown with sample data. Actual values will be resolved at runtime.
          </p>
          <button
            type="button"
            disabled
            className="w-full rounded-md border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground cursor-not-allowed"
            title="Send Test requires a backend proxy — coming soon"
          >
            Send Test (coming soon)
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Call API Config with Connector Templates (sub-component) ────────────────

function CallApiConfig({
  config,
  updateConfig,
  connectorOptions,
  entities,
}: {
  config: Record<string, unknown>
  updateConfig: (field: string, value: unknown) => void
  connectorOptions: { value: string; label: string }[]
  entities?: NodeConfigProps['entities']
}) {
  const selectedConnectorId = (config.connector_id as string) ?? ''

  // Resolve provider from selected connector
  const selectedConnector = (entities?.connectors ?? []).find(
    (c) => c.id === selectedConnectorId,
  )
  const provider = selectedConnector?.provider ?? ''

  // Get available action templates for the provider
  const actionTemplates = useMemo<ConnectorTemplate[]>(() => {
    if (!provider) return []
    return getTemplatesForProvider(provider)
  }, [provider])

  const actionTemplateOptions = useMemo(() => {
    if (actionTemplates.length === 0) return []
    return [
      { value: '', label: 'Manual config' },
      ...actionTemplates.map((t) => ({
        value: t.action,
        label: t.label,
      })),
    ]
  }, [actionTemplates])

  const selectedAction = (config.connector_action as string) ?? ''

  function applyTemplate(action: string) {
    updateConfig('connector_action', action || undefined)
    const template = actionTemplates.find((t) => t.action === action)
    if (template) {
      updateConfig('method', template.method)
      updateConfig('path', template.path)
      updateConfig('body_template', template.body_template ?? '')
    }
  }

  return (
    <>
      {/* Step 1: Connector selection */}
      <div className="mb-3">
        <FieldLabel htmlFor="api-connector">Integration</FieldLabel>
        {connectorOptions.length > 0 ? (
          <EntitySelect
            id="api-connector"
            value={selectedConnectorId}
            onChange={(v) => {
              updateConfig('connector_id', v)
              // Reset action template when connector changes
              updateConfig('connector_action', undefined)
            }}
            options={connectorOptions}
            placeholder="Select integration..."
            allowFreeText
          />
        ) : (
          <TextInput
            id="api-connector"
            value={selectedConnectorId}
            onChange={(v) => updateConfig('connector_id', v)}
            placeholder="Integration connector ID"
          />
        )}
      </div>

      {/* Step 2: Action template (when provider recognized) */}
      {actionTemplateOptions.length > 0 && (
        <div className="mb-3">
          <FieldLabel htmlFor="api-action-template">Action Template</FieldLabel>
          <SelectInput
            id="api-action-template"
            value={selectedAction}
            onChange={applyTemplate}
            options={actionTemplateOptions}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Pre-fills method, path, and body from {provider} template
          </p>
        </div>
      )}

      {/* Step 3: Method / Path / Body — pre-filled or manual */}
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
        <VariablePickerInput
          id="api-path"
          value={(config.path as string) ?? ''}
          onChange={(v) => updateConfig('path', v)}
          placeholder="/api/resource"
          variables={[]}
        />
      </div>
      <div className="mb-3">
        <FieldLabel htmlFor="api-body">Request Body Template</FieldLabel>
        <TextArea
          id="api-body"
          value={(config.body_template as string) ?? ''}
          onChange={(v) => updateConfig('body_template', v || undefined)}
          placeholder='{"key": "{{block.field}}"}'
          rows={4}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Use {'{{block.field}}'} for dynamic values
        </p>
      </div>
      <div className="mb-3">
        <FieldLabel htmlFor="api-timeout">Timeout (ms)</FieldLabel>
        <TextInput
          id="api-timeout"
          value={String((config.timeout_ms as number) ?? 30000)}
          onChange={(v) => updateConfig('timeout_ms', parseInt(v) || 30000)}
          placeholder="30000"
        />
      </div>
      <div className="mb-3">
        <FieldLabel htmlFor="api-retries">Max Retries</FieldLabel>
        <TextInput
          id="api-retries"
          value={String((config.max_retries as number) ?? 0)}
          onChange={(v) => updateConfig('max_retries', parseInt(v) || 0)}
          placeholder="0"
        />
      </div>

      {/* B14: Request Preview + Test */}
      <RequestPreview
        method={(config.method as string) ?? 'POST'}
        path={(config.path as string) ?? ''}
        bodyTemplate={(config.body_template as string) ?? ''}
        connectorLabel={
          entities?.connectors?.find((c) => c.id === selectedConnectorId)?.label ?? selectedConnectorId
        }
        provider={provider}
      />
    </>
  )
}

// ─── Action Config (exported) ────────────────────────────────────────────────

export function ActionConfig({ node, onUpdate, entities }: NodeConfigProps) {
  const { data, config, updateData, updateConfig } = makeConfigUpdater(node, onUpdate)
  const stepType = (data.stepType as string) ?? 'emit_event'

  const connectorOptions = (entities?.connectors ?? [])
    .filter((c) => c.status === 'active')
    .map((c) => ({ value: c.id, label: c.label }))

  const docTemplateOptions = (entities?.blocks ?? [])
    .filter((b) => b.type === 'document_template')
    .map((b) => ({ value: b.id, label: b.name }))

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
          options={ACTION_TYPE_OPTIONS}
        />
      </div>

      {stepType === 'emit_event' && (
        <div className="mb-3">
          <FieldLabel htmlFor="event-type">Activity Type</FieldLabel>
          <TextInput
            id="event-type"
            value={(config.event_type as string) ?? ''}
            onChange={(v) => updateConfig('event_type', v)}
            placeholder="e.g. onboarding.started"
          />
          <p className="mt-1 text-xs text-muted-foreground">Appears on the block&apos;s timeline</p>
        </div>
      )}
      {stepType === 'run_action' && (
        <>
          <div className="mb-3">
            <FieldLabel htmlFor="action-type">Action Type</FieldLabel>
            <TextInput
              id="action-type"
              value={(config.action_type as string) ?? ''}
              onChange={(v) => updateConfig('action_type', v)}
              placeholder="e.g. block.create"
            />
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="ra-record-type">Record Type</FieldLabel>
            {(entities?.blockTypes ?? []).length > 0 ? (
              <SelectInput
                id="ra-record-type"
                value={(config.record_type as string) ?? ''}
                onChange={(v) => updateConfig('record_type', v || undefined)}
                options={[
                  { value: '', label: 'Select type...' },
                  ...(entities?.blockTypes ?? []).map((t) => ({ value: t, label: t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) })),
                ]}
              />
            ) : (
              <TextInput
                id="ra-record-type"
                value={(config.record_type as string) ?? ''}
                onChange={(v) => updateConfig('record_type', v || undefined)}
                placeholder="e.g. client"
              />
            )}
          </div>
          <div className="mb-3">
            <CheckboxInput
              id="ra-auto-link"
              checked={(config.auto_link_source as boolean) !== false}
              onChange={(v) => updateConfig('auto_link_source', v)}
              label="Auto-link to source record"
            />
          </div>
          {(config.auto_link_source as boolean) !== false && (
            <div className="mb-3">
              <FieldLabel htmlFor="ra-link-type">Relationship type</FieldLabel>
              <SelectInput
                id="ra-link-type"
                value={(config.auto_link_edge_type as string) ?? 'related_to'}
                onChange={(v) => updateConfig('auto_link_edge_type', v)}
                options={[
                  { value: 'related_to', label: 'Related to' },
                  { value: 'part_of', label: 'Part of' },
                  { value: 'created_from', label: 'Created from' },
                ]}
              />
            </div>
          )}
        </>
      )}
      {stepType === 'call_api' && (
        <CallApiConfig config={config} updateConfig={updateConfig} connectorOptions={connectorOptions} entities={entities} />
      )}
      {stepType === 'send_email' && (
        <>
          <div className="mb-3">
            <FieldLabel htmlFor="email-connector">Email Integration</FieldLabel>
            {connectorOptions.length > 0 ? (
              <EntitySelect
                id="email-connector"
                value={(config.connector_id as string) ?? ''}
                onChange={(v) => updateConfig('connector_id', v)}
                options={connectorOptions}
                placeholder="Select email integration..."
                allowFreeText
              />
            ) : (
              <TextInput
                id="email-connector"
                value={(config.connector_id as string) ?? ''}
                onChange={(v) => updateConfig('connector_id', v)}
                placeholder="Google connector ID"
              />
            )}
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="email-to">To</FieldLabel>
            <VariablePickerInput
              id="email-to"
              value={(config.to as string) ?? ''}
              onChange={(v) => updateConfig('to', v)}
              placeholder="recipient@example.com"
              variables={[]}
              autoSuggestion="block.email"
            />
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="email-subject">Subject</FieldLabel>
            <VariablePickerInput
              id="email-subject"
              value={(config.subject as string) ?? ''}
              onChange={(v) => updateConfig('subject', v)}
              placeholder="Email subject"
              variables={[]}
              autoSuggestion="block.name"
            />
          </div>
        </>
      )}
      {stepType === 'generate_document' && (
        <>
          <div className="mb-3">
            <FieldLabel htmlFor="doc-template">Document Template</FieldLabel>
            {docTemplateOptions.length > 0 ? (
              <EntitySelect
                id="doc-template"
                value={(config.template_id as string) ?? ''}
                onChange={(v) => updateConfig('template_id', v)}
                options={[{ value: '', label: 'None — use AI generation' }, ...docTemplateOptions]}
                placeholder="Select template..."
                allowFreeText
              />
            ) : (
              <TextInput
                id="doc-template"
                value={(config.template_id as string) ?? ''}
                onChange={(v) => updateConfig('template_id', v)}
                placeholder="Template ID (leave blank for AI)"
              />
            )}
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="doc-prompt">AI Prompt (if no template)</FieldLabel>
            <TextInput
              id="doc-prompt"
              value={(config.prompt as string) ?? ''}
              onChange={(v) => updateConfig('prompt', v)}
              placeholder="e.g. Draft a proposal for this client"
            />
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="doc-format">Output Format</FieldLabel>
            <SelectInput
              id="doc-format"
              value={(config.output_format as string) ?? 'html'}
              onChange={(v) => updateConfig('output_format', v)}
              options={[
                { value: 'html', label: 'HTML' },
                { value: 'pdf', label: 'PDF' },
              ]}
            />
          </div>
        </>
      )}
      {stepType === 'book_meeting' && (
        <>
          <div className="mb-3">
            <FieldLabel htmlFor="meeting-connector">Calendar Integration</FieldLabel>
            {connectorOptions.length > 0 ? (
              <EntitySelect
                id="meeting-connector"
                value={(config.connector_id as string) ?? ''}
                onChange={(v) => updateConfig('connector_id', v)}
                options={connectorOptions}
                placeholder="Select calendar integration..."
                allowFreeText
              />
            ) : (
              <TextInput
                id="meeting-connector"
                value={(config.connector_id as string) ?? ''}
                onChange={(v) => updateConfig('connector_id', v)}
                placeholder="Google connector ID"
              />
            )}
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="meeting-title">Meeting Title</FieldLabel>
            <VariablePickerInput
              id="meeting-title"
              value={(config.title as string) ?? ''}
              onChange={(v) => updateConfig('title', v)}
              placeholder="Meeting title"
              variables={[]}
              autoSuggestion="block.name"
            />
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="meeting-attendees">Attendees</FieldLabel>
            <VariablePickerInput
              id="meeting-attendees"
              value={(config.attendees as string) ?? ''}
              onChange={(v) => updateConfig('attendees', v)}
              placeholder="Comma-separated emails"
              variables={[]}
              autoSuggestion="block.email"
            />
          </div>
        </>
      )}
      {stepType === 'update_block' && (
        <UpdateBlockConfig node={node} onUpdate={onUpdate} entities={entities} />
      )}

      {/* -- Create Edge / Link Records Config --------------------------------- */}
      {stepType === 'create_edge' && (
        <>
          <div className="mb-3">
            <FieldLabel htmlFor="ce-from">From record</FieldLabel>
            {(entities?.blocks ?? []).length > 0 ? (
              <EntitySelect
                id="ce-from"
                value={(config.from_block_id as string) ?? '{{context.source_block_id}}'}
                onChange={(v) => updateConfig('from_block_id', v)}
                options={[
                  { value: '{{context.source_block_id}}', label: 'Triggering Record' },
                  ...(entities?.blocks ?? []).map((b) => ({ value: b.id, label: `${b.name} (${b.type})` })),
                ]}
                placeholder="Select source record..."
                allowFreeText
              />
            ) : (
              <TextInput id="ce-from" value={(config.from_block_id as string) ?? ''} onChange={(v) => updateConfig('from_block_id', v)} placeholder="{{context.source_block_id}}" />
            )}
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="ce-to">To record</FieldLabel>
            {(entities?.blocks ?? []).length > 0 ? (
              <EntitySelect
                id="ce-to"
                value={(config.to_block_id as string) ?? ''}
                onChange={(v) => updateConfig('to_block_id', v)}
                options={(entities?.blocks ?? []).map((b) => ({ value: b.id, label: `${b.name} (${b.type})` }))}
                placeholder="Select target record..."
                allowFreeText
              />
            ) : (
              <TextInput id="ce-to" value={(config.to_block_id as string) ?? ''} onChange={(v) => updateConfig('to_block_id', v)} placeholder="Target record ID" />
            )}
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="ce-relationship">Relationship</FieldLabel>
            <SelectInput
              id="ce-relationship"
              value={(config.edge_type as string) ?? 'related_to'}
              onChange={(v) => updateConfig('edge_type', v)}
              options={[
                { value: 'belongs_to', label: 'Belongs to' },
                { value: 'related_to', label: 'Related to' },
                { value: 'assigned_to', label: 'Assigned to' },
                { value: 'depends_on', label: 'Depends on' },
                { value: 'part_of', label: 'Part of' },
                { value: 'parent_of', label: 'Parent of' },
                { value: 'stakeholder_of', label: 'Stakeholder of' },
                { value: 'custom', label: 'Custom...' },
              ]}
            />
          </div>
          {(config.edge_type as string) === 'custom' && (
            <div className="mb-3">
              <FieldLabel htmlFor="ce-custom-type">Custom Relationship</FieldLabel>
              <TextInput
                id="ce-custom-type"
                value={(config.custom_edge_type as string) ?? ''}
                onChange={(v) => updateConfig('custom_edge_type', v)}
                placeholder="e.g. reports_to"
              />
            </div>
          )}
        </>
      )}

      {/* -- Search / Filter Config --------------------------------------------- */}
      {stepType === 'search_blocks' && (
        <>
          <div className="mb-3">
            <FieldLabel htmlFor="sb-type">Record Type</FieldLabel>
            {(entities?.blockTypes ?? []).length > 0 ? (
              <SelectInput
                id="sb-type"
                value={(config.search_type as string) ?? ''}
                onChange={(v) => updateConfig('search_type', v || undefined)}
                options={[
                  { value: '', label: 'Any type' },
                  ...(entities?.blockTypes ?? []).map((t) => ({ value: t, label: t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) })),
                ]}
              />
            ) : (
              <TextInput id="sb-type" value={(config.search_type as string) ?? ''} onChange={(v) => updateConfig('search_type', v || undefined)} placeholder="e.g. client" />
            )}
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="sb-name">Name Contains</FieldLabel>
            <TextInput id="sb-name" value={(config.search_name as string) ?? ''} onChange={(v) => updateConfig('search_name', v || undefined)} placeholder="Partial name match" />
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="sb-limit">Max Results</FieldLabel>
            <NumberInput
              id="sb-limit"
              value={(config.search_limit as number) ?? 10}
              onChange={(v) => updateConfig('search_limit', v || 10)}
              min={1}
              max={100}
              placeholder="10"
            />
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="sb-variable">Save results as</FieldLabel>
            <TextInput
              id="sb-variable"
              value={(config.result_variable as string) ?? ''}
              onChange={(v) => updateConfig('result_variable', v || undefined)}
              placeholder="e.g. matched_clients"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Variable name to reference results in later steps
            </p>
          </div>
        </>
      )}

      {/* -- Send Notification Config ------------------------------------------ */}
      {stepType === 'send_notification' && (
        <>
          <div className="mb-3">
            <FieldLabel htmlFor="sn-channel">Channel</FieldLabel>
            <SelectInput
              id="sn-channel"
              value={(config.notification_channel as string) ?? 'in_app'}
              onChange={(v) => updateConfig('notification_channel', v)}
              options={[
                { value: 'in_app', label: 'In-app' },
                { value: 'email', label: 'Email' },
                { value: 'both', label: 'Both' },
              ]}
            />
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="sn-title">Notification Title</FieldLabel>
            <VariablePickerInput id="sn-title" value={(config.notification_title as string) ?? ''} onChange={(v) => updateConfig('notification_title', v)} placeholder="e.g. New deal requires approval" variables={[]} />
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="sn-body">Message Body</FieldLabel>
            <TextArea id="sn-body" value={(config.notification_body as string) ?? ''} onChange={(v) => updateConfig('notification_body', v)} placeholder="Notification details..." />
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="sn-type">Type</FieldLabel>
            <SelectInput
              id="sn-type"
              value={(config.notification_type as string) ?? 'info'}
              onChange={(v) => updateConfig('notification_type', v)}
              options={[
                { value: 'info', label: 'Info' },
                { value: 'success', label: 'Success' },
                { value: 'warning', label: 'Warning' },
                { value: 'error', label: 'Error' },
              ]}
            />
          </div>
          {/* Email-specific fields when channel is email or both */}
          {((config.notification_channel as string) === 'email' || (config.notification_channel as string) === 'both') && (
            <div className="mb-3 rounded border border-border p-2 bg-muted/30">
              <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Email Settings</h5>
              <div className="mb-2">
                <FieldLabel htmlFor="sn-email-subject">Email Subject</FieldLabel>
                <TextInput
                  id="sn-email-subject"
                  value={(config.email_subject as string) ?? ''}
                  onChange={(v) => updateConfig('email_subject', v)}
                  placeholder="Email subject line"
                />
              </div>
              <div className="mb-2">
                <FieldLabel htmlFor="sn-email-body">Email Body</FieldLabel>
                <TextArea
                  id="sn-email-body"
                  value={(config.email_body as string) ?? ''}
                  onChange={(v) => updateConfig('email_body', v)}
                  placeholder="Email body content..."
                  rows={4}
                />
              </div>
            </div>
          )}
          <div className="mb-3">
            <FieldLabel htmlFor="sn-link">Link URL</FieldLabel>
            <VariablePickerInput id="sn-link" value={(config.notification_link as string) ?? ''} onChange={(v) => updateConfig('notification_link', v || undefined)} placeholder="/blocks/{{context.source_block_id}}" variables={[]} />
          </div>
        </>
      )}

      {/* -- Create Shared Link Config ----------------------------------------- */}
      {stepType === 'create_shared_link' && (
        <>
          <div className="mb-3">
            <FieldLabel htmlFor="sl-block">Target Block</FieldLabel>
            {(entities?.blocks ?? []).length > 0 ? (
              <EntitySelect
                id="sl-block"
                value={(config.link_block_id as string) ?? ''}
                onChange={(v) => updateConfig('link_block_id', v)}
                options={(entities?.blocks ?? []).map((b) => ({ value: b.id, label: `${b.name} (${b.type})` }))}
                placeholder="Defaults to trigger block"
                allowFreeText
              />
            ) : (
              <TextInput id="sl-block" value={(config.link_block_id as string) ?? ''} onChange={(v) => updateConfig('link_block_id', v || undefined)} placeholder="Block ID (defaults to source)" />
            )}
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="sl-type">Link Type</FieldLabel>
            <SelectInput
              id="sl-type"
              value={(config.link_type as string) ?? 'view'}
              onChange={(v) => updateConfig('link_type', v)}
              options={[
                { value: 'view', label: 'View Only' },
                { value: 'form', label: 'Fill Form' },
                { value: 'sign', label: 'Sign' },
                { value: 'portal', label: 'Client Portal' },
              ]}
            />
          </div>
          {(config.link_type as string) === 'portal' && (
            <div className="mb-3">
              <FieldLabel htmlFor="sl-portal">Portal Configuration</FieldLabel>
              <PortalConfigSelector
                id="sl-portal"
                value={(config.portal_config_id as string) ?? ''}
                onChange={(v) => updateConfig('portal_config_id', v)}
              />
            </div>
          )}
          <div className="mb-3">
            <DurationPicker
              value={(config.link_expires_seconds as number) ?? 604800}
              onChange={(v) => updateConfig('link_expires_seconds', v)}
              label="Expires in"
            />
          </div>
          <div className="mb-3">
            <CheckboxInput
              id="sl-require-auth"
              checked={(config.require_authentication as boolean) ?? false}
              onChange={(v) => updateConfig('require_authentication', v)}
              label="Require authentication"
            />
          </div>
          <div className="mb-3">
            <CheckboxInput
              id="sl-password-protect"
              checked={(config.password_protect as boolean) ?? false}
              onChange={(v) => updateConfig('password_protect', v)}
              label="Password protect"
            />
          </div>
          {(config.password_protect as boolean) && (
            <div className="mb-3">
              <FieldLabel htmlFor="sl-password">Link Password</FieldLabel>
              <TextInput
                id="sl-password"
                value={(config.link_password as string) ?? ''}
                onChange={(v) => updateConfig('link_password', v)}
                placeholder="Enter password"
              />
            </div>
          )}
          <div className="mb-3">
            <FieldLabel htmlFor="sl-message">Custom Message</FieldLabel>
            <TextArea
              id="sl-message"
              value={(config.custom_message as string) ?? ''}
              onChange={(v) => updateConfig('custom_message', v || undefined)}
              placeholder="Message shown when link is opened..."
              rows={3}
            />
          </div>
          <div className="mb-3">
            <CheckboxInput
              id="sl-org-branding"
              checked={(config.org_branding as boolean) !== false}
              onChange={(v) => updateConfig('org_branding', v)}
              label="Use org branding"
            />
          </div>
        </>
      )}

      {/* -- AI Analysis ------------------------------------------------------- */}
      {stepType === 'ai_analysis' && (
        <>
          <AITemplatePicker
            nodeType="ai_analysis"
            selectedTemplateId={(config.ai_template_id as string) ?? undefined}
            onSelect={(t) => updateConfig('ai_template_id', t?.id ?? undefined)}
            prompt={(config.ai_prompt as string) ?? ''}
            onPromptChange={(v) => updateConfig('ai_prompt', v || undefined)}
            outputFormat={((config.ai_output_format as string) ?? 'json') as 'json' | 'text'}
            onOutputFormatChange={(v) => updateConfig('ai_output_format', v)}
            saveResultTo={((config.ai_save_result_to as string) ?? 'source_record') as SaveResultDestination}
            onSaveResultToChange={(v) => updateConfig('ai_save_result_to', v)}
          />
          <div className="mb-3 mt-3">
            <FieldLabel htmlFor="ai-block">Context Block</FieldLabel>
            {(entities?.blocks ?? []).length > 0 ? (
              <EntitySelect
                id="ai-block"
                value={(config.ai_context_block_id as string) ?? ''}
                onChange={(v) => updateConfig('ai_context_block_id', v || undefined)}
                options={(entities?.blocks ?? []).map((b) => ({ value: b.id, label: `${b.name} (${b.type})` }))}
                placeholder="Defaults to trigger block"
                allowFreeText
              />
            ) : (
              <TextInput id="ai-block" value={(config.ai_context_block_id as string) ?? ''} onChange={(v) => updateConfig('ai_context_block_id', v || undefined)} placeholder="Block ID (defaults to source)" />
            )}
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="ai-tokens">Max Tokens</FieldLabel>
            <TextInput id="ai-tokens" value={String((config.ai_max_tokens as number) ?? 1024)} onChange={(v) => updateConfig('ai_max_tokens', parseInt(v) || 1024)} placeholder="1024" />
          </div>
        </>
      )}

      {/* -- AI Classify ------------------------------------------------------- */}
      {stepType === 'ai_classify' && (
        <>
          <AITemplatePicker
            nodeType="ai_classify"
            selectedTemplateId={(config.ai_template_id as string) ?? undefined}
            onSelect={(t) => updateConfig('ai_template_id', t?.id ?? undefined)}
            prompt={(config.ai_prompt as string) ?? ''}
            onPromptChange={(v) => updateConfig('ai_prompt', v || undefined)}
            categories={(config.ai_categories as string[]) ?? []}
            onCategoriesChange={(v) => updateConfig('ai_categories', v)}
            saveResultTo={((config.ai_save_result_to as string) ?? 'source_record') as SaveResultDestination}
            onSaveResultToChange={(v) => updateConfig('ai_save_result_to', v)}
          />
          <div className="mb-3 mt-3">
            <FieldLabel htmlFor="ai-cls-block">Context Block</FieldLabel>
            {(entities?.blocks ?? []).length > 0 ? (
              <EntitySelect
                id="ai-cls-block"
                value={(config.ai_context_block_id as string) ?? ''}
                onChange={(v) => updateConfig('ai_context_block_id', v || undefined)}
                options={(entities?.blocks ?? []).map((b) => ({ value: b.id, label: `${b.name} (${b.type})` }))}
                placeholder="Defaults to trigger block"
                allowFreeText
              />
            ) : (
              <TextInput id="ai-cls-block" value={(config.ai_context_block_id as string) ?? ''} onChange={(v) => updateConfig('ai_context_block_id', v || undefined)} placeholder="Block ID (defaults to source)" />
            )}
          </div>
        </>
      )}

      {/* -- AI Summarize ------------------------------------------------------ */}
      {stepType === 'ai_summarize' && (
        <>
          <AITemplatePicker
            nodeType="ai_summarise"
            selectedTemplateId={(config.ai_template_id as string) ?? undefined}
            onSelect={(t) => updateConfig('ai_template_id', t?.id ?? undefined)}
            prompt={(config.ai_prompt as string) ?? ''}
            onPromptChange={(v) => updateConfig('ai_prompt', v || undefined)}
            saveResultTo={((config.ai_save_result_to as string) ?? 'source_record') as SaveResultDestination}
            onSaveResultToChange={(v) => updateConfig('ai_save_result_to', v)}
          />
          <div className="mb-3 mt-3">
            <FieldLabel htmlFor="ai-sum-block">Context Block</FieldLabel>
            {(entities?.blocks ?? []).length > 0 ? (
              <EntitySelect
                id="ai-sum-block"
                value={(config.ai_context_block_id as string) ?? ''}
                onChange={(v) => updateConfig('ai_context_block_id', v || undefined)}
                options={(entities?.blocks ?? []).map((b) => ({ value: b.id, label: `${b.name} (${b.type})` }))}
                placeholder="Defaults to trigger block"
                allowFreeText
              />
            ) : (
              <TextInput id="ai-sum-block" value={(config.ai_context_block_id as string) ?? ''} onChange={(v) => updateConfig('ai_context_block_id', v || undefined)} placeholder="Block ID (defaults to source)" />
            )}
          </div>
          <div className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              id="ai-sum-events"
              checked={(config.ai_include_events as boolean) !== false}
              onChange={(e) => updateConfig('ai_include_events', e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="ai-sum-events" className="text-xs text-foreground">Include recent events</label>
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="ai-sum-tokens">Max Tokens</FieldLabel>
            <TextInput id="ai-sum-tokens" value={String((config.ai_max_tokens as number) ?? 512)} onChange={(v) => updateConfig('ai_max_tokens', parseInt(v) || 512)} placeholder="512" />
          </div>
        </>
      )}

      {/* -- AI Risk Assessment ------------------------------------------------ */}
      {stepType === 'ai_risk_assessment' && (
        <>
          <AITemplatePicker
            nodeType="ai_risk"
            selectedTemplateId={(config.ai_template_id as string) ?? undefined}
            onSelect={(t) => updateConfig('ai_template_id', t?.id ?? undefined)}
            prompt={(config.ai_prompt as string) ?? ''}
            onPromptChange={(v) => updateConfig('ai_prompt', v || undefined)}
            riskCategories={(config.ai_risk_categories as string[]) ?? []}
            onRiskCategoriesChange={(v) => updateConfig('ai_risk_categories', v)}
            includeOrgPolicies={(config.ai_include_policies as boolean) ?? false}
            onIncludeOrgPoliciesChange={(v) => updateConfig('ai_include_policies', v)}
            saveResultTo={((config.ai_save_result_to as string) ?? 'source_record') as SaveResultDestination}
            onSaveResultToChange={(v) => updateConfig('ai_save_result_to', v)}
          />
          <div className="mb-3 mt-3">
            <FieldLabel htmlFor="ai-risk-block">Context Block</FieldLabel>
            {(entities?.blocks ?? []).length > 0 ? (
              <EntitySelect
                id="ai-risk-block"
                value={(config.ai_context_block_id as string) ?? ''}
                onChange={(v) => updateConfig('ai_context_block_id', v || undefined)}
                options={(entities?.blocks ?? []).map((b) => ({ value: b.id, label: `${b.name} (${b.type})` }))}
                placeholder="Defaults to trigger block"
                allowFreeText
              />
            ) : (
              <TextInput id="ai-risk-block" value={(config.ai_context_block_id as string) ?? ''} onChange={(v) => updateConfig('ai_context_block_id', v || undefined)} placeholder="Block ID (defaults to source)" />
            )}
          </div>
        </>
      )}

      {/* -- Run Sub-Workflow --------------------------------------------------- */}
      {stepType === 'run_sub_workflow' && (
        <>
          <div className="mb-3">
            <FieldLabel htmlFor="sw-template">Workflow</FieldLabel>
            {(entities?.workflowTemplates ?? []).length > 0 ? (
              <SelectInput
                id="sw-template"
                value={(config.sub_workflow_template_id as string) ?? ''}
                onChange={(v) => updateConfig('sub_workflow_template_id', v || undefined)}
                options={[
                  { value: '', label: 'Select workflow...' },
                  ...(entities?.workflowTemplates ?? []).map((t) => ({
                    value: t.id,
                    label: t.appliesToType ? `${t.name} (${t.appliesToType})` : t.name,
                  })),
                ]}
              />
            ) : (
              <TextInput
                id="sw-template"
                value={(config.sub_workflow_template_id as string) ?? ''}
                onChange={(v) => updateConfig('sub_workflow_template_id', v || undefined)}
                placeholder="Workflow template ID"
              />
            )}
          </div>
          {/* Mini preview of selected template steps */}
          {(() => {
            const selectedTemplate = (entities?.workflowTemplates ?? []).find(
              (t) => t.id === (config.sub_workflow_template_id as string)
            )
            if (!selectedTemplate || selectedTemplate.steps.length === 0) return null
            return (
              <div className="mb-3 rounded border border-border p-2 bg-muted/30">
                <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Steps Preview
                </h5>
                <ol className="space-y-1">
                  {selectedTemplate.steps.map((step, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-xs text-foreground">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground shrink-0">
                        {i + 1}
                      </span>
                      <span className="truncate">{step.name}</span>
                      <span className="text-muted-foreground text-[10px] shrink-0">
                        {step.type.replace(/_/g, ' ')}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )
          })()}
          <div className="mb-3">
            <CheckboxInput
              id="sw-wait"
              checked={(config.wait_for_completion as boolean) ?? false}
              onChange={(v) => updateConfig('wait_for_completion', v)}
              label="Wait for completion?"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              If enabled, this step blocks until the sub-workflow finishes
            </p>
          </div>
        </>
      )}

      {/* -- Store File -------------------------------------------------------- */}
      {stepType === 'store_file' && (
        <>
          <div className="mb-3">
            <FieldLabel htmlFor="sf-name">File Name</FieldLabel>
            <TextInput id="sf-name" value={(config.file_name as string) ?? ''} onChange={(v) => updateConfig('file_name', v || undefined)} placeholder="report.pdf" />
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="sf-content">File Content / Template</FieldLabel>
            <TextArea id="sf-content" value={(config.file_content as string) ?? ''} onChange={(v) => updateConfig('file_content', v || undefined)} placeholder="Content or {{context.previous_step.output}} template" />
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="sf-type">Content Type</FieldLabel>
            <SelectInput
              id="sf-type"
              value={(config.file_content_type as string) ?? 'text/plain'}
              onChange={(v) => updateConfig('file_content_type', v)}
              options={[
                { value: 'text/plain', label: 'Text' },
                { value: 'application/json', label: 'JSON' },
                { value: 'text/csv', label: 'CSV' },
                { value: 'application/pdf', label: 'PDF (base64)' },
              ]}
            />
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="sf-bucket">Storage Bucket</FieldLabel>
            <TextInput id="sf-bucket" value={(config.file_bucket as string) ?? 'workflow-files'} onChange={(v) => updateConfig('file_bucket', v || 'workflow-files')} placeholder="workflow-files" />
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="sf-prefix">Path Prefix</FieldLabel>
            <TextInput id="sf-prefix" value={(config.file_path_prefix as string) ?? ''} onChange={(v) => updateConfig('file_path_prefix', v || undefined)} placeholder="reports/monthly" />
          </div>
        </>
      )}

      {/* -- Routing Configuration --------------------------------------------- */}
      <RoutingSection
        routingMode={(config.routing_mode as string) ?? 'policy_default'}
        requiredPermissions={(config.required_permissions as string[]) ?? []}
        onRoutingModeChange={(v) => updateConfig('routing_mode', v)}
        onPermissionsChange={(v) => updateConfig('required_permissions', v)}
      />
    </>
  )
}
