'use client'

import { useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface SaveCustomActionDialogProps {
  open: boolean
  onClose: () => void
  /** Pre-filled from the current call_api node config */
  nodeConfig: {
    connector_id?: string
    method?: string
    path?: string
    body_template?: string
    timeout_ms?: number
    max_retries?: number
  }
  onSaved?: () => void
}

export function SaveCustomActionDialog({
  open,
  onClose,
  nodeConfig,
  onSaved,
}: SaveCustomActionDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    if (!nodeConfig.connector_id || !nodeConfig.method || !nodeConfig.path) {
      setError('Node must have connector, method, and path configured')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/custom-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          connector_id: nodeConfig.connector_id,
          method: nodeConfig.method,
          path: nodeConfig.path,
          body_template: nodeConfig.body_template,
          timeout_ms: nodeConfig.timeout_ms,
          max_retries: nodeConfig.max_retries,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error?.message ?? 'Failed to save')
      }

      setSuccess(true)
      onSaved?.()
      setTimeout(() => {
        setName('')
        setDescription('')
        setSuccess(false)
        onClose()
      }, 800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save custom action')
    } finally {
      setSaving(false)
    }
  }, [name, description, nodeConfig, onClose, onSaved])

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save as Custom Action</DialogTitle>
          <DialogDescription>
            Save this API configuration for reuse in other workflows.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label htmlFor="ca-name" className="block text-sm font-medium text-foreground mb-1">
              Action Name
            </label>
            <Input
              id="ca-name"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null) }}
              placeholder="e.g., Sync to Xero"
              className="text-sm"
            />
          </div>

          <div>
            <label htmlFor="ca-desc" className="block text-sm font-medium text-foreground mb-1">
              Description
            </label>
            <Input
              id="ca-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this action do?"
              className="text-sm"
            />
          </div>

          <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground space-y-1">
            <p><span className="font-medium">Method:</span> {nodeConfig.method ?? 'Not set'}</p>
            <p><span className="font-medium">Path:</span> {nodeConfig.path ?? 'Not set'}</p>
            {nodeConfig.timeout_ms && (
              <p><span className="font-medium">Timeout:</span> {nodeConfig.timeout_ms}ms</p>
            )}
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-md bg-success/10 border border-success/20 px-3 py-2 text-sm text-success">
              Custom action saved!
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Saving...' : 'Save Action'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
