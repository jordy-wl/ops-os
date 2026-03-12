'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
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

const TRIGGER_LABELS: Record<string, string> = {
  manual: 'Manual',
  event: 'Event',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

export function WorkflowTemplatesClient({ initialTemplates }: WorkflowTemplatesClientProps) {
  const [showCreate, setShowCreate] = useState(false)
  const templates = initialTemplates

  if (!templates) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center" role="alert">
        <p className="text-sm font-medium text-red-800">Failed to load templates.</p>
        <p className="mt-1 text-sm text-red-600">Refresh the page to try again.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Header with create button */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground">
          {templates.length} template{templates.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => setShowCreate(true)}
          className={cn(
            'px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground',
            'hover:bg-primary/80 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
        >
          + Create Template
        </button>
      </div>

      {/* Empty state */}
      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg font-semibold text-foreground mb-2">No workflow templates yet</p>
          <p className="text-sm text-muted-foreground mb-6">
            Create a template to define reusable workflows with triggers, steps, and conditions.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className={cn(
              'px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium',
              'hover:bg-primary/80 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
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
              className="rounded-lg border border-border bg-background p-4 hover:border-ring transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-semibold text-foreground line-clamp-1">{tmpl.name}</h3>
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
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{tmpl.description}</p>
              )}

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className="font-medium text-foreground">{tmpl.applies_to_type}</span>
                </span>
                <span>{tmpl.step_count} step{tmpl.step_count !== 1 ? 's' : ''}</span>
                {tmpl.trigger_event_pattern && (
                  <span className="text-purple-600 truncate max-w-[80px] sm:max-w-[120px]" title={tmpl.trigger_event_pattern}>
                    on: {tmpl.trigger_event_pattern}
                  </span>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span>Created {formatDate(tmpl.created_at)}</span>
                <Link
                  href={`/workflows/${tmpl.id}/builder`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  <Pencil className="h-3 w-3" aria-hidden="true" />
                  Edit in Builder
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal — name only, redirects to builder */}
      {showCreate && (
        <CreateTemplateModal onClose={() => setShowCreate(false)} />
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

// ─── Create Template Modal (Canvas-first: name only → redirect to builder) ──

interface CreateTemplateModalProps {
  onClose: () => void
}

function CreateTemplateModal({ onClose }: CreateTemplateModalProps) {
  const router = useRouter()
  const [name, setName] = useState('')
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'workflow_template',
          name: trimmed,
          metadata: {
            applies_to_type: 'client',
            trigger: { type: 'manual' },
            steps: [],
          },
        }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json?.error?.message ?? 'Failed to create template')
        return
      }

      // Redirect to canvas builder immediately
      const blockId = json.data?.id
      if (blockId) {
        router.push(`/workflows/${blockId}/builder`)
      }
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

      <div className="relative w-full max-w-sm rounded-lg bg-background p-6 shadow-lg">
        <h2 id="create-template-title" className="text-lg font-semibold text-foreground mb-1">
          New Workflow
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Give it a name, then build it on the canvas.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="tmpl-name" className="block text-sm font-medium text-foreground mb-1">
            Workflow Name
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
            className="mb-4 w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />

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
                'px-4 py-2 rounded-md text-sm font-medium border border-border text-foreground',
                'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground',
                'hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {submitting ? 'Creating…' : 'Create & Open Builder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
