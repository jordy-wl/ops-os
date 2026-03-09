'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

export interface WorkflowTemplateItem {
  id: string
  name: string
  applies_to_type: string
  trigger_type: string
  trigger_event_pattern?: string
  step_count: number
  description?: string
  created_at: string
}

interface WorkflowTemplatesClientProps {
  initialTemplates: WorkflowTemplateItem[] | null
}

const STEP_TYPE_LABELS: Record<string, string> = {
  emit_event: 'Emit Event',
  run_action: 'Run Action',
  wait: 'Wait',
  condition: 'Condition',
}

const TRIGGER_LABELS: Record<string, string> = {
  manual: 'Manual',
  event: 'Event',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

export function WorkflowTemplatesClient({ initialTemplates }: WorkflowTemplatesClientProps) {
  const [showCreate, setShowCreate] = useState(false)
  const [templates, setTemplates] = useState(initialTemplates)

  if (!templates) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center" role="alert">
        <p className="text-sm font-medium text-red-800">Failed to load templates.</p>
        <p className="mt-1 text-sm text-red-600">Refresh the page to try again.</p>
      </div>
    )
  }

  function handleCreated() {
    // Refetch templates
    fetch('/api/blocks?type=workflow_template&limit=100')
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          const mapped = (json.data as Array<Record<string, unknown>>).map(mapBlockToTemplate)
          setTemplates(mapped)
        }
      })
      .catch(() => {})
  }

  return (
    <div>
      {/* Header with create button */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-gray-500">
          {templates.length} template{templates.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => setShowCreate(true)}
          className={cn(
            'px-4 py-2 rounded-md text-sm font-medium bg-gray-900 text-white',
            'hover:bg-gray-700 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900'
          )}
        >
          + Create Template
        </button>
      </div>

      {/* Empty state */}
      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg font-semibold text-gray-900 mb-2">No workflow templates yet</p>
          <p className="text-sm text-gray-500 mb-6">
            Create a template to define reusable workflows with triggers, steps, and conditions.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className={cn(
              'px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium',
              'hover:bg-gray-700 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900'
            )}
          >
            Create Your First Template
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((tmpl) => (
            <div
              key={tmpl.id}
              className="rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">{tmpl.name}</h3>
                <span
                  className={cn(
                    'shrink-0 ml-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                    tmpl.trigger_type === 'event'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-blue-100 text-blue-800'
                  )}
                >
                  {TRIGGER_LABELS[tmpl.trigger_type] ?? tmpl.trigger_type}
                </span>
              </div>

              {tmpl.description && (
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">{tmpl.description}</p>
              )}

              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <span className="font-medium text-gray-700">{tmpl.applies_to_type}</span>
                </span>
                <span>{tmpl.step_count} step{tmpl.step_count !== 1 ? 's' : ''}</span>
                {tmpl.trigger_event_pattern && (
                  <span className="text-purple-600 truncate max-w-[120px]" title={tmpl.trigger_event_pattern}>
                    on: {tmpl.trigger_event_pattern}
                  </span>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                Created {formatDate(tmpl.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateTemplateModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}

// ─── Map block to template item ──────────────────────────────────────────────

export function mapBlockToTemplate(block: Record<string, unknown>): WorkflowTemplateItem {
  const meta = (block.metadata ?? {}) as Record<string, unknown>
  const trigger = (meta.trigger ?? {}) as Record<string, unknown>
  const steps = (meta.steps ?? []) as unknown[]
  return {
    id: block.id as string,
    name: block.name as string,
    applies_to_type: (meta.applies_to_type as string) ?? 'unknown',
    trigger_type: (trigger.type as string) ?? 'manual',
    trigger_event_pattern: trigger.event_pattern as string | undefined,
    step_count: steps.length,
    description: (meta.description as string) ?? undefined,
    created_at: block.created_at as string,
  }
}

// ─── Create Template Modal ───────────────────────────────────────────────────

interface CreateTemplateModalProps {
  onClose: () => void
  onCreated: () => void
}

interface StepDraft {
  name: string
  type: 'emit_event' | 'run_action' | 'wait' | 'condition'
  event_type?: string
  action_type?: string
  wait_seconds?: number
  condition?: string
}

const STEP_TYPES = ['emit_event', 'run_action', 'wait', 'condition'] as const
const BLOCK_TYPES = ['client', 'deal', 'project', 'contact', 'contract']

function CreateTemplateModal({ onClose, onCreated }: CreateTemplateModalProps) {
  const [name, setName] = useState('')
  const [appliesToType, setAppliesToType] = useState('client')
  const [triggerType, setTriggerType] = useState<'manual' | 'event'>('manual')
  const [eventPattern, setEventPattern] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState<StepDraft[]>([
    { name: 'step_1', type: 'emit_event', event_type: '' },
  ])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function addStep() {
    setSteps((prev) => [
      ...prev,
      { name: `step_${prev.length + 1}`, type: 'emit_event', event_type: '' },
    ])
  }

  function removeStep(index: number) {
    if (steps.length <= 1) return
    setSteps((prev) => prev.filter((_, i) => i !== index))
  }

  function updateStep(index: number, field: string, value: unknown) {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || steps.length === 0) return

    setSubmitting(true)
    setError(null)

    const trigger = triggerType === 'manual'
      ? { type: 'manual' as const }
      : { type: 'event' as const, event_pattern: eventPattern }

    const cleanSteps = steps.map((s) => {
      const step: Record<string, unknown> = { name: s.name, type: s.type }
      if (s.type === 'emit_event' && s.event_type) step.event_type = s.event_type
      if (s.type === 'run_action' && s.action_type) step.action_type = s.action_type
      if (s.type === 'wait' && s.wait_seconds) step.wait_seconds = Number(s.wait_seconds)
      if (s.type === 'condition' && s.condition) step.condition = s.condition
      return step
    })

    try {
      const res = await fetch('/api/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'workflow_template',
          name: trimmed,
          metadata: {
            applies_to_type: appliesToType,
            trigger,
            steps: cleanSteps,
            ...(description.trim() ? { description: description.trim() } : {}),
          },
        }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json?.error?.message ?? 'Failed to create template')
        return
      }

      onCreated()
      onClose()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-template-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-lg rounded-lg bg-white p-6 shadow-lg max-h-[85vh] overflow-y-auto">
        <h2 id="create-template-title" className="text-lg font-semibold text-gray-900 mb-4">
          Create Workflow Template
        </h2>

        <form onSubmit={handleSubmit} noValidate>
          {/* Name */}
          <label htmlFor="tmpl-name" className="block text-sm font-medium text-gray-700 mb-1">
            Template Name
          </label>
          <input
            ref={nameRef}
            id="tmpl-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Client Onboarding"
            maxLength={255}
            required
            className="mb-4 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />

          {/* Description */}
          <label htmlFor="tmpl-desc" className="block text-sm font-medium text-gray-700 mb-1">
            Description <span className="text-gray-400">(optional)</span>
          </label>
          <input
            id="tmpl-desc"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of what this workflow does"
            maxLength={500}
            className="mb-4 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />

          {/* Applies to type */}
          <label htmlFor="tmpl-type" className="block text-sm font-medium text-gray-700 mb-1">
            Applies To
          </label>
          <select
            id="tmpl-type"
            value={appliesToType}
            onChange={(e) => setAppliesToType(e.target.value)}
            className="mb-4 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            {BLOCK_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>

          {/* Trigger */}
          <label htmlFor="tmpl-trigger" className="block text-sm font-medium text-gray-700 mb-1">
            Trigger
          </label>
          <select
            id="tmpl-trigger"
            value={triggerType}
            onChange={(e) => setTriggerType(e.target.value as 'manual' | 'event')}
            className="mb-2 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="manual">Manual</option>
            <option value="event">Event</option>
          </select>
          {triggerType === 'event' && (
            <input
              type="text"
              value={eventPattern}
              onChange={(e) => setEventPattern(e.target.value)}
              placeholder="e.g. block.created"
              maxLength={100}
              className="mb-4 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          )}
          {triggerType === 'manual' && <div className="mb-2" />}

          {/* Steps */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">Steps</p>
              <button
                type="button"
                onClick={addStep}
                className="text-xs text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 rounded"
              >
                + Add Step
              </button>
            </div>

            <div className="space-y-3">
              {steps.map((step, idx) => (
                <div key={idx} className="rounded-md border border-gray-200 p-3 bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-gray-400 w-5">{idx + 1}</span>
                    <input
                      type="text"
                      value={step.name}
                      onChange={(e) => updateStep(idx, 'name', e.target.value)}
                      placeholder="step_name"
                      className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-900"
                    />
                    <select
                      value={step.type}
                      onChange={(e) => updateStep(idx, 'type', e.target.value)}
                      className="rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-900"
                    >
                      {STEP_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {STEP_TYPE_LABELS[t] ?? t}
                        </option>
                      ))}
                    </select>
                    {steps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeStep(idx)}
                        className="text-xs text-red-500 hover:text-red-700"
                        aria-label={`Remove step ${idx + 1}`}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {/* Step-type-specific field */}
                  {step.type === 'emit_event' && (
                    <input
                      type="text"
                      value={step.event_type ?? ''}
                      onChange={(e) => updateStep(idx, 'event_type', e.target.value)}
                      placeholder="Event type (e.g. onboarding.started)"
                      className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-900"
                    />
                  )}
                  {step.type === 'run_action' && (
                    <input
                      type="text"
                      value={step.action_type ?? ''}
                      onChange={(e) => updateStep(idx, 'action_type', e.target.value)}
                      placeholder="Action type (e.g. send_notification)"
                      className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-900"
                    />
                  )}
                  {step.type === 'wait' && (
                    <input
                      type="number"
                      value={step.wait_seconds ?? 60}
                      onChange={(e) => updateStep(idx, 'wait_seconds', parseInt(e.target.value) || 60)}
                      placeholder="Wait seconds"
                      min={1}
                      className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-900"
                    />
                  )}
                  {step.type === 'condition' && (
                    <input
                      type="text"
                      value={step.condition ?? ''}
                      onChange={(e) => updateStep(idx, 'condition', e.target.value)}
                      placeholder="Condition expression"
                      className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-900"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <p role="alert" className="mb-4 text-xs text-red-600">
              {error}
            </p>
          )}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium border border-gray-200 text-gray-700',
                'hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900'
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim() || steps.length === 0}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium bg-gray-900 text-white',
                'hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {submitting ? 'Creating…' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
