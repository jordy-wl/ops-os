'use client'

import { useState, useEffect } from 'react'
import { FileText, MessageSquare, Activity, Clock } from 'lucide-react'

interface OverviewTabProps {
  configId: string
  portalUrl: string | null
  isActive: boolean
}

interface PortalStats {
  submissions: number
  events: number
  last_activity: string | null
}

export function OverviewTab({ configId, portalUrl, isActive }: OverviewTabProps) {
  const [stats, setStats] = useState<PortalStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/portal-configs/${configId}/stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setStats(data.data ?? data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [configId])

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-muted rounded-lg" />
        ))}
      </div>
    )
  }

  const statCards = [
    {
      label: 'Form Submissions',
      value: stats?.submissions ?? 0,
      icon: FileText,
      color: 'text-blue-500 bg-blue-500/10',
    },
    {
      label: 'Portal Events',
      value: stats?.events ?? 0,
      icon: Activity,
      color: 'text-green-500 bg-green-500/10',
    },
    {
      label: 'Last Activity',
      value: stats?.last_activity
        ? new Date(stats.last_activity).toLocaleDateString()
        : 'None',
      icon: Clock,
      color: 'text-orange-500 bg-orange-500/10',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Status banner */}
      {!isActive && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800 px-4 py-3">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            This portal is currently inactive. Activate it in Settings to make
            it accessible to clients.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.label}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {card.label}
                  </p>
                  <p className="text-lg font-semibold text-foreground">
                    {card.value}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Portal URL */}
      {portalUrl && isActive && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Portal URL
          </p>
          <code className="block text-xs bg-muted rounded px-3 py-2 text-foreground break-all">
            {portalUrl}
          </code>
        </div>
      )}
    </div>
  )
}
