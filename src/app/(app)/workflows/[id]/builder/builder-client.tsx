'use client'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Pencil } from 'lucide-react'
import { WorkflowCanvas } from '@/components/canvas/workflow-canvas'
import { canvasToTemplate, type CanvasLayout } from '@/lib/workflow/canvas-layout'

interface WorkflowBuilderClientProps {
  templateId: string
  templateName: string
  appliesToType: string
  initialLayout: CanvasLayout
}

export function WorkflowBuilderClient({
  templateId,
  templateName,
  appliesToType,
  initialLayout,
}: WorkflowBuilderClientProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState(templateName)
  const [editing, setEditing] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const handleSave = useCallback(
    async (layout: CanvasLayout) => {
      setSaving(true)
      setError(null)

      try {
        // Convert canvas to template steps + data flow
        const { trigger, steps, data_inputs, data_outputs } = canvasToTemplate(layout)

        // Update the template block with name + metadata
        const res = await fetch(`/api/blocks/${templateId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            metadata: {
              applies_to_type: appliesToType,
              trigger,
              steps,
              ...(data_inputs ? { data_inputs } : {}),
              ...(data_outputs ? { data_outputs } : {}),
              canvas_layout: layout,
            },
          }),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error?.message ?? `Save failed (${res.status})`)
        }

        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed')
      } finally {
        setSaving(false)
      }
    },
    [templateId, name, appliesToType, router]
  )

  function startEditing() {
    setEditing(true)
    setTimeout(() => nameRef.current?.select(), 0)
  }

  function finishEditing() {
    setEditing(false)
    if (!name.trim()) setName(templateName)
  }

  return (
    <>
      {/* Header bar */}
      <div className="flex items-center gap-3 border-b bg-background px-4 py-2 shrink-0">
        <Link
          href="/workflows"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Workflows
        </Link>
        <span className="text-border">/</span>

        {editing ? (
          <span className="flex items-center gap-1">
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={finishEditing}
              onKeyDown={(e) => { if (e.key === 'Enter') finishEditing() }}
              maxLength={255}
              className="text-sm font-medium text-foreground border-b border-border bg-transparent outline-none px-0 py-0 w-48"
            />
            <button
              type="button"
              onClick={finishEditing}
              className="p-0.5 text-muted-foreground hover:text-foreground rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Confirm name"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={startEditing}
            className="flex items-center gap-1 text-sm font-medium text-foreground hover:text-muted-foreground truncate rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Edit workflow name: ${name}`}
          >
            {name}
            <Pencil className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
          </button>
        )}

        <span className="text-border">/</span>
        <span className="text-sm text-muted-foreground">Builder</span>

        {error && (
          <span className="ml-auto text-xs text-destructive bg-destructive/5 px-2 py-1 rounded">
            {error}
          </span>
        )}
      </div>

      {/* Canvas fills remaining height */}
      <div className="flex-1 min-h-0 bg-muted">
        <WorkflowCanvas
          initialLayout={initialLayout}
          templateName={name}
          onSave={handleSave}
          saving={saving}
        />
      </div>
    </>
  )
}
