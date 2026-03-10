'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { WorkflowCanvas } from '@/components/canvas/workflow-canvas'
import { canvasToTemplate, type CanvasLayout } from '@/lib/workflow/canvas-layout'

interface WorkflowBuilderClientProps {
  templateId: string
  templateName: string
  initialLayout: CanvasLayout
}

export function WorkflowBuilderClient({
  templateId,
  templateName,
  initialLayout,
}: WorkflowBuilderClientProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = useCallback(
    async (layout: CanvasLayout) => {
      setSaving(true)
      setError(null)

      try {
        // Convert canvas to template steps
        const { trigger, steps } = canvasToTemplate(layout)

        // Update the template block metadata with both steps and canvas_layout
        const res = await fetch(`/api/blocks/${templateId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            metadata: {
              applies_to_type: 'client', // preserved from existing template
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
    [templateId, router]
  )

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
        <span className="text-sm font-medium text-gray-900 truncate">{templateName}</span>
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
          templateName={templateName}
          onSave={handleSave}
          saving={saving}
        />
      </div>
    </>
  )
}
