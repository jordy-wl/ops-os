'use client'

import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle, Plug } from 'lucide-react'

interface Connector {
  id: string
  name: string
  provider: string
  status: string
  health_status: string | null
  last_health_check: string | null
  capabilities: Record<string, boolean> | null
  last_sync_at: string | null
  created_at: string
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const HEALTH_ICONS: Record<string, React.ElementType> = {
  healthy: CheckCircle2,
  degraded: AlertTriangle,
  unhealthy: XCircle,
}

const HEALTH_COLORS: Record<string, string> = {
  healthy: 'text-green-500',
  degraded: 'text-amber-500',
  unhealthy: 'text-red-500',
}

const HEALTH_BG: Record<string, string> = {
  healthy: 'bg-green-500/10',
  degraded: 'bg-amber-500/10',
  unhealthy: 'bg-red-500/10',
}

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google Workspace',
  webhook: 'Webhook',
  custom_api: 'Custom API',
}

export function IntegrationHealthDashboard() {
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState<string | null>(null)

  const fetchConnectors = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations')
      if (res.ok) {
        const { data } = await res.json()
        setConnectors(data ?? [])
      }
    } catch {
      // Best-effort
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConnectors()
  }, [fetchConnectors])

  const checkHealth = async (connectorId: string) => {
    setChecking(connectorId)
    try {
      const res = await fetch(`/api/integrations/${connectorId}/health`)
      if (res.ok) {
        await fetchConnectors()
      }
    } catch {
      // Best-effort
    } finally {
      setChecking(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-[13px] text-muted-foreground">
        Loading integrations...
      </div>
    )
  }

  if (connectors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Plug className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-[13px] text-muted-foreground">
          No integrations configured. Visit the Integration Library to connect services.
        </p>
      </div>
    )
  }

  const activeConnectors = connectors.filter((c) => c.status === 'active')
  const inactiveConnectors = connectors.filter((c) => c.status !== 'active')
  const healthyCount = activeConnectors.filter((c) => c.health_status === 'healthy').length
  const degradedCount = activeConnectors.filter((c) => c.health_status === 'degraded').length
  const unhealthyCount = activeConnectors.filter((c) => c.health_status === 'unhealthy' || (!c.health_status && c.status === 'active')).length

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <p className="text-lg font-semibold text-green-500">{healthyCount}</p>
          <p className="text-[11px] text-muted-foreground">Healthy</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <p className="text-lg font-semibold text-amber-500">{degradedCount}</p>
          <p className="text-[11px] text-muted-foreground">Degraded</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <p className="text-lg font-semibold text-red-500">{unhealthyCount}</p>
          <p className="text-[11px] text-muted-foreground">Unhealthy</p>
        </div>
      </div>

      {/* Active connectors */}
      <div>
        <h3 className="text-[13px] font-semibold text-foreground mb-3">
          Active Integrations ({activeConnectors.length})
        </h3>
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          {activeConnectors.map((connector) => {
            const health = connector.health_status ?? 'unhealthy'
            const HealthIcon = HEALTH_ICONS[health] ?? XCircle
            const healthColor = HEALTH_COLORS[health] ?? 'text-muted-foreground'
            const healthBg = HEALTH_BG[health] ?? ''

            return (
              <div key={connector.id} className="flex items-center gap-3 px-4 py-3">
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center', healthBg)}>
                  <HealthIcon className={cn('h-4 w-4', healthColor)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground truncate">{connector.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {PROVIDER_LABELS[connector.provider] ?? connector.provider} · Last check: {formatRelativeTime(connector.last_health_check)}
                  </p>
                </div>
                {connector.capabilities && (
                  <div className="hidden sm:flex items-center gap-1">
                    {Object.entries(connector.capabilities)
                      .filter(([, enabled]) => enabled)
                      .slice(0, 3)
                      .map(([cap]) => (
                        <span
                          key={cap}
                          className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground capitalize"
                        >
                          {cap.replace(/_/g, ' ')}
                        </span>
                      ))}
                  </div>
                )}
                <button
                  onClick={() => checkHealth(connector.id)}
                  disabled={checking === connector.id}
                  className="p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  aria-label={`Check health for ${connector.name}`}
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', checking === connector.id && 'animate-spin')} />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Inactive connectors */}
      {inactiveConnectors.length > 0 && (
        <div>
          <h3 className="text-[13px] font-semibold text-muted-foreground mb-3">
            Inactive ({inactiveConnectors.length})
          </h3>
          <div className="divide-y divide-border rounded-lg border border-border/50 bg-card/50">
            {inactiveConnectors.map((connector) => (
              <div key={connector.id} className="flex items-center gap-3 px-4 py-3 opacity-60">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <Plug className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground truncate">{connector.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {PROVIDER_LABELS[connector.provider] ?? connector.provider} · {connector.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
