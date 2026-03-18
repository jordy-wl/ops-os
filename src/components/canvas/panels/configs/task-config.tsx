'use client'

import { useEffect, useRef } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { NodeConfigProps } from '../types'
import { FieldLabel, TextInput, SelectInput } from '../shared/form-primitives'
import { VariablePickerInput } from '../shared/variable-picker'
import { RoutingSection } from '../shared/routing-section'

// ─── Types ──────────────────────────────────────────────────────────────────

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

interface TaskAttachment {
  type: string
  value: string
}

interface TaskFormSchema {
  title?: string
  fields?: TaskFormField[]
  actions?: TaskFormAction[]
}

// ─── Constants ──────────────────────────────────────────────────────────────

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

const ATTACHMENT_TYPES = [
  { value: 'related_record', label: 'Related Record' },
  { value: 'url', label: 'URL' },
  { value: 'file', label: 'File' },
  { value: 'context_summary', label: 'Context Summary' },
]

// ─── Component ──────────────────────────────────────────────────────────────

export function TaskConfig({ node, onUpdate }: Pick<NodeConfigProps, 'node' | 'onUpdate'>) {
  const data = node.data as Record<string, unknown>
  const config = (data.config ?? {}) as Record<string, unknown>
  const schema = (config.task_form_schema ?? { title: '', fields: [], actions: [] }) as TaskFormSchema
  const fields = schema.fields ?? []
  const actions = schema.actions ?? []
  const attachments = (config.task_attachments ?? []) as TaskAttachment[]

  // Track whether approval pre-fill has run for this node
  const approvalPreFilled = useRef(false)

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

  // Attachment helpers
  function addAttachment() {
    updateConfig('task_attachments', [...attachments, { type: 'related_record', value: '' }])
  }

  function updateAttachment(index: number, patch: Partial<TaskAttachment>) {
    const next = attachments.map((a, i) => (i === index ? { ...a, ...patch } : a))
    updateConfig('task_attachments', next)
  }

  function removeAttachment(index: number) {
    updateConfig('task_attachments', attachments.filter((_, i) => i !== index))
  }

  // Approval Request auto-fill: detect label and pre-fill when fields are empty
  const nodeLabel = (data.label as string) ?? ''
  const isApprovalRequest = nodeLabel.toLowerCase().includes('approval')

  useEffect(() => {
    if (!isApprovalRequest || approvalPreFilled.current) return
    // Only pre-fill if title and actions are both empty
    const titleEmpty = !schema.title
    const actionsEmpty = actions.length === 0
    if (titleEmpty && actionsEmpty) {
      approvalPreFilled.current = true
      updateConfig('task_form_schema', {
        ...schema,
        title: 'Approval Required',
        actions: [
          { label: 'Approve', value: 'approve', style: 'primary' },
          { label: 'Reject', value: 'reject', style: 'destructive' },
        ],
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApprovalRequest])

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
          <VariablePickerInput
            id="task-title"
            value={schema.title ?? ''}
            onChange={(v) => updateSchema({ title: v })}
            placeholder="e.g. Review Client Onboarding"
            variables={[]}
            autoSuggestion="block.name"
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

      {/* Attachments */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Attachments</h4>
          <button
            type="button"
            onClick={addAttachment}
            className="inline-flex items-center gap-0.5 text-xs text-blue-700 hover:underline"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
        {attachments.length === 0 && (
          <p className="text-xs text-muted-foreground italic mb-3">No attachments configured.</p>
        )}
        <div className="space-y-2 mb-3">
          {attachments.map((att, i) => (
            <div key={i} className="flex items-start gap-1">
              <select
                value={att.type}
                onChange={(e) => updateAttachment(i, { type: e.target.value })}
                className="rounded border border-border px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring shrink-0"
              >
                {ATTACHMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={att.value}
                onChange={(e) => updateAttachment(i, { value: e.target.value })}
                placeholder={att.type === 'url' ? 'https://...' : att.type === 'related_record' ? 'Block ID or {{var}}' : att.type === 'context_summary' ? 'Summary template...' : 'File path or ID'}
                className="flex-1 rounded border border-border px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => removeAttachment(i)}
                className="text-destructive hover:text-destructive/80 p-0.5 shrink-0"
                aria-label={`Remove attachment ${i + 1}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Routing */}
      <RoutingSection
        routingMode={(config.routing_mode as string) ?? 'policy_default'}
        requiredPermissions={(config.required_permissions as string[]) ?? []}
        onRoutingModeChange={(v) => updateConfig('routing_mode', v)}
        onPermissionsChange={(v) => updateConfig('required_permissions', v)}
        compact
      />
    </>
  )
}
