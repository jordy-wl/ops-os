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
        // Convert canvas to template steps
        const { trigger, steps } = canvasToTemplate(layout)

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
      <div className="flex items-center gap-3 border-b bg-white px-4 py-2 shrink-0">
        <Link
          href="/workflows"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Workflows
        </Link>
        <span className="text-gray-300">/</span>

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
              className="text-sm font-medium text-gray-900 border-b border-gray-400 bg-transparent outline-none px-0 py-0 w-48"
            />
            <button
              type="button"
              onClick={finishEditing}
              className="p-0.5 text-gray-400 hover:text-gray-700"
              aria-label="Confirm name"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={startEditing}
            className="flex items-center gap-1 text-sm font-medium text-gray-900 hover:text-gray-600 truncate"
          >
            {name}
            <Pencil className="h-3 w-3 text-gray-400" aria-hidden="true" />
          </button>
        )}

        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-500">Builder</span>

        {error && (
          <span className="ml-auto text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
            {error}
          </span>
        )}
      </div>

      {/* Canvas fills remaining height */}
      <div className="flex-1 min-h-0">
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
