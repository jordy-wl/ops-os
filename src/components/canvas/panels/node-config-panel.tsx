'use client'

import { useState } from 'react'
import { X, User, Bot, GitPullRequest, Link2, Eye, PenLine, Plus, Trash2 } from 'lucide-react'
import type { Node } from '@xyflow/react'
import { cn } from '@/lib/utils'
import { PERMISSIONS, type Permission } from '@/lib/rbac/types'
import type { OrgEntities } from '../hooks/use-org-entities'

const ROUTING_MODE_OPTIONS = [
  { value: 'policy_default', label: 'Inherit from Policy' },
  { value: 'human_only', label: 'Human Only' },
  { value: 'ai_only', label: 'AI Only' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'escalation_chain', label: 'Escalation Chain' },
]

const ROUTING_ICONS: Record<string, React.ElementType> = {
  human_only: User,
  ai_only: Bot,
  hybrid: GitPullRequest,
  escalation_chain: Link2,
}

const PERM_LABELS: Record<Permission, string> = {
  manage_blocks: 'Manage Blocks',
  edit_blocks: 'Edit Blocks',
  view_blocks: 'View Blocks',
  manage_workflows: 'Manage Workflows',
  execute_workflows: 'Execute Workflows',
  approve_tasks: 'Approve Tasks',
  manage_team: 'Manage Team',
  manage_settings: 'Manage Settings',
  manage_integrations: 'Manage Integrations',
  view_audit_log: 'View Audit Log',
}

interface NodeConfigPanelProps {
  node: Node
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void
  onClose: () => void
  entities?: OrgEntities
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-foreground mb-1">
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
      className="w-full rounded-md border border-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    />
  )
}

function TextArea({
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
    <textarea
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={3}
      className="w-full rounded-md border border-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
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
      className="w-full rounded-md border border-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
      className="w-full rounded-md border border-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    />
  )
}

// ─── Entity-aware Select ────────────────────────────────────────────────────

function EntitySelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  allowFreeText,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  allowFreeText?: boolean
}) {
  const hasMatch = options.some((o) => o.value === value)
  const showFreeText = allowFreeText && value && !hasMatch

  return (
    <div>
      <select
        id={id}
        value={hasMatch ? value : '__custom__'}
        onChange={(e) => {
          if (e.target.value === '__custom__') return
          onChange(e.target.value)
        }}
        className="w-full rounded-md border border-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">{placeholder ?? 'Select…'}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {allowFreeText && <option value="__custom__">Enter manually…</option>}
      </select>
      {showFreeText && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter ID manually"
          className="mt-1 w-full rounded-md border border-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      )}
    </div>
  )
}

// ─── Trigger Config ─────────────────────────────────────────────────────────

function TriggerConfig({ node, onUpdate, entities }: Pick<NodeConfigPanelProps, 'node' | 'onUpdate' | 'entities'>) {
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

  const connectorOptions = (entities?.connectors ?? [])
    .filter((c) => c.status === 'active')
    .map((c) => ({ value: c.id, label: c.label }))

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
            { value: 'event', label: 'When Event Occurs' },
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
          <p className="mt-1 text-xs text-muted-foreground">The activity type that starts this workflow</p>
        </div>
      )}
      {triggerType === 'webhook' && (
        <div className="mb-3">
          <FieldLabel htmlFor="connector-id">Integration</FieldLabel>
          {connectorOptions.length > 0 ? (
            <EntitySelect
              id="connector-id"
              value={(config.connector_id as string) ?? ''}
              onChange={(v) => update('connector_id', v)}
              options={connectorOptions}
              placeholder="Select integration…"
              allowFreeText
            />
          ) : (
            <TextInput
              id="connector-id"
              value={(config.connector_id as string) ?? ''}
              onChange={(v) => update('connector_id', v)}
              placeholder="Integration connector ID"
            />
          )}
        </div>
      )}
    </>
  )
}

// ─── Action Config ──────────────────────────────────────────────────────────

