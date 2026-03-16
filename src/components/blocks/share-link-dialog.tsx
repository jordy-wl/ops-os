'use client'

import { useState, useCallback } from 'react'
import { Share2, Copy, Check, Link2, X } from 'lucide-react'

interface ShareLinkDialogProps {
  blockId: string
  blockName: string
}

type ShareType = 'view' | 'submit' | 'sign'

export function ShareLinkButton({ blockId, blockName }: ShareLinkDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
      >
        <Share2 className="w-3.5 h-3.5" />
        Share
      </button>
      {open && (
        <ShareLinkModal
          blockId={blockId}
          blockName={blockName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function ShareLinkModal({
  blockId,
  blockName,
  onClose,
}: {
  blockId: string
  blockName: string
  onClose: () => void
}) {
  const [shareType, setShareType] = useState<ShareType>('view')
  const [expiresInHours, setExpiresInHours] = useState(72)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = useCallback(async () => {
    setCreating(true)
    setError(null)

    try {
      const res = await fetch('/api/shared-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          block_id: blockId,
          share_type: shareType,
          expires_in_hours: expiresInHours,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message ?? 'Failed to create link')
      }

      const body = await res.json()
      const token = body.data.token
      const url = `${window.location.origin}/public/${token}`
      setGeneratedUrl(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setCreating(false)
    }
  }, [blockId, shareType, expiresInHours])

  const handleCopy = useCallback(() => {
    if (!generatedUrl) return
    navigator.clipboard.writeText(generatedUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [generatedUrl])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-card border border-border rounded-xl shadow-lg p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            Share Link
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Create a shareable link for <span className="font-medium text-foreground">{blockName}</span>
        </p>

        {!generatedUrl ? (
          <div className="space-y-4">
            {/* Share type */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                Link Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['view', 'submit', 'sign'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setShareType(type)}
                    className={`rounded-md border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                      shareType === type
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-input bg-background text-foreground hover:bg-muted'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                {shareType === 'view' && 'Recipient can view block details (read-only).'}
                {shareType === 'submit' && 'Recipient can fill out and submit a form.'}
                {shareType === 'sign' && 'Recipient can view and sign a document.'}
              </p>
            </div>

            {/* Expiry */}
            <div>
              <label htmlFor="expires" className="block text-sm font-medium text-muted-foreground mb-1.5">
                Expires In
              </label>
              <select
                id="expires"
                value={expiresInHours}
                onChange={(e) => setExpiresInHours(Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value={24}>24 hours</option>
                <option value={72}>3 days</option>
                <option value={168}>1 week</option>
                <option value={720}>30 days</option>
                <option value={2160}>90 days</option>
              </select>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Link'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                Shareable URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedUrl}
                  className="flex-1 rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-foreground"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="shrink-0 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted transition-colors"
                  aria-label="Copy link"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              This link will expire in {expiresInHours >= 24 ? `${Math.floor(expiresInHours / 24)} day${Math.floor(expiresInHours / 24) !== 1 ? 's' : ''}` : `${expiresInHours} hours`}.
              Anyone with this link can {shareType === 'view' ? 'view' : shareType === 'submit' ? 'submit a form' : 'sign'} without signing in.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setGeneratedUrl(null)
                  setError(null)
                }}
                className="flex-1 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Create Another
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
