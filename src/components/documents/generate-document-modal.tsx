'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

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
  const dialogRef = useRef<HTMLDivElement>(null)

  // Fetch templates on mount
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

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Close on outside click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose]
  )

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

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Generate document"
    >
      <div
        ref={dialogRef}
        className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Generate Document</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          <p className="text-sm text-gray-500">
            Source block: <span className="font-medium text-gray-700">{blockName}</span>
          </p>

          {/* Mode Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode('template')}
              className={`flex-1 py-2 text-sm font-medium rounded-md border transition ${
                mode === 'template'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              From Template
            </button>
            <button
              onClick={() => setMode('ai')}
              className={`flex-1 py-2 text-sm font-medium rounded-md border transition ${
                mode === 'ai'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              AI Generate
            </button>
          </div>

          {/* Template Selection */}
          {mode === 'template' && (
            <div>
              <label htmlFor="template-select" className="block text-sm font-medium text-gray-700 mb-1">
                Select Template
              </label>
              {templates.length === 0 ? (
                <p className="text-sm text-gray-500 py-2">
                  No templates found. Create one in the Document Library.
                </p>
              ) : (
                <select
                  id="template-select"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
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
              <label htmlFor="doc-prompt" className="block text-sm font-medium text-gray-700 mb-1">
                Generation Prompt
              </label>
              <textarea
                id="doc-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                placeholder={`Draft a client onboarding proposal for ${blockName}...`}
              />
            </div>
          )}

          {/* Output Format */}
          <div>
            <label htmlFor="output-format" className="block text-sm font-medium text-gray-700 mb-1">
              Output Format
            </label>
            <select
              id="output-format"
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value as 'html' | 'pdf')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              <option value="html">HTML (preview in browser)</option>
              <option value="pdf">PDF (download)</option>
            </select>
          </div>

          {/* Result Message */}
          {result && (
            <div
              className={`rounded-md px-4 py-3 text-sm ${
                result.success
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
              role="alert"
            >
              {result.message}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  )
}