function ActionConfig({ node, onUpdate, entities }: Pick<NodeConfigPanelProps, 'node' | 'onUpdate' | 'entities'>) {
  const data = node.data as Record<string, unknown>
  const config = (data.config ?? {}) as Record<string, unknown>
  const stepType = (data.stepType as string) ?? 'emit_event'

  function updateData(field: string, value: unknown) {
    onUpdate(node.id, { ...data, [field]: value })
  }

  function updateConfig(field: string, value: unknown) {
    onUpdate(node.id, { ...data, config: { ...config, [field]: value } })
  }

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
          options={[
            { value: 'emit_event', label: 'Log Activity' },
            { value: 'run_action', label: 'Run Action' },
            { value: 'call_api', label: 'Call External API' },
            { value: 'send_email', label: 'Send Email' },
            { value: 'generate_document', label: 'Generate Document' },
            { value: 'book_meeting', label: 'Book Meeting' },
            { value: 'update_block', label: 'Update Record' },
          ]}
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
            <FieldLabel htmlFor="api-connector">Integration</FieldLabel>
            {connectorOptions.length > 0 ? (
              <EntitySelect
                id="api-connector"
                value={(config.connector_id as string) ?? ''}
                onChange={(v) => updateConfig('connector_id', v)}
                options={connectorOptions}
                placeholder="Select integration…"
                allowFreeText
              />
            ) : (
              <TextInput
                id="api-connector"
                value={(config.connector_id as string) ?? ''}
                onChange={(v) => updateConfig('connector_id', v)}
                placeholder="Integration connector ID"
              />
            )}
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
            <FieldLabel htmlFor="email-connector">Email Integration</FieldLabel>
            {connectorOptions.length > 0 ? (
              <EntitySelect
                id="email-connector"
                value={(config.connector_id as string) ?? ''}
                onChange={(v) => updateConfig('connector_id', v)}
                options={connectorOptions}
                placeholder="Select email integration…"
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
                placeholder="Select template…"
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
                placeholder="Select calendar integration…"
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
      {stepType === 'update_block' && (
        <UpdateBlockConfig node={node} onUpdate={onUpdate} entities={entities} />
      )}

      {/* ── Create Edge Config ──────────────────────────────────────────── */}
      {stepType === 'create_edge' && (
        <>
          <div className="mb-3">
            <FieldLabel htmlFor="ce-from">From Block</FieldLabel>
            {(entities?.blocks ?? []).length > 0 ? (
              <EntitySelect
                id="ce-from"
                value={(config.from_block_id as string) ?? ''}
                onChange={(v) => updateConfig('from_block_id', v)}
                options={(entities?.blocks ?? []).map((b) => ({ value: b.id, label: `${b.name} (${b.type})` }))}
                placeholder="Source block (defaults to trigger block)"
                allowFreeText
              />
            ) : (
              <TextInput id="ce-from" value={(config.from_block_id as string) ?? ''} onChange={(v) => updateConfig('from_block_id', v)} placeholder="{{context.source_block_id}}" />
            )}
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="ce-to">To Block</FieldLabel>
            {(entities?.blocks ?? []).length > 0 ? (
              <EntitySelect
                id="ce-to"
                value={(config.to_block_id as string) ?? ''}
                onChange={(v) => updateConfig('to_block_id', v)}
                options={(entities?.blocks ?? []).map((b) => ({ value: b.id, label: `${b.name} (${b.type})` }))}
                placeholder="Select target block"
                allowFreeText
              />
            ) : (
              <TextInput id="ce-to" value={(config.to_block_id as string) ?? ''} onChange={(v) => updateConfig('to_block_id', v)} placeholder="Target block ID" />
            )}
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="ce-type">Edge Type</FieldLabel>
            <TextInput id="ce-type" value={(config.edge_type as string) ?? 'related'} onChange={(v) => updateConfig('edge_type', v)} placeholder="related" />
          </div>
        </>
      )}

      {/* ── Search Blocks Config ────────────────────────────────────────── */}
      {stepType === 'search_blocks' && (
        <>
          <div className="mb-3">
            <FieldLabel htmlFor="sb-type">Block Type</FieldLabel>
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
            <TextInput id="sb-limit" value={String((config.search_limit as number) ?? 10)} onChange={(v) => updateConfig('search_limit', parseInt(v) || 10)} placeholder="10" />
          </div>
        </>
      )}

      {/* ── Send Notification Config ────────────────────────────────────── */}
      {stepType === 'send_notification' && (
        <>
          <div className="mb-3">
            <FieldLabel htmlFor="sn-title">Notification Title</FieldLabel>
            <TextInput id="sn-title" value={(config.notification_title as string) ?? ''} onChange={(v) => updateConfig('notification_title', v)} placeholder="e.g. New deal requires approval" />
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="sn-body">Message Body</FieldLabel>
            <TextArea id="sn-body" value={(config.notification_body as string) ?? ''} onChange={(v) => updateConfig('notification_body', v)} placeholder="Notification details…" />
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
          <div className="mb-3">
            <FieldLabel htmlFor="sn-link">Link URL</FieldLabel>
            <TextInput id="sn-link" value={(config.notification_link as string) ?? ''} onChange={(v) => updateConfig('notification_link', v || undefined)} placeholder="/blocks/{{context.source_block_id}}" />
          </div>
        </>
      )}

      {/* ── Create Shared Link Config ───────────────────────────────────── */}
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
                { value: 'form', label: 'Form Submission' },
                { value: 'sign', label: 'Signature Request' },
              ]}
            />
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="sl-expiry">Expires After (hours)</FieldLabel>
            <TextInput id="sl-expiry" value={String((config.link_expires_hours as number) ?? 168)} onChange={(v) => updateConfig('link_expires_hours', parseInt(v) || 168)} placeholder="168 (7 days)" />
          </div>
        </>
      )}

      {/* ── AI Analysis ─────────────────────────────────────────────────── */}
      {stepType === 'ai_analysis' && (
        <>
          <div className="mb-3">
            <FieldLabel htmlFor="ai-prompt">Analysis Prompt</FieldLabel>
            <TextArea id="ai-prompt" value={(config.ai_prompt as string) ?? ''} onChange={(v) => updateConfig('ai_prompt', v || undefined)} placeholder="Analyze this client's deal pipeline and identify key risks..." />
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="ai-format">Output Format</FieldLabel>
            <SelectInput
              id="ai-format"
              value={(config.ai_output_format as string) ?? 'json'}
              onChange={(v) => updateConfig('ai_output_format', v)}
              options={[
                { value: 'json', label: 'Structured JSON' },
                { value: 'text', label: 'Free Text' },
              ]}
            />
          </div>
          <div className="mb-3">
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

      {/* ── AI Classify ──────────────────────────────────────────────────── */}
      {stepType === 'ai_classify' && (
        <>
          <div className="mb-3">
            <FieldLabel htmlFor="ai-cats">Categories (comma-separated)</FieldLabel>
            <TextInput
              id="ai-cats"
              value={(config.ai_categories as string[] ?? []).join(', ')}
              onChange={(v) => updateConfig('ai_categories', v.split(',').map((s) => s.trim()).filter(Boolean))}
              placeholder="high_priority, medium_priority, low_priority"
            />
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="ai-cls-prompt">Classification Instructions</FieldLabel>
            <TextArea id="ai-cls-prompt" value={(config.ai_prompt as string) ?? ''} onChange={(v) => updateConfig('ai_prompt', v || undefined)} placeholder="Classify based on deal value and client tier..." />
          </div>
          <div className="mb-3">
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

      {/* ── AI Summarize ─────────────────────────────────────────────────── */}
      {stepType === 'ai_summarize' && (
        <>
          <div className="mb-3">
            <FieldLabel htmlFor="ai-sum-prompt">Summary Instructions</FieldLabel>
            <TextArea id="ai-sum-prompt" value={(config.ai_prompt as string) ?? ''} onChange={(v) => updateConfig('ai_prompt', v || undefined)} placeholder="Provide a concise executive summary focused on..." />
          </div>
          <div className="mb-3">
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

      {/* ── AI Risk Assessment ───────────────────────────────────────────── */}
      {stepType === 'ai_risk_assessment' && (
        <>
          <div className="mb-3">
            <FieldLabel htmlFor="ai-risk-prompt">Assessment Instructions</FieldLabel>
            <TextArea id="ai-risk-prompt" value={(config.ai_prompt as string) ?? ''} onChange={(v) => updateConfig('ai_prompt', v || undefined)} placeholder="Assess compliance risk for this deal considering jurisdiction..." />
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="ai-risk-cats">Risk Categories (comma-separated)</FieldLabel>
            <TextInput
              id="ai-risk-cats"
              value={(config.ai_risk_categories as string[] ?? []).join(', ')}
              onChange={(v) => updateConfig('ai_risk_categories', v.split(',').map((s) => s.trim()).filter(Boolean))}
              placeholder="operational, financial, compliance, reputational"
            />
          </div>
          <div className="mb-3">
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
          <div className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              id="ai-risk-policies"
              checked={(config.ai_include_policies as boolean) !== false}
              onChange={(e) => updateConfig('ai_include_policies', e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="ai-risk-policies" className="text-xs text-foreground">Include org policies</label>
          </div>
        </>
      )}

      {/* ── Store File ───────────────────────────────────────────────────── */}
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

      {/* ── Routing Configuration ─────────────────────────────────────────── */}
      <div className="mt-4 pt-4 border-t border-border">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Routing</h4>

        <div className="mb-3">
          <FieldLabel htmlFor="routing-mode">Routing Mode</FieldLabel>
          <div className="flex items-center gap-2">
            <SelectInput
              id="routing-mode"
              value={(config.routing_mode as string) ?? 'policy_default'}
              onChange={(v) => updateConfig('routing_mode', v)}
              options={ROUTING_MODE_OPTIONS}
            />
            {(() => {
              if (!config.routing_mode || config.routing_mode === 'policy_default') return null
              const Icon = ROUTING_ICONS[config.routing_mode as string]
              return Icon ? <Icon className="h-4 w-4 text-muted-foreground shrink-0" /> : null
            })()}
          </div>
        </div>

        <div className="mb-3">
          <FieldLabel htmlFor="required-perms">Required Permissions</FieldLabel>
          <div className="space-y-1 max-h-40 overflow-y-auto rounded border border-border p-2">
            {PERMISSIONS.map((perm) => {
              const selected = ((config.required_permissions as string[]) ?? [])
              return (
                <label key={perm} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                  <input
                    type="checkbox"
                    checked={selected.includes(perm)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...selected, perm]
                        : selected.filter((p: string) => p !== perm)
                      updateConfig('required_permissions', next.length > 0 ? next : undefined)
                    }}
                    className="h-3 w-3 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-foreground">{PERM_LABELS[perm]}</span>
                </label>
              )
            })}
          </div>
          {!config.required_permissions && (
            <p className="mt-1 text-xs text-muted-foreground italic">Any team member can handle this step</p>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Update Block Config ────────────────────────────────────────────────────

function UpdateBlockConfig({ node, onUpdate, entities }: Pick<NodeConfigPanelProps, 'node' | 'onUpdate' | 'entities'>) {
  const data = node.data as Record<string, unknown>
  const config = (data.config ?? {}) as Record<string, unknown>
  const fields = (config.fields ?? {}) as Record<string, string>
  const fieldEntries = Object.entries(fields)

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
      <div className="mb-3">
        <FieldLabel htmlFor="ub-block-id">Target Record</FieldLabel>
        {(entities?.blocks ?? []).length > 0 ? (
          <EntitySelect
            id="ub-block-id"
            value={(config.block_id as string) ?? ''}
            onChange={(v) => updateConfig('block_id', v)}
            options={[
              { value: '{{context.source_block_id}}', label: 'Trigger block (current record)' },
              ...(entities?.blocks ?? []).map((b) => ({ value: b.id, label: `${b.name} (${b.type})` })),
            ]}
            placeholder="Select target record…"
            allowFreeText
          />
        ) : (
          <TextInput
            id="ub-block-id"
            value={(config.block_id as string) ?? ''}
            onChange={(v) => updateConfig('block_id', v)}
            placeholder="UUID or {{context.source_block_id}}"
          />
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          Choose which record to update when this step runs
        </p>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-foreground">Fields to Update</span>
          <button
            type="button"
            onClick={addField}
            className="text-xs text-blue-700 hover:underline"
          >
            + Add
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
        <p className="mt-1 text-xs text-muted-foreground">
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
        <p className="mt-1 text-xs text-muted-foreground">
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

// ─── Input Config ──────────────────────────────────────────────────────────

const SOURCE_TYPE_OPTIONS = [
  { value: 'block_fields', label: 'Block Fields' },
  { value: 'webhook', label: 'Webhook Payload' },
  { value: 'api', label: 'API Request' },
]

function InputConfig({ node, onUpdate }: Pick<NodeConfigPanelProps, 'node' | 'onUpdate'>) {
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

// ─── Output Config ─────────────────────────────────────────────────────────

const OUTPUT_TYPE_OPTIONS = [
  { value: 'update_fields', label: 'Save to Record' },
  { value: 'api_call', label: 'Send to External System' },
  { value: 'emit_event', label: 'Log Completion Activity' },
]

function OutputConfig({ node, onUpdate }: Pick<NodeConfigPanelProps, 'node' | 'onUpdate'>) {
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

// ─── Task Config (Generate/Route Task node) ─────────────────────────────────

const TASK_FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'select', label: 'Dropdown' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'checkbox', label: 'Checkbox' },
]

const TASK_ACTION_STYLES = [
  { value: 'primary', label: 'Primary' },
  { value: 'destructive', label: 'Destructive' },
  { value: 'outline', label: 'Outline' },
  { value: 'secondary', label: 'Secondary' },
]

interface TaskFormField {
  type: string
  name: string
  label: string
  required?: boolean
  options?: string[]
  max_length?: number
  source?: string
}

interface TaskFormAction {
  label: string
  value: string
  style?: string
}

interface TaskFormSchema {
  title?: string
  fields?: TaskFormField[]
  actions?: TaskFormAction[]
}

function TaskConfig({ node, onUpdate }: Pick<NodeConfigPanelProps, 'node' | 'onUpdate'>) {
  const data = node.data as Record<string, unknown>
  const config = (data.config ?? {}) as Record<string, unknown>
  const schema = (config.task_form_schema ?? { title: '', fields: [], actions: [] }) as TaskFormSchema
  const fields = schema.fields ?? []
  const actions = schema.actions ?? []

  function updateData(field: string, value: unknown) {
    onUpdate(node.id, { ...data, [field]: value })
  }

  function updateConfig(field: string, value: unknown) {
    onUpdate(node.id, { ...data, config: { ...config, [field]: value } })
  }

  function updateSchema(patch: Partial<TaskFormSchema>) {
    updateConfig('task_form_schema', { ...schema, ...patch })
  }

  function addField() {
    const name = `field_${fields.length + 1}`
    updateSchema({ fields: [...fields, { type: 'text', name, label: '', required: false }] })
  }

  function updateField(index: number, patch: Partial<TaskFormField>) {
    const next = fields.map((f, i) => (i === index ? { ...f, ...patch } : f))
    updateSchema({ fields: next })
  }

  function removeField(index: number) {
    updateSchema({ fields: fields.filter((_, i) => i !== index) })
  }

  function addAction() {
    updateSchema({ actions: [...actions, { label: '', value: '', style: 'primary' }] })
  }

  function updateAction(index: number, patch: Partial<TaskFormAction>) {
    const next = actions.map((a, i) => (i === index ? { ...a, ...patch } : a))
    updateSchema({ actions: next })
  }

  function removeAction(index: number) {
    updateSchema({ actions: actions.filter((_, i) => i !== index) })
  }

  return (
    <>
      <div className="mb-3">
        <FieldLabel htmlFor="task-step-name">Step Name</FieldLabel>
        <TextInput
          id="task-step-name"
          value={(data.stepName as string) ?? ''}
          onChange={(v) => updateData('stepName', v)}
          placeholder="e.g. review_onboarding"
        />
      </div>

      <div className="mb-3">
        <FieldLabel htmlFor="task-assign">Assign To</FieldLabel>
        <SelectInput
          id="task-assign"
          value={(config.task_assign_to as string) ?? 'routing_engine'}
          onChange={(v) => updateConfig('task_assign_to', v)}
          options={[
            { value: 'routing_engine', label: 'Routing Engine (auto)' },
            { value: 'specific_user', label: 'Specific User' },
            { value: 'role', label: 'By Role' },
          ]}
        />
      </div>

      <div className="mb-3">
        <FieldLabel htmlFor="task-priority">Priority</FieldLabel>
        <SelectInput
          id="task-priority"
          value={(config.task_priority as string) ?? 'medium'}
          onChange={(v) => updateConfig('task_priority', v)}
          options={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
            { value: 'urgent', label: 'Urgent' },
          ]}
        />
      </div>

      {/* Task Form Schema */}
      <div className="mt-4 pt-4 border-t border-border">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Task Form</h4>

        <div className="mb-3">
          <FieldLabel htmlFor="task-title">Form Title</FieldLabel>
          <TextInput
            id="task-title"
            value={schema.title ?? ''}
            onChange={(v) => updateSchema({ title: v })}
            placeholder="e.g. Review Client Onboarding"
          />
          <p className="mt-1 text-xs text-muted-foreground">Shown at the top of the task card</p>
        </div>

        {/* Fields */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-foreground">Form Fields</span>
            <button
              type="button"
              onClick={addField}
              className="inline-flex items-center gap-0.5 text-xs text-blue-700 hover:underline"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          </div>
          {fields.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No fields yet — AI will generate defaults if left empty.</p>
          )}
          <div className="space-y-2">
            {fields.map((field, i) => (
              <div key={i} className="rounded border border-border p-2 bg-muted/30">
                <div className="flex items-center gap-1 mb-1">
                  <select
                    value={field.type}
                    onChange={(e) => updateField(i, { type: e.target.value })}
                    className="flex-1 rounded border border-border px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {TASK_FIELD_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={field.required ?? false}
                      onChange={(e) => updateField(i, { required: e.target.checked })}
                      className="h-3 w-3"
                    />
                    Req
                  </label>
                  <button
                    type="button"
                    onClick={() => removeField(i)}
                    className="text-destructive hover:text-destructive/80 p-0.5"
                    aria-label={`Remove field ${field.name}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => updateField(i, { label: e.target.value, name: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || field.name })}
                  placeholder="Field label"
                  className="w-full rounded border border-border px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring mb-1"
                />
                {field.type === 'select' && (
                  <input
                    type="text"
                    value={(field.options ?? []).join(', ')}
                    onChange={(e) => updateField(i, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                    placeholder="Options (comma-separated)"
                    className="w-full rounded border border-border px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-foreground">Decision Buttons</span>
            <button
              type="button"
              onClick={addAction}
              className="inline-flex items-center gap-0.5 text-xs text-blue-700 hover:underline"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          </div>
          {actions.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No buttons yet — AI will generate defaults if left empty.</p>
          )}
          <div className="space-y-2">
            {actions.map((action, i) => (
              <div key={i} className="flex items-center gap-1">
                <input
                  type="text"
                  value={action.label}
                  onChange={(e) => updateAction(i, { label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || action.value })}
                  placeholder="Button label"
                  className="flex-1 rounded border border-border px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <select
                  value={action.style ?? 'primary'}
                  onChange={(e) => updateAction(i, { style: e.target.value })}
                  className="rounded border border-border px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {TASK_ACTION_STYLES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeAction(i)}
                  className="text-destructive hover:text-destructive/80 p-0.5"
                  aria-label={`Remove action ${action.label}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Routing */}
      <div className="mt-4 pt-4 border-t border-border">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Routing</h4>
        <div className="mb-3">
          <FieldLabel htmlFor="task-routing-mode">Routing Mode</FieldLabel>
          <div className="flex items-center gap-2">
            <SelectInput
              id="task-routing-mode"
              value={(config.routing_mode as string) ?? 'policy_default'}
              onChange={(v) => updateConfig('routing_mode', v)}
              options={ROUTING_MODE_OPTIONS}
            />
            {(() => {
              if (!config.routing_mode || config.routing_mode === 'policy_default') return null
              const Icon = ROUTING_ICONS[config.routing_mode as string]
              return Icon ? <Icon className="h-4 w-4 text-muted-foreground shrink-0" /> : null
            })()}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Step Instructions Panel ────────────────────────────────────────────────

function simpleMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h4 class="font-semibold text-xs mt-2 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="font-semibold text-sm mt-2 mb-1">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="font-bold text-sm mt-2 mb-1">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li class="ml-3 list-disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-3 list-decimal">$2</li>')
    .replace(/\n/g, '<br/>')
}

function StepInstructionsPanel({ node, onUpdate }: Pick<NodeConfigPanelProps, 'node' | 'onUpdate'>) {
  const [previewMode, setPreviewMode] = useState(false)
  const data = node.data as Record<string, unknown>
  const config = (data.config ?? {}) as Record<string, unknown>
  const instructions = (config.instructions as string) ?? ''

  function updateConfig(field: string, value: unknown) {
    onUpdate(node.id, { ...data, config: { ...config, [field]: value } })
  }

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Instructions
        </h4>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPreviewMode(false)}
            className={cn(
              'rounded p-1 text-xs',
              !previewMode ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
            aria-label="Edit instructions"
            title="Edit"
          >
            <PenLine className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode(true)}
            className={cn(
              'rounded p-1 text-xs',
              previewMode ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
            aria-label="Preview instructions"
            title="Preview"
          >
            <Eye className="h-3 w-3" />
          </button>
        </div>
      </div>

      {previewMode ? (
        <div className="rounded-md border border-border bg-muted/30 px-2.5 py-2 text-xs min-h-[80px] overflow-y-auto max-h-60">
          {instructions ? (
            <div
              className="prose prose-xs dark:prose-invert max-w-none text-foreground"
              dangerouslySetInnerHTML={{ __html: simpleMarkdown(instructions) }}
            />
          ) : (
            <p className="text-muted-foreground italic">No instructions written yet.</p>
          )}
        </div>
      ) : (
        <>
          <textarea
            id="step-instructions-panel"
            value={instructions}
            onChange={(e) => updateConfig('instructions', e.target.value)}
            placeholder="Write step-by-step instructions for this task...&#10;&#10;Supports **bold**, *italic*, # headings, and - lists."
            rows={6}
            maxLength={5000}
            className="w-full rounded-md border border-border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring resize-y font-mono"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {instructions.length}/5000 — Visible to humans during task execution
          </p>
        </>
      )}
    </div>
  )
}

// ─── Main Config Panel ──────────────────────────────────────────────────────────

const NODE_TYPE_LABELS: Record<string, string> = {
  trigger: 'Trigger',
  action: 'Action',
  condition: 'Condition',
  wait: 'Wait / Delay',
  input: 'Input',
  output: 'Output',
  task: 'Task',
}

export function NodeConfigPanel({ node, onUpdate, onClose, entities }: NodeConfigPanelProps) {
  const nodeType = node.type ?? 'action'
  const data = node.data as Record<string, unknown>

  return (
    <div className="w-64 border-l bg-background flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div>
          <h3 className="text-xs font-semibold text-foreground">
            {NODE_TYPE_LABELS[nodeType] ?? 'Node'} Config
          </h3>
          <p className="text-xs text-muted-foreground truncate mt-0.5" title={node.id}>
            {(data.label as string) ?? node.id}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        {nodeType === 'trigger' && <TriggerConfig node={node} onUpdate={onUpdate} entities={entities} />}
        {nodeType === 'action' && <ActionConfig node={node} onUpdate={onUpdate} entities={entities} />}
        {nodeType === 'condition' && <ConditionConfig node={node} onUpdate={onUpdate} />}
        {nodeType === 'wait' && <WaitConfig node={node} onUpdate={onUpdate} />}
        {nodeType === 'input' && <InputConfig node={node} onUpdate={onUpdate} />}
        {nodeType === 'output' && <OutputConfig node={node} onUpdate={onUpdate} />}
        {nodeType === 'task' && <TaskConfig node={node} onUpdate={onUpdate} />}

        {/* Step instructions panel — shown for executable step types */}
        {(nodeType === 'action' || nodeType === 'condition' || nodeType === 'wait' || nodeType === 'task') && (
          <StepInstructionsPanel node={node} onUpdate={onUpdate} />
        )}
      </div>
    </div>
  )
}
