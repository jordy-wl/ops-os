'use client'

import { useState } from 'react'
import { Eye, PenLine } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NodeConfigProps } from '../types'

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// ─── Component ──────────────────────────────────────────────────────────────

export function StepInstructionsPanel({ node, onUpdate }: Pick<NodeConfigProps, 'node' | 'onUpdate'>) {
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
            placeholder={'Write step-by-step instructions for this task...\n\nSupports **bold**, *italic*, # headings, and - lists.'}
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
