'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export { type WorkflowTemplateItem, mapBlockToTemplate } from '@/lib/workflows/template-mapper'
import type { WorkflowTemplateItem } from '@/lib/workflows/template-mapper'

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
      <div className="rounded-md border border-destructive/20 bg-destructive/5 p-6 text-center" role="alert">
        <p className="text-[13px] font-medium text-destructive">Failed to load templates.</p>
        <p className="mt-1 text-[13px] text-muted-foreground">Refresh the page to try again.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Header with create button */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-[13px] text-muted-foreground">
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
          <p className="text-title text-foreground mb-2">No workflow templates yet</p>
          <p className="text-[13px] text-muted-foreground mb-6">
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
              className="rounded-xl border border-border bg-card p-6 hover-card"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-medium text-foreground line-clamp-1">{tmpl.name}</h3>
                <span
                  className="shrink-0 ml-2 inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                >
                  {TRIGGER_LABELS[tmpl.trigger_type] ?? tmpl.trigger_type}
                </span>
              </div>

              {tmpl.description && (
                <p className="text-[13px] text-muted-foreground mb-3 line-clamp-2">{tmpl.description}</p>
              )}

              <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className="font-medium text-foreground">{tmpl.applies_to_type}</span>
                </span>
                <span>{tmpl.step_count} step{tmpl.step_count !== 1 ? 's' : ''}</span>
                {tmpl.trigger_event_pattern && (
                  <span className="text-muted-foreground truncate max-w-[80px] sm:max-w-[120px]" title={tmpl.trigger_event_pattern}>
                    on: {tmpl.trigger_event_pattern}
                  </span>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-[13px] text-muted-foreground">
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
      const blockId = json.data?.block?.id
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
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New Workflow</DialogTitle>
          <DialogDescription>
            Give it a name, then build it on the canvas.
          </DialogDescription>
        </DialogHeader>

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
            <p role="alert" className="mb-4 text-[12px] text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
