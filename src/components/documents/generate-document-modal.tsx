'use client'

import { useState, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Template = {
  id: string
  name: string
  metadata: Record<string, unknown>
}

export function GenerateDocumentModal({
  open,
  onClose,
  blockId,
  blockName,
}: {
  open: boolean
  onClose: () => void
  blockId: string
  blockName: string
}) {
  const [mode, setMode] = useState<'template' | 'ai'>('template')
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [prompt, setPrompt] = useState('')
  const [outputFormat, setOutputFormat] = useState<'html' | 'pdf'>('html')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  // Fetch templates when dialog opens
  useEffect(() => {
    if (!open) return

    fetch('/api/blocks?type=document_template&limit=50')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.data)) {
          setTemplates(data.data)
        }
      })
      .catch(() => {
        // Silently fail — user can still use AI mode
      })
  }, [open])

  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    setResult(null)

    try {
      const payload: Record<string, unknown> = {
        source_block_id: blockId,
        output_format: outputFormat,
        generate_pdf: outputFormat === 'pdf',
      }

      if (mode === 'template') {
        if (!selectedTemplateId) {
          setResult({ success: false, message: 'Please select a template' })
          setGenerating(false)
          return
        }
        payload.template_id = selectedTemplateId
      } else {
        if (!prompt.trim()) {
          setResult({ success: false, message: 'Please enter a prompt' })
          setGenerating(false)
          return
        }
        payload.prompt = prompt
      }

      const res = await fetch('/api/actions/document.generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error?.message ?? `Generation failed (${res.status})`)
      }

      setResult({ success: true, message: 'Document generated successfully!' })
    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : 'Generation failed',
      })
    } finally {
      setGenerating(false)
    }
  }, [blockId, mode, selectedTemplateId, prompt, outputFormat])

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Document</DialogTitle>
          <DialogDescription>
            Source block: <span className="font-medium text-foreground">{blockName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode Toggle */}
          <div className="flex gap-2" role="group" aria-label="Document generation mode">
            <button
              onClick={() => setMode('template')}
              aria-pressed={mode === 'template'}
              className={cn(
                'flex-1 py-2 text-sm font-medium rounded-md border transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                mode === 'template'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-ring'
              )}
            >
              From Template
            </button>
            <button
              onClick={() => setMode('ai')}
              aria-pressed={mode === 'ai'}
              className={cn(
                'flex-1 py-2 text-sm font-medium rounded-md border transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                mode === 'ai'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-ring'
              )}
            >
              AI Generate
            </button>
          </div>

          {/* Template Selection */}
          {mode === 'template' && (
            <div>
              <label htmlFor="template-select" className="block text-sm font-medium text-foreground mb-1">
                Select Template
              </label>
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No templates found. Create one in the Document Library.
                </p>
              ) : (
                <select
                  id="template-select"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Choose a template...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.metadata?.category ? ` (${t.metadata.category})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* AI Prompt */}
          {mode === 'ai' && (
            <div>
              <label htmlFor="doc-prompt" className="block text-sm font-medium text-foreground mb-1">
                Generation Prompt
              </label>
              <textarea
                id="doc-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={`Draft a client onboarding proposal for ${blockName}...`}
              />
            </div>
          )}

          {/* Output Format */}
          <div>
            <label htmlFor="output-format" className="block text-sm font-medium text-foreground mb-1">
              Output Format
            </label>
            <select
              id="output-format"
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value as 'html' | 'pdf')}
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="html">HTML (preview in browser)</option>
              <option value="pdf">PDF (download)</option>
            </select>
          </div>

          {/* Result Message */}
          {result && (
            <div
              className={`rounded-md px-4 py-3 text-[13px] ${
                result.success
                  ? 'bg-success/10 text-success border border-success/20'
                  : 'bg-destructive/5 text-destructive border border-destructive/20'
              }`}
              role="alert"
            >
              {result.message}
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/80 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {generating ? 'Generating...' : 'Generate'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
