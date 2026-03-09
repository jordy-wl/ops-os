'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { CreateIntegrationModal } from './create-integration-modal'

export interface Connector {
  id: string
  name: string
  provider: string
  direction: string
  status: string
  config: Record<string, unknown> | null
  last_sync_at: string | null
  created_at: string
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-50 text-green-700',
  paused: 'bg-yellow-50 text-yellow-700',
  error: 'bg-red-50 text-red-700',
}

const PROVIDER_LABELS: Record<string, string> = {
  webhook: 'Webhook',
  custom_api: 'Custom API',
  salesforce: 'Salesforce',
  xero: 'Xero',
}

const FILTERS = ['all', 'webhook', 'custom_api', 'salesforce', 'xero'] as const

interface Props {
  initialConnectors: Connector[] | null
}

export function IntegrationListClient({ initialConnectors }: Props) {
  const [connectors, setConnectors] = useState<Connector[] | null>(initialConnectors)
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [showCreate, setShowCreate] = useState(false)

  const handleCreated = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations')
      const json = await res.json()
      if (res.ok && json.data) {
        setConnectors(json.data)
      }
    } catch {
      // Silently fail — user can refresh
    }
  }, [])

  if (connectors === null) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center" role="alert">
        <p className="text-lg font-semibold text-gray-900 mb-2">Failed to load integrations</p>
        <p className="text-sm text-gray-500">Please refresh the page or try again later.</p>
      </div>
    )
  }

  const filtered = activeFilter === 'all'
    ? connectors
    : connectors.filter((c) => c.provider === activeFilter)

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by provider">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              aria-pressed={activeFilter === f}
              className={cn(
                'h-9 px-3 rounded-md text-sm font-medium capitalize transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900',
                activeFilter === f
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              )}
            >
              {f === 'all' ? 'All' : (PROVIDER_LABELS[f] ?? f)}
            </button>
          ))}
        </div>

        {/* Create button */}
        <button
          onClick={() => setShowCreate(true)}
          className={cn(
            'ml-auto h-9 px-4 rounded-md text-sm font-medium bg-gray-900 text-white',
            'hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900'
          )}
        >
          Add Connector
        </button>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg font-semibold text-gray-900 mb-2">
            {activeFilter === 'all' ? 'No connectors yet' : `No ${PROVIDER_LABELS[activeFilter] ?? activeFilter} connectors`}
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Connect external systems to trigger workflows or push data.
          </p>
          {activeFilter === 'all' && (
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
            >
              Create First Connector
            </button>
          )}
        </div>
      )}

      {/* Connector grid */}
      {filtered.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {filtered.map((c) => (
            <li key={c.id}>
              <div className="rounded-lg border border-gray-200 p-4 hover:border-gray-400 hover:shadow-sm transition-all">
                {/* Header row */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn(
                    'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                    STATUS_STYLES[c.status] ?? 'bg-gray-100 text-gray-600'
                  )}>
                    {c.status}
                  </span>
                  <span className="text-xs text-gray-400 capitalize">
                    {PROVIDER_LABELS[c.provider] ?? c.provider}
                  </span>
                </div>

                {/* Name */}
                <p className="font-medium text-gray-900 truncate mb-1">{c.name}</p>

                {/* Direction + webhook URL */}
                <p className="text-xs text-gray-500 mb-2 capitalize">{c.direction}</p>

                {(c.direction === 'inbound' || c.direction === 'bidirectional') && (
                  <WebhookUrl connectorId={c.id} />
                )}

                {/* Last sync */}
                <p className="text-xs text-gray-400 mt-2">
                  {c.last_sync_at
                    ? `Last sync: ${new Date(c.last_sync_at).toLocaleString()}`
                    : 'No activity yet'}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateIntegrationModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  )
}

function WebhookUrl({ connectorId }: { connectorId: string }) {
  const [copied, setCopied] = useState(false)
  const url = `/api/webhooks/integration/${connectorId}`

  function handleCopy() {
    const fullUrl = `${window.location.origin}${url}`
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="flex items-center gap-1">
      <code className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded truncate flex-1">
        {url}
      </code>
      <button
        onClick={handleCopy}
        className="shrink-0 text-xs text-gray-500 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
        aria-label="Copy webhook URL"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}
