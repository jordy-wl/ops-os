'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'

interface VersionItem {
  id: string
  version: number
  format: string
  ai_generated: boolean
  created_at: string
}

interface DocumentToolbarProps {
  documentId: string
  title: string
  format: string
  filePath: string | null
  versions: VersionItem[]
  currentVersion: number
  isEditing: boolean
  onEditToggle: () => void
  onVersionChange: (documentId: string) => void
  onSaveEdit: () => void
  isSaving: boolean
}

export function DocumentToolbar({
  documentId,
  title,
  format,
  filePath,
  versions,
  currentVersion,
  isEditing,
  onEditToggle,
  onVersionChange,
  onSaveEdit,
  isSaving,
}: DocumentToolbarProps) {
  const [downloading, setDownloading] = useState(false)

  const handleDownload = useCallback(async () => {
    setDownloading(true)
    try {
      if (filePath) {
        // PDF with stored file — get signed URL
        const res = await fetch(`/api/documents/${documentId}?download=1`)
        if (res.ok) {
          const data = await res.json()
          if (data.data?.download_url) {
            window.open(data.data.download_url, '_blank')
            return
          }
        }
      }
      // Fallback: trigger print from iframe
      const iframe = document.querySelector(
        'iframe[title="Document preview"]'
      ) as HTMLIFrameElement | null
      if (iframe?.contentWindow) {
        iframe.contentWindow.print()
      }
    } finally {
      setDownloading(false)
    }
  }, [documentId, filePath])

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/30">
      {/* Left: title + version */}
      <div className="flex items-center gap-3 min-w-0">
        <h3 className="text-sm font-medium text-foreground truncate">
          {title}
        </h3>
        {versions.length > 1 && (
          <select
            value={documentId}
            onChange={(e) => onVersionChange(e.target.value)}
            className="h-7 rounded border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Select document version"
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.version}
                {v.ai_generated ? ' (AI)' : ''}
                {' — '}
                {new Date(v.created_at).toLocaleDateString()}
              </option>
            ))}
          </select>
        )}
        {versions.length <= 1 && (
          <span className="text-xs text-muted-foreground">
            v{currentVersion}
          </span>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 shrink-0">
        {format === 'html' && (
          <Button
            variant="outline"
            size="sm"
            onClick={onEditToggle}
            className="text-xs h-7"
          >
            {isEditing ? 'Cancel Edit' : 'Edit'}
          </Button>
        )}

        {isEditing && (
          <Button
            size="sm"
            onClick={onSaveEdit}
            disabled={isSaving}
            className="text-xs h-7"
          >
            {isSaving ? 'Saving...' : 'Save as New Version'}
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={downloading}
          className="text-xs h-7"
          aria-label="Download document"
        >
          {downloading ? '...' : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          )}
        </Button>
      </div>
    </div>
  )
}
