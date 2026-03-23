'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Globe,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  Loader2,
} from 'lucide-react'

// --- Types ---

interface PortalConfigResponse {
  id: string
  org_id: string
  client_block_id: string
  name: string
  dashboard_enabled: boolean
  documents_enabled: boolean
  requests_enabled: boolean
  forms_enabled: boolean
  exposed_block_types: string[]
  exposed_block_ids: string[] | null
  branding_overrides: Record<string, unknown> | null
  is_active: boolean
  portal_token: string | null
}

interface PortalConfigPanelProps {
  blockId: string
  blockName: string
}

import { COMMON_BLOCK_TYPES } from '@/lib/portal-constants'

// --- Main component ---

export function PortalConfigPanel({ blockId, blockName }: PortalConfigPanelProps) {
  const [config, setConfig] = useState<PortalConfigResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false)
  const [deactivating, setDeactivating] = useState(false)

  // Debounce ref for auto-save
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch portal config for this client block
  useEffect(() => {
    let cancelled = false

    async function fetchConfig() {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/portal-configs?client_id=${blockId}`)
        if (!res.ok) throw new Error('Failed to fetch')

        const data = await res.json()
        const configs = Array.isArray(data) ? data : data.data ?? []

        if (!cancelled) {
          // Take the first active config or the first config overall
          const active = configs.find((c: PortalConfigResponse) => c.is_active) ?? configs[0] ?? null
          setConfig(active)
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setError('Could not load portal configuration.')
          setLoading(false)
        }
      }
    }

    fetchConfig()

    return () => {
      cancelled = true
    }
  }, [blockId])

  // Enable portal
  const handleEnable = useCallback(async () => {
    setCreating(true)
    setError(null)

    try {
      const res = await fetch('/api/portal-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_block_id: blockId,
          name: `${blockName} Portal`,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message ?? 'Failed to enable portal')
      }

      const data = await res.json()
      setConfig(data.data ?? data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setCreating(false)
    }
  }, [blockId, blockName])

  // Auto-save toggle changes with debounce
  const saveConfig = useCallback(
    async (updates: Partial<PortalConfigResponse>) => {
      if (!config) return

      // Clear any pending save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/portal-configs/${config.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          })

          if (!res.ok) {
            throw new Error('Save failed')
          }
        } catch {
          // Silent fail on auto-save — could add toast notification here
        }
      }, 500)
    },
    [config]
  )

  // Toggle a feature flag
  const handleToggle = useCallback(
    (key: 'dashboard_enabled' | 'documents_enabled' | 'requests_enabled' | 'forms_enabled', value: boolean) => {
      if (!config) return

      const updated = { ...config, [key]: value }
      setConfig(updated)
      saveConfig({ [key]: value })
    },
    [config, saveConfig]
  )

  // Toggle a block type in the exposed list
  const handleBlockTypeToggle = useCallback(
    (typeValue: string, checked: boolean) => {
      if (!config) return

      const current = config.exposed_block_types ?? []
      const updated = checked
        ? [...current, typeValue]
        : current.filter((t) => t !== typeValue)

      const newConfig = { ...config, exposed_block_types: updated }
      setConfig(newConfig)
      saveConfig({ exposed_block_types: updated })
    },
    [config, saveConfig]
  )

  // Copy portal URL
  const handleCopyUrl = useCallback(() => {
    if (!config?.portal_token) return

    const url = `${window.location.origin}/portal/${config.portal_token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [config?.portal_token])

  // Deactivate
  const handleDeactivate = useCallback(async () => {
    if (!config) return

    setDeactivating(true)

    try {
      const res = await fetch(`/api/portal-configs/${config.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('Failed to deactivate')
      }

      setConfig({ ...config, is_active: false })
      setShowDeactivateDialog(false)
    } catch {
      // Keep dialog open on failure
    } finally {
      setDeactivating(false)
    }
  }, [config])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // --- Render states ---

  if (loading) {
    return (
      <div className="rounded-md border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Client Portal</h3>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="h-8 w-full bg-muted rounded" />
        </div>
      </div>
    )
  }

  if (error && !config) {
    return (
      <div className="rounded-md border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Client Portal</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    )
  }

  // No config — show enable CTA
  if (!config) {
    return (
      <div className="rounded-md border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Client Portal</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Give this client a self-service portal to view their data, documents, and submit requests.
        </p>
        {error && (
          <p className="text-xs text-destructive mb-2">{error}</p>
        )}
        <Button
          onClick={handleEnable}
          disabled={creating}
          size="sm"
        >
          {creating && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
          Enable Client Portal
        </Button>
      </div>
    )
  }

  // Config exists — show management UI
  const portalUrl = config.portal_token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/portal/${config.portal_token}`
    : null

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Client Portal</h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={config.is_active ? 'default' : 'secondary'}
            className="text-[10px]"
          >
            {config.is_active ? 'Active' : 'Inactive'}
          </Badge>
          <a
            href={`/library/portals/${config.id}`}
            className="text-[11px] text-primary hover:underline"
          >
            Manage →
          </a>
        </div>
      </div>

      {/* Portal URL */}
      {portalUrl && config.is_active && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-1.5">Portal URL</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] bg-muted rounded px-2 py-1.5 truncate text-foreground">
              {portalUrl}
            </code>
            <Button
              variant="outline"
              size="icon-xs"
              onClick={handleCopyUrl}
              aria-label={copied ? 'Copied' : 'Copy portal URL'}
            >
              {copied ? (
                <Check className="w-3 h-3 text-green-600" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </Button>
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open portal in new tab"
            >
              <Button variant="outline" size="icon-xs" asChild>
                <span>
                  <ExternalLink className="w-3 h-3" />
                </span>
              </Button>
            </a>
          </div>
        </div>
      )}

      {/* Feature toggles */}
      {config.is_active && (
        <>
          <div className="space-y-3 mb-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Features
            </p>
            <ToggleRow
              label="Dashboard"
              description="Block overview and activity"
              checked={config.dashboard_enabled}
              onChange={(val) => handleToggle('dashboard_enabled', val)}
            />
            <ToggleRow
              label="Documents"
              description="Document viewing and downloads"
              checked={config.documents_enabled}
              onChange={(val) => handleToggle('documents_enabled', val)}
            />
            <ToggleRow
              label="Requests"
              description="Submit support requests"
              checked={config.requests_enabled}
              onChange={(val) => handleToggle('requests_enabled', val)}
            />
            <ToggleRow
              label="Forms"
              description="Fill out and submit forms"
              checked={config.forms_enabled}
              onChange={(val) => handleToggle('forms_enabled', val)}
            />
          </div>

          {/* Exposed block types */}
          <div className="mb-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Exposed Block Types
            </p>
            <div className="space-y-1.5">
              {COMMON_BLOCK_TYPES.map((bt) => (
                <label
                  key={bt.value}
                  className="flex items-center gap-2 text-xs text-foreground cursor-pointer py-0.5"
                >
                  <input
                    type="checkbox"
                    checked={(config.exposed_block_types ?? []).includes(bt.value)}
                    onChange={(e) => handleBlockTypeToggle(bt.value, e.target.checked)}
                    className="rounded border-input w-3.5 h-3.5"
                  />
                  {bt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Deactivate */}
          <div className="border-t border-border pt-3">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeactivateDialog(true)}
            >
              Deactivate Portal
            </Button>
          </div>
        </>
      )}

      {/* Deactivate confirmation dialog */}
      <Dialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Deactivate Portal
            </DialogTitle>
            <DialogDescription>
              This will disable the client portal for {blockName}. The portal URL will
              stop working immediately. You can re-enable it later.
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
              {deactivating && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// --- Toggle Row subcomponent ---

interface ToggleRowProps {
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground truncate">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`Toggle ${label}`}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full
          border-2 border-transparent shadow-sm transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background
          ${checked ? 'bg-primary' : 'bg-input'}
        `}
      >
        <span
          className={`
            pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform
            ${checked ? 'translate-x-4' : 'translate-x-0'}
          `}
        />
      </button>
    </div>
  )
}
