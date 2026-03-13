'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { GoogleConnect } from '@/components/integrations/google-connect'
import {
  Mail,
  CalendarPlus,
  FileText,
  Webhook,
  Globe,
  Plug,
  Search,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Connector {
  id: string
  name: string
  provider: string
  direction: string
  status: string
  config: Record<string, unknown> | null
  last_sync_at: string | null
  created_at: string
}

interface IntegrationCatalogProps {
  connectors: Connector[]
}

// ─── Capability Definitions ─────────────────────────────────────────────────

interface Capability {
  key: string
  label: string
  description: string
  icon: React.ReactNode
  actions: string[]
  provider: string
}

const CAPABILITIES: Capability[] = [
  {
    key: 'email',
    label: 'Email',
    description: 'Send and receive emails via Gmail',
    icon: <Mail className="h-5 w-5" aria-hidden="true" />,
    actions: ['Send Email', 'Receive Email (trigger)'],
    provider: 'google',
  },
  {
    key: 'calendar',
    label: 'Calendar',
    description: 'Book meetings with Google Meet links',
    icon: <CalendarPlus className="h-5 w-5" aria-hidden="true" />,
    actions: ['Book Meeting', 'Check Availability'],
    provider: 'google',
  },
  {
    key: 'documents',
    label: 'Documents',
    description: 'Store and create documents in Google Drive',
    icon: <FileText className="h-5 w-5" aria-hidden="true" />,
    actions: ['Upload File', 'Create Document', 'List Files'],
    provider: 'google',
  },
  {
    key: 'webhooks',
    label: 'Webhooks',
    description: 'Receive data from external systems',
    icon: <Webhook className="h-5 w-5" aria-hidden="true" />,
    actions: ['Inbound Webhook', 'Verify HMAC'],
    provider: 'webhook',
  },
  {
    key: 'api',
    label: 'Custom API',
    description: 'Call external REST APIs from workflows',
    icon: <Globe className="h-5 w-5" aria-hidden="true" />,
    actions: ['HTTP Request', 'OAuth Bearer Auth'],
    provider: 'custom_api',
  },
]

// ─── Component ──────────────────────────────────────────────────────────────

export function IntegrationCatalog({ connectors }: IntegrationCatalogProps) {
  const [search, setSearch] = useState('')

  const googleConnector = connectors.find((c) => c.provider === 'google')

  const filtered = CAPABILITIES.filter((cap) =>
    cap.label.toLowerCase().includes(search.toLowerCase()) ||
    cap.description.toLowerCase().includes(search.toLowerCase())
  )

  // Group by whether the provider is connected
  const connected = filtered.filter((cap) =>
    connectors.some((c) => c.provider === cap.provider && c.status === 'active')
  )
  const available = filtered.filter((cap) =>
    !connectors.some((c) => c.provider === cap.provider && c.status === 'active')
  )

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-page text-foreground">Integration Library</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Connect services and use their capabilities in workflows and actions.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search integrations"
            placeholder="Search integrations..."
            className="h-8 w-64 rounded-md border border-border pl-9 pr-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Google Workspace connection card */}
      <section className="mb-8">
        <h2 className="text-title text-muted-foreground mb-3">
          Google Workspace
        </h2>
        <GoogleConnect
          connectorId={googleConnector?.id ?? null}
          connectorStatus={(googleConnector?.status as 'active' | 'paused' | 'error') ?? null}
          connectedBy={googleConnector?.config?.connected_by as string ?? null}
          connectedAt={googleConnector?.created_at ?? null}
        />
      </section>

      {/* Connected capabilities */}
      {connected.length > 0 && (
        <section className="mb-8">
          <h2 className="text-title text-muted-foreground mb-3">
            Active Capabilities ({connected.length})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {connected.map((cap) => (
              <CapabilityCard key={cap.key} capability={cap} connected />
            ))}
          </div>
        </section>
      )}

      {/* Available capabilities */}
      {available.length > 0 && (
        <section className="mb-8">
          <h2 className="text-title text-muted-foreground mb-3">
            Available Capabilities ({available.length})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {available.map((cap) => (
              <CapabilityCard key={cap.key} capability={cap} connected={false} />
            ))}
          </div>
        </section>
      )}

      {/* Existing connectors */}
      {connectors.length > 0 && (
        <section>
          <h2 className="text-title text-muted-foreground mb-3">
            All Connectors ({connectors.length})
          </h2>
          <div className="rounded-lg border divide-y">
            {connectors.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <Plug className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.provider} &middot; {c.direction}</p>
                </div>
                <span className={cn(
                  'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                  c.status === 'active' ? 'bg-success/10 text-success' :
                  c.status === 'error' ? 'bg-destructive/10 text-destructive' :
                  'bg-warning/10 text-warning'
                )}>
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No integrations match your search.{' '}
            <button onClick={() => setSearch('')} className="underline">Clear search</button>
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Capability Card ────────────────────────────────────────────────────────

function CapabilityCard({ capability, connected }: { capability: Capability; connected: boolean }) {
  return (
    <div className={cn(
      'rounded-md border border-border p-4 bg-card hover:border-foreground/10 transition-colors duration-150',
      connected ? '' : ''
    )}>
      <div className="flex items-center gap-2.5 mb-2">
        <div className={cn(
          'flex h-8 w-8 items-center justify-center rounded-md',
          connected ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
        )}>
          {capability.icon}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{capability.label}</h3>
          {connected && (
            <span className="text-xs text-success">Connected</span>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{capability.description}</p>
      <div className="flex flex-wrap gap-1">
        {capability.actions.map((action) => (
          <span
            key={action}
            className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
          >
            {action}
          </span>
        ))}
      </div>
    </div>
  )
}
