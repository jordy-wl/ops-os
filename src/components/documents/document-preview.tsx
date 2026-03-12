'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { DocumentToolbar } from './document-toolbar'
import { VersionHistory } from './version-history'
import { InlineEditor } from './inline-editor'

interface DocumentRecord {
  id: string
  title: string
  version: number
  format: string
  html_content: string | null
  file_path: string | null
  ai_generated: boolean
  created_at: string
}

interface VersionItem {
  id: string
  title: string
  version: number
  format: string
  ai_generated: boolean
  created_by: string
  created_at: string
}

interface DocumentPreviewProps {
  /** Document ID to load, or null to show document list */
  documentId: string | null
  blockId: string
  open: boolean
  onClose: () => void
}

export function DocumentPreview({
  documentId: initialDocId,
  blockId,
  open,
  onClose,
}: DocumentPreviewProps) {
  const [documentId, setDocumentId] = useState(initialDocId)
  const [document, setDocument] = useState<DocumentRecord | null>(null)
  const [versions, setVersions] = useState<VersionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editedHtml, setEditedHtml] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showVersions, setShowVersions] = useState(false)

  // Reset when documentId prop changes
  useEffect(() => {
    setDocumentId(initialDocId)
  }, [initialDocId])

  // Fetch document content
  useEffect(() => {
    if (!documentId || !open) return

    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/api/documents/${documentId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load document (${res.status})`)
        const data = await res.json()
        if (!cancelled) {
          setDocument(data.data)
          setIsEditing(false)
          setEditedHtml(null)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [documentId, open])

  // Fetch version history when document loaded
  useEffect(() => {
    if (!document || !open) return

    fetch(
      `/api/documents/versions?block_id=${blockId}&title=${encodeURIComponent(document.title)}`
    )
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json()
          setVersions(data.data ?? [])
        }
      })
      .catch(() => {
        // Non-blocking — version history is nice-to-have
      })
  }, [document, blockId, open])

  const handleVersionChange = useCallback((newDocId: string) => {
    setDocumentId(newDocId)
  }, [])

  const handleEditToggle = useCallback(() => {
    if (isEditing) {
      setIsEditing(false)
      setEditedHtml(null)
    } else {
      setIsEditing(true)
      setEditedHtml(document?.html_content ?? null)
    }
  }, [isEditing, document])

  const handleSaveEdit = useCallback(async () => {
    if (!editedHtml || !document) return

    setIsSaving(true)
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          block_id: blockId,
          title: document.title,
          format: 'html',
          html_content: editedHtml,
          ai_generated: false,
          generation_metadata: {
            edited_from_version: document.version,
            edited_from_id: document.id,
          },
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error?.message ?? 'Save failed')
      }

      const data = await res.json()
      // Navigate to the new version
      setDocumentId(data.data.id)
      setIsEditing(false)
      setEditedHtml(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }, [editedHtml, document, blockId])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-background border-l border-border shadow-xl w-full max-w-3xl flex flex-col animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Document preview"
      >
        {/* Close button */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">
            Document Preview
          </h2>
          <div className="flex items-center gap-2">
            {versions.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowVersions(!showVersions)}
                className="text-xs h-7"
              >
                {showVersions ? 'Hide History' : `${versions.length} Versions`}
              </Button>
            )}
            <button
              onClick={onClose}
              className="rounded-md p-1 hover:bg-muted transition"
              aria-label="Close preview"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Toolbar */}
        {document && (
          <DocumentToolbar
            documentId={document.id}
            title={document.title}
            format={document.format}
            filePath={document.file_path}
            versions={versions}
            currentVersion={document.version}
            isEditing={isEditing}
            onEditToggle={handleEditToggle}
            onVersionChange={handleVersionChange}
            onSaveEdit={handleSaveEdit}
            isSaving={isSaving}
          />
        )}

        {/* Content area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Document view */}
          <div className="flex-1 overflow-auto p-4">
            {loading && (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <svg
                  className="animate-spin h-5 w-5 mr-2"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Loading document...
              </div>
            )}

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive" role="alert">
                {error}
              </div>
            )}

            {!loading && !error && !document && (
              <div className="text-center py-16 text-muted-foreground">
                <p className="text-lg font-medium mb-2">No document selected</p>
                <p className="text-sm">Select a document to preview.</p>
              </div>
            )}

            {!loading && document && document.html_content && (
              <InlineEditor
                htmlContent={isEditing ? (editedHtml ?? document.html_content) : document.html_content}
                onChange={setEditedHtml}
                readOnly={!isEditing}
              />
            )}

            {!loading && document && !document.html_content && (
              <div className="text-center py-16 text-muted-foreground">
                <p className="text-lg font-medium mb-2">PDF Document</p>
                <p className="text-sm mb-4">
                  This document is stored as a PDF file.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    fetch(`/api/documents/${document.id}?download=1`)
                      .then(async (res) => {
                        if (res.ok) {
                          const data = await res.json()
                          if (data.data?.download_url) {
                            window.open(data.data.download_url, '_blank')
                          }
                        }
                      })
                  }}
                >
                  Download PDF
                </Button>
              </div>
            )}
          </div>

          {/* Version history sidebar */}
          {showVersions && (
            <div className="w-56 shrink-0 border-l border-border p-3 overflow-y-auto">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Version History
              </h4>
              <VersionHistory
                versions={versions}
                currentVersionId={document?.id ?? ''}
                onSelect={handleVersionChange}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
