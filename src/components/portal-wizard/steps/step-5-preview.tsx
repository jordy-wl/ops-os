'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Globe,
  Search,
  Check,
  Loader2,
  LayoutDashboard,
  FileText,
  MessageSquare,
  ClipboardList,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ExposedBlockTypeConfig } from '@/lib/portal-constants'
import type { ClientOption, RequestTypeConfigItem } from '../wizard-types'

interface Step5PreviewProps {
  name: string
  displayName: string
  logoUrl: string
  primaryColor: string
  dashboardEnabled: boolean
  documentsEnabled: boolean
  requestsEnabled: boolean
  formsEnabled: boolean
  exposedBlockTypeConfig: ExposedBlockTypeConfig
  selectedFormCount: number
  selectedDocumentCount: number
  requestTypeConfig: RequestTypeConfigItem[]
  clients: ClientOption[]
  selectedClientId: string | null
  onClientSelect: (id: string | null) => void
  creating: boolean
  error: string | null
  onSubmit: (asTemplate: boolean) => void
}

const FEATURE_TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'requests', label: 'Requests', icon: MessageSquare },
  { key: 'forms', label: 'Forms', icon: ClipboardList },
] as const

export function Step5Preview({
  name,
  displayName,
  logoUrl,
  primaryColor,
  dashboardEnabled,
  documentsEnabled,
  requestsEnabled,
  formsEnabled,
  exposedBlockTypeConfig,
  selectedFormCount,
  selectedDocumentCount,
  requestTypeConfig,
  clients,
  selectedClientId,
  onClientSelect,
  creating,
  error,
  onSubmit,
}: Step5PreviewProps) {
  const router = useRouter()
  const [clientSearch, setClientSearch] = useState('')

  const featureFlags: Record<string, boolean> = {
    dashboard: dashboardEnabled,
    documents: documentsEnabled,
    requests: requestsEnabled,
    forms: formsEnabled,
  }

  const enabledTypes = useMemo(
    () =>
      Object.entries(exposedBlockTypeConfig)
        .filter(([, v]) => v.enabled)
        .map(([k]) => k),
    [exposedBlockTypeConfig]
  )

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients
    const q = clientSearch.toLowerCase()
    return clients.filter((c) => c.name.toLowerCase().includes(q))
  }, [clients, clientSearch])

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left: Portal Preview */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Portal Preview</h3>
        <div className="rounded-lg border border-border overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 flex items-center gap-3" style={{ backgroundColor: primaryColor }}>
            {logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={logoUrl}
                alt="Logo"
                className="h-6 w-auto"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            ) : (
              <Globe className="w-5 h-5 text-white" />
            )}
            <span className="text-sm font-semibold text-white">
              {displayName || name || 'Portal'}
            </span>
          </div>

          {/* Feature tabs */}
          <div className="border-b border-border bg-background">
            <div className="flex">
              {FEATURE_TABS.map(({ key, label, icon: Icon }) => {
                const enabled = featureFlags[key]
                return (
                  <div
                    key={key}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs border-b-2 ${
                      enabled
                        ? 'border-primary/50 text-foreground'
                        : 'border-transparent text-muted-foreground/40'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {label}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Content summary */}
          <div className="p-4 bg-gray-50 dark:bg-muted/20 space-y-3">
            {enabledTypes.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Visible Data</p>
                <div className="flex flex-wrap gap-1.5">
                  {enabledTypes.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center rounded-full bg-background border border-border px-2 py-0.5 text-[11px] text-foreground capitalize"
                    >
                      {t.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {selectedFormCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {selectedFormCount} form{selectedFormCount !== 1 ? 's' : ''} included
              </p>
            )}
            {selectedDocumentCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {selectedDocumentCount} document{selectedDocumentCount !== 1 ? 's' : ''} included
              </p>
            )}
            {requestTypeConfig.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {requestTypeConfig.length} request type{requestTypeConfig.length !== 1 ? 's' : ''} configured
              </p>
            )}
            {enabledTypes.length === 0 &&
              selectedFormCount === 0 &&
              selectedDocumentCount === 0 &&
              requestTypeConfig.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No content configured yet. Go back to add data, forms, or request types.
                </p>
              )}
          </div>
        </div>
      </div>

      {/* Right: Client Assignment + Actions */}
      <div className="space-y-5">
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Assign Client</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Assign to a client to create a live portal URL, or skip to save as a reusable template.
          </p>

          {clients.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <p className="text-sm text-muted-foreground">No client blocks found.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create a client block first, or save this as a template.
              </p>
            </div>
          ) : (
            <>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Search clients..."
                  className="w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="max-h-48 overflow-y-auto rounded-md border border-border divide-y divide-border">
                {filteredClients.map((client) => {
                  const selected = selectedClientId === client.id
                  return (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => onClientSelect(selected ? null : client.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-muted/50 transition-colors ${
                        selected ? 'bg-primary/5' : ''
                      }`}
                    >
                      <span className="text-sm text-foreground truncate">{client.name}</span>
                      {selected && <Check className="w-4 h-4 text-primary shrink-0" />}
                    </button>
                  )
                })}
                {filteredClients.length === 0 && (
                  <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                    No clients match &ldquo;{clientSearch}&rdquo;
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-border pt-5">
          <Button variant="outline" onClick={() => router.push('/library/portals')} disabled={creating}>
            Cancel
          </Button>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => onSubmit(true)}
              disabled={creating || !name.trim()}
            >
              {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save as Template
            </Button>
            <Button
              onClick={() => onSubmit(false)}
              disabled={creating || !name.trim() || !selectedClientId}
            >
              {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Create Portal
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
