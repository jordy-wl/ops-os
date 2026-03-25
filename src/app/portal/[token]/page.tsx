'use client'

import { useState, useEffect } from 'react'
import { usePortal } from '@/components/portal/portal-context'
import { Clock, AlertCircle, RefreshCw } from 'lucide-react'

interface PortalBlock {
  id: string
  name: string
  type: string
  status: string
  updated_at: string
  fields?: Record<string, unknown>
}

interface PortalEvent {
  id: string
  type: string
  description?: string
  payload?: Record<string, unknown>
  occurred_at: string
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  completed: 'bg-emerald-50 text-emerald-700',
  in_progress: 'bg-amber-50 text-amber-700',
  pending: 'bg-amber-50 text-amber-700',
  overdue: 'bg-red-50 text-red-700',
  archived: 'bg-slate-100 text-slate-600',
}

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] || 'bg-slate-100 text-slate-600'
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(dateStr)
}

function formatTypeName(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Format a field value for display, truncating long strings */
function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '-'
  if (typeof value === 'object') return JSON.stringify(value)
  const str = String(value)
  return str.length > 40 ? str.slice(0, 37) + '...' : str
}

/** Render first N visible fields as a compact key-value summary */
function FieldSummary({ fields, max = 3 }: { fields?: Record<string, unknown>; max?: number }) {
  if (!fields || Object.keys(fields).length === 0) return null

  const entries = Object.entries(fields)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .slice(0, max)

  if (entries.length === 0) return null

  return (
    <p className="text-xs text-[var(--portal-text-secondary)] mt-1 truncate">
      {entries.map(([key, val], i) => (
        <span key={key}>
          {i > 0 && <span className="mx-1">·</span>}
          <span className="text-[var(--portal-text-muted)]">{formatTypeName(key)}:</span>{' '}
          {formatFieldValue(val)}
        </span>
      ))}
    </p>
  )
}

export default function PortalDashboardPage() {
  const { token, clientBlock, portalConfig } = usePortal()

  const [blocks, setBlocks] = useState<PortalBlock[]>([])
  const [events, setEvents] = useState<PortalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      setLoading(true)
      setError(null)

      try {
        const [blocksRes, eventsRes] = await Promise.all([
          fetch(`/api/portal/${token}/blocks`),
          fetch(`/api/portal/${token}/events`),
        ])

        if (!cancelled) {
          if (blocksRes.ok) {
            const blocksData = await blocksRes.json()
            setBlocks(Array.isArray(blocksData) ? blocksData : blocksData.data ?? [])
          }

          if (eventsRes.ok) {
            const eventsData = await eventsRes.json()
            const allEvents = Array.isArray(eventsData) ? eventsData : eventsData.data ?? []
            setEvents(allEvents.slice(0, 5))
          }

          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load dashboard data. Please try again.')
          setLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, [token])

  if (loading) {
    return <DashboardSkeleton />
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-10 h-10 mx-auto mb-3 text-[var(--portal-error)]" />
        <p className="text-sm text-[var(--portal-text-secondary)] mb-4">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-[var(--portal-radius-sm)]
            bg-[var(--portal-primary)] text-[var(--portal-primary-foreground)]
            hover:opacity-90 transition-all duration-[var(--portal-transition)] active:scale-[0.98] min-h-[44px]"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Welcome header */}
      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl font-semibold text-[var(--portal-text-primary)]">
          Welcome, {clientBlock.name}
        </h1>
        <p className="text-sm text-[var(--portal-text-secondary)] mt-1">
          {portalConfig.name} Portal
        </p>
      </div>

      {/* Block cards */}
      {blocks.length === 0 ? (
        <div className="rounded-[var(--portal-radius)] border border-[var(--portal-card-border)] bg-[var(--portal-card-bg)] p-8 text-center mb-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--portal-bg)] flex items-center justify-center">
            <svg
              className="w-6 h-6 text-[var(--portal-text-muted)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
              />
            </svg>
          </div>
          <p className="text-sm text-[var(--portal-text-secondary)]">No items to display yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
          {blocks.map((block) => (
            <article
              key={block.id}
              className="rounded-[var(--portal-radius)] border border-[var(--portal-card-border)] bg-[var(--portal-card-bg)] p-4
                hover:shadow-[var(--portal-shadow-md)] hover:border-[var(--portal-card-border-hover)]
                transition-all duration-[var(--portal-transition)]"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-xs font-medium text-[var(--portal-text-muted)] uppercase tracking-wide">
                  {formatTypeName(block.type)}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(block.status)}`}
                >
                  {formatTypeName(block.status)}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-[var(--portal-text-primary)] truncate mb-1">
                {block.name}
              </h3>
              <FieldSummary fields={block.fields} max={3} />
              <p className="text-xs text-[var(--portal-text-muted)] flex items-center gap-1 mt-2">
                <Clock className="w-3 h-3" aria-hidden="true" />
                Updated {formatRelativeTime(block.updated_at)}
              </p>
            </article>
          ))}
        </div>
      )}

      {/* Recent Activity */}
      {events.length > 0 && (
        <section aria-labelledby="recent-activity-heading">
          <h2
            id="recent-activity-heading"
            className="text-base font-semibold text-[var(--portal-text-primary)] mb-3"
          >
            Recent Activity
          </h2>
          <div className="rounded-[var(--portal-radius)] border border-[var(--portal-card-border)] bg-[var(--portal-card-bg)]">
            {events.map((event, idx) => (
              <div key={event.id} className="px-4 py-3 flex items-start gap-3 relative">
                {/* Timeline connector */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="mt-0.5 w-2 h-2 rounded-full bg-[var(--portal-primary)] relative z-[1]" />
                  {idx < events.length - 1 && (
                    <div className="w-px flex-1 bg-[var(--portal-card-border)] mt-1 min-h-[20px]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--portal-text-primary)]">
                    {event.description || formatTypeName(event.type)}
                  </p>
                  <p className="text-xs text-[var(--portal-text-muted)] mt-0.5">
                    {formatRelativeTime(event.occurred_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div>
      {/* Header skeleton */}
      <div className="mb-8">
        <div className="h-7 w-48 rounded-[var(--portal-radius-sm)] portal-shimmer mb-2" />
        <div className="h-4 w-32 rounded-[var(--portal-radius-sm)] portal-shimmer" />
      </div>

      {/* Cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-[var(--portal-radius)] border border-[var(--portal-card-border)] p-4">
            <div className="flex justify-between mb-3">
              <div className="h-3 w-16 rounded portal-shimmer" />
              <div className="h-5 w-14 rounded-full portal-shimmer" />
            </div>
            <div className="h-4 w-32 rounded portal-shimmer mb-3" />
            <div className="h-3 w-24 rounded portal-shimmer" />
          </div>
        ))}
      </div>

      {/* Activity skeleton */}
      <div className="h-5 w-28 rounded portal-shimmer mb-3" />
      <div className="rounded-[var(--portal-radius)] border border-[var(--portal-card-border)]">
        {[1, 2, 3].map((i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full portal-shimmer" />
            <div className="flex-1">
              <div className="h-4 w-48 rounded portal-shimmer mb-1" />
              <div className="h-3 w-20 rounded portal-shimmer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
