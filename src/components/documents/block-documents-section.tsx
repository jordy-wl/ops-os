'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { DocumentPreview } from './document-preview'
import { FileSignature } from 'lucide-react'

interface DocumentListItem {
  id: string
  title: string
  version: number
  format: string
  ai_generated: boolean
  created_at: string
}

interface BlockDocumentsSectionProps {
  blockId: string
}

export function BlockDocumentsSection({ blockId }: BlockDocumentsSectionProps) {
  const [documents, setDocuments] = useState<DocumentListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [previewDocId, setPreviewDocId] = useState<string | null>(null)
  const [signingDocId, setSigningDocId] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareLoading, setShareLoading] = useState(false)

  const handleShareForSignature = useCallback(async (docId: string) => {
    setShareLoading(true)
    setSigningDocId(docId)
    setShareUrl(null)
    try {
      const res = await fetch('/api/shared-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          block_id: blockId,
          share_type: 'sign',
          expires_in_hours: 168, // 7 days
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const token = data.data?.token
        if (token) {
          setShareUrl(`${window.location.origin}/public/${token}`)
        }
      }
    } catch {
      // silently fail
    } finally {
      setShareLoading(false)
    }
  }, [blockId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    fetch(`/api/documents?block_id=${blockId}&limit=20`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) setDocuments(data.data ?? [])
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [blockId])

  if (loading) {
    return (
      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Documents</h3>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 rounded bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (documents.length === 0) return null

  // Group by title, show latest version of each
  const latestByTitle = new Map<string, DocumentListItem>()
  for (const doc of documents) {
    const existing = latestByTitle.get(doc.title)
    if (!existing || doc.version > existing.version) {
      latestByTitle.set(doc.title, doc)
    }
  }
  const uniqueDocs = [...latestByTitle.values()]

  return (
    <>
      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Documents
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            ({documents.length})
          </span>
        </h3>
        <div className="space-y-2">
          {uniqueDocs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-1">
              <button
                onClick={() => setPreviewDocId(doc.id)}
                aria-label={`Preview document: ${doc.title}`}
                className="flex-1 text-left flex items-center justify-between gap-2 px-3 py-2 rounded-md hover:bg-muted transition text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-muted-foreground shrink-0" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </span>
                  <span className="truncate text-foreground">{doc.title}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                  <span>v{doc.version}</span>
                  {doc.ai_generated && <span className="text-primary">(AI)</span>}
                  <span>{doc.format.toUpperCase()}</span>
                </div>
              </button>
              <button
                onClick={() => handleShareForSignature(doc.id)}
                disabled={shareLoading}
                aria-label={`Share for signature: ${doc.title}`}
                className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="Share for signature"
              >
                <FileSignature className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {/* Share for signature URL display */}
          {signingDocId && shareUrl && (
            <div className="mt-2 rounded-md bg-primary/5 border border-primary/20 p-3">
              <p className="text-xs font-medium text-foreground mb-1">Signature link created</p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 text-xs bg-background border border-border rounded px-2 py-1"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl)
                  }}
                  className="text-xs text-primary hover:underline shrink-0"
                >
                  Copy
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Expires in 7 days. Client signs without an account.</p>
            </div>
          )}
        </div>
        <div className="mt-3 pt-3 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs w-full"
            onClick={() => {
              if (uniqueDocs[0]) setPreviewDocId(uniqueDocs[0].id)
            }}
          >
            View All Documents
          </Button>
        </div>
      </div>

      <DocumentPreview
        documentId={previewDocId}
        blockId={blockId}
        open={!!previewDocId}
        onClose={() => setPreviewDocId(null)}
      />
    </>
  )
}
