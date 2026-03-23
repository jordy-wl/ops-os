'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { AlertTriangle, Loader2, RefreshCw, Key } from 'lucide-react'
import type { PortalConfig } from '../portal-detail-view'

interface SettingsTabProps {
  config: PortalConfig
  onUpdate: (updates: Partial<PortalConfig>) => void
}

export function SettingsTab({ config, onUpdate }: SettingsTabProps) {
  const router = useRouter()
  const [name, setName] = useState(config.name)
  const [regenerating, setRegenerating] = useState(false)
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleNameSave = useCallback(() => {
    if (name.trim() && name.trim() !== config.name) {
      onUpdate({ name: name.trim() })
    }
  }, [name, config.name, onUpdate])

  const handleRegenerateToken = useCallback(async () => {
    setRegenerating(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/portal-configs/${config.id}/regenerate-token`,
        { method: 'POST' }
      )
      if (!res.ok) throw new Error('Failed to regenerate token')
      const data = await res.json()
      const result = data.data ?? data
      onUpdate({ portal_token: result.portal_token })
    } catch {
      setError('Failed to regenerate token')
    } finally {
      setRegenerating(false)
    }
  }, [config.id, onUpdate])

  const handleDeactivate = useCallback(async () => {
    setDeactivating(true)
    try {
      const res = await fetch(`/api/portal-configs/${config.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to deactivate')
      onUpdate({ is_active: false })
      setShowDeactivateDialog(false)
    } catch {
      // Keep dialog open
    } finally {
      setDeactivating(false)
    }
  }, [config.id, onUpdate])

  const handleActivate = useCallback(async () => {
    try {
      await fetch(`/api/portal-configs/${config.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true }),
      })
      onUpdate({ is_active: true })
    } catch {
      setError('Failed to activate')
    }
  }, [config.id, onUpdate])

  return (
    <div className="space-y-6">
      {/* Name */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">
          Portal Name
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          The internal name for this portal configuration.
        </p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleNameSave}
          className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Token management */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">
          Portal Token
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          The unique token used in the portal URL. Regenerating will
          invalidate the current URL.
        </p>
        {config.portal_token && (
          <div className="mb-3">
            <code className="text-xs bg-muted rounded px-2 py-1.5 text-foreground font-mono">
              {config.portal_token.slice(0, 16)}...
            </code>
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRegenerateToken}
          disabled={regenerating}
        >
          {regenerating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          )}
          Regenerate Token
        </Button>
      </div>

      {/* Activate / Deactivate */}
      <div className="border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-foreground mb-1">
          Portal Status
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          {config.is_active
            ? 'The portal is currently active and accessible to clients.'
            : 'The portal is inactive. Activate it to make it accessible.'}
        </p>

        {config.is_active ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeactivateDialog(true)}
          >
            Deactivate Portal
          </Button>
        ) : (
          <Button size="sm" onClick={handleActivate}>
            Activate Portal
          </Button>
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* Deactivate confirmation */}
      <Dialog
        open={showDeactivateDialog}
        onOpenChange={setShowDeactivateDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Deactivate Portal
            </DialogTitle>
            <DialogDescription>
              This will disable the client portal. The portal URL will stop
              working immediately. You can re-enable it later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeactivateDialog(false)}
              disabled={deactivating}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivate}
              disabled={deactivating}
            >
              {deactivating && (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              )}
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
