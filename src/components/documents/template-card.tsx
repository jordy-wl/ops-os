'use client'

import Link from 'next/link'

const CATEGORY_LABELS: Record<string, string> = {
  contract: 'Contract',
  proposal: 'Proposal',
  nda: 'NDA',
  report: 'Report',
  letter: 'Letter',
  invoice: 'Invoice',
  other: 'Other',
}

const CATEGORY_COLORS: Record<string, string> = {
  contract: 'bg-muted text-foreground',
  proposal: 'bg-muted text-foreground',
  nda: 'bg-muted text-foreground',
  report: 'bg-muted text-foreground',
  letter: 'bg-muted text-muted-foreground',
  invoice: 'bg-muted text-foreground',
  other: 'bg-muted text-muted-foreground',
}

export interface TemplateData {
  id: string
  name: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

interface TemplateCardProps {
  template: TemplateData
}

export function TemplateCard({ template }: TemplateCardProps) {
  const category = (template.metadata?.category as string) ?? 'other'
  const variables = (template.metadata?.variables as Array<{ name: string }>) ?? []
  const structureDesc = (template.metadata?.structure_description as string) ?? ''
  const fileName = (template.metadata?.reference_file_name as string) ?? ''
  const mimeType = (template.metadata?.reference_mime_type as string) ?? ''

  const fileTypeLabel = getFileTypeLabel(mimeType)

  return (
    <Link
      href={`/blocks/${template.id}`}
      className="block border border-border rounded-lg p-4 hover:border-ring hover:shadow-sm transition group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      role="listitem"
    >
      {/* Header: name + category badge */}
      <div className="flex items-start justify-between mb-2 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 text-muted-foreground" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </span>
          <h3 className="font-medium text-foreground truncate text-sm">
            {template.name}
          </h3>
        </div>
        <span
          className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other}`}
        >
          {CATEGORY_LABELS[category] ?? category}
        </span>
      </div>

      {/* Structure description */}
      {structureDesc && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
          {structureDesc}
        </p>
      )}

      {/* Variables */}
      {variables.length > 0 && (
        <p className="text-xs text-muted-foreground mb-2">
          {variables.length} variable{variables.length !== 1 ? 's' : ''}:{' '}
          {variables.slice(0, 3).map((v) => v.name).join(', ')}
          {variables.length > 3 ? '...' : ''}
        </p>
      )}

      {/* Footer: file type + date */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
        {fileTypeLabel && <span>{fileTypeLabel}</span>}
        {fileName && !fileTypeLabel && (
          <span className="truncate max-w-[140px]">{fileName}</span>
        )}
        {!fileTypeLabel && !fileName && <span />}
        <span>{new Date(template.updated_at).toLocaleDateString()}</span>
      </div>
    </Link>
  )
}

function getFileTypeLabel(mime: string): string {
  if (mime.includes('pdf')) return 'PDF'
  if (mime.includes('html')) return 'HTML'
  if (mime.includes('markdown')) return 'Markdown'
  if (mime.includes('wordprocessing') || mime.includes('docx')) return 'DOCX'
  if (mime.includes('plain')) return 'Text'
  return ''
}
