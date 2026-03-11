'use client'

import { useState, useCallback } from 'react'

type Variable = {
  name: string
  type: 'string' | 'number' | 'date' | 'currency'
  required?: boolean
}

const COMMON_VARIABLES: Variable[] = [
  { name: 'block.name', type: 'string', required: true },
  { name: 'block.type', type: 'string' },
  { name: 'block.state', type: 'string' },
  { name: 'block.metadata.jurisdiction', type: 'string' },
  { name: 'block.metadata.entity_type', type: 'string' },
  { name: 'block.metadata.deal_value', type: 'currency' },
  { name: 'brand.company_name', type: 'string' },
  { name: 'brand.tagline', type: 'string' },
]

export function TemplateEditor({
  initialContent,
  initialVariables,
  initialCategory,
  initialOutputFormat,
  onSave,
}: {
  initialContent?: string
  initialVariables?: Variable[]
  initialCategory?: string
  initialOutputFormat?: string
  onSave: (data: {
    template_content: string
    variables: Variable[]
    category: string
    output_format: string
  }) => void
}) {
  const [content, setContent] = useState(initialContent ?? '')
  const [variables, setVariables] = useState<Variable[]>(initialVariables ?? [])
  const [category, setCategory] = useState(initialCategory ?? 'other')
  const [outputFormat, setOutputFormat] = useState(initialOutputFormat ?? 'html')
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)

  const insertVariable = useCallback((varName: string) => {
    const insertion = `{{${varName}}}`
    setContent((prev) => prev + insertion)

    // Auto-add to variables list if not present
    if (!variables.some((v) => v.name === varName)) {
      setVariables((prev) => [...prev, { name: varName, type: 'string' }])
    }
  }, [variables])

  const handlePreview = useCallback(() => {
    // Simple client-side preview — replace variables with sample data
    let preview = content
    preview = preview.replace(/\{\{block\.name\}\}/g, 'Acme Corporation')
    preview = preview.replace(/\{\{block\.type\}\}/g, 'client')
    preview = preview.replace(/\{\{block\.state\}\}/g, 'active')
    preview = preview.replace(/\{\{block\.metadata\.jurisdiction\}\}/g, 'AU')
    preview = preview.replace(/\{\{block\.metadata\.entity_type\}\}/g, 'company')
    preview = preview.replace(/\{\{block\.metadata\.deal_value\}\}/g, '$450,000')
    preview = preview.replace(/\{\{brand\.company_name\}\}/g, 'Your Company')
    preview = preview.replace(/\{\{brand\.tagline\}\}/g, 'Your tagline here')
    // Leave any unresolved variables visible
    setPreviewHtml(preview)
  }, [content])

  const handleSave = useCallback(() => {
    onSave({
      template_content: content,
      variables,
      category,
      output_format: outputFormat,
    })
  }, [content, variables, category, outputFormat, onSave])

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border border-border px-3 py-1.5 text-sm"
          aria-label="Template category"
        >
          <option value="contract">Contract</option>
          <option value="proposal">Proposal</option>
          <option value="nda">NDA</option>
          <option value="report">Report</option>
          <option value="letter">Letter</option>
          <option value="invoice">Invoice</option>
          <option value="other">Other</option>
        </select>
        <select
          value={outputFormat}
          onChange={(e) => setOutputFormat(e.target.value)}
          className="rounded-md border border-border px-3 py-1.5 text-sm"
          aria-label="Output format"
        >
          <option value="html">HTML</option>
          <option value="pdf">PDF</option>
          <option value="markdown">Markdown</option>
        </select>
        <button
          onClick={handlePreview}
          className="ml-auto rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Preview
        </button>
        <button
          onClick={handleSave}
          className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:bg-primary/80"
        >
          Save Template
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Variable Palette */}
        <div className="lg:col-span-1 order-2 lg:order-1">
          <h3 className="text-sm font-medium text-foreground mb-3">Insert Variable</h3>
          <div className="space-y-1">
            {COMMON_VARIABLES.map((v) => (
              <button
                key={v.name}
                onClick={() => insertVariable(v.name)}
                className="block w-full text-left px-3 py-1.5 text-xs rounded hover:bg-muted font-mono text-muted-foreground"
                title={`Insert {{${v.name}}}`}
              >
                {'{{'}
                {v.name}
                {'}}'}
              </button>
            ))}
          </div>

          {variables.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-foreground mb-2">Used Variables</h3>
              <ul className="text-xs text-muted-foreground space-y-1">
                {variables.map((v) => (
                  <li key={v.name} className="flex items-center gap-2">
                    <span className="font-mono">{v.name}</span>
                    <span className="text-muted-foreground">({v.type})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Editor */}
        <div className="lg:col-span-3 order-1 lg:order-2">
          <label htmlFor="template-content" className="sr-only">Template content</label>
          <textarea
            id="template-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your template content here... Use {{block.name}} for variable placeholders.

Supports HTML or Markdown:

# Client Onboarding Report

**Client:** {{block.name}}
**Jurisdiction:** {{block.metadata.jurisdiction}}
**Entity Type:** {{block.metadata.entity_type}}

---

## Overview

This document outlines the onboarding process for {{block.name}}..."
            className="w-full min-h-[400px] rounded-md border border-border px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            spellCheck={false}
          />
        </div>
      </div>

      {/* Preview Panel */}
      {previewHtml !== null && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between bg-muted px-4 py-2 border-b">
            <h3 className="text-sm font-medium text-foreground">Preview</h3>
            <button
              onClick={() => setPreviewHtml(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
              aria-label="Close preview"
            >
              Close
            </button>
          </div>
          <div
            className="p-6 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      )}
    </div>
  )
}
