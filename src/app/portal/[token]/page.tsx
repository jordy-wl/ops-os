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
}

interface PortalEvent {
  id: string
  type: string
  description?: string
  payload?: Record<string, unknown>
  occurred_at: string
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  completed: 'bg-green-100 text-green-700',
  in_progress: 'bg-amber-100 text-amber-700',
  pending: 'bg-amber-100 text-amber-700',
  overdue: 'bg-red-100 text-red-700',
  archived: 'bg-gray-100 text-gray-500',
}

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] || 'bg-gray-100 text-gray-600'
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
        <AlertCircle className="w-10 h-10 mx-auto mb-3 text-red-400" />
        <p className="text-sm text-gray-600 mb-4">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md
            bg-[var(--portal-primary)] text-[var(--portal-primary-foreground)]
            hover:opacity-90 transition-opacity min-h-[44px]"
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
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
          Welcome, {clientBlock.name}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {portalConfig.name} Portal
        </p>
      </div>

      {/* Block cards */}
      {blocks.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center mb-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-gray-400"
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
          <p className="text-sm text-gray-500">No items to display yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
          {blocks.map((block) => (
            <article
              key={block.id}
              className="rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                  {formatTypeName(block.type)}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(block.status)}`}
                >
                  {formatTypeName(block.status)}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-gray-900 truncate mb-2">
                {block.name}
              </h3>
              <p className="text-xs text-gray-400 flex items-center gap-1">
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
            className="text-base font-semibold text-gray-900 mb-3"
          >
            Recent Activity
          </h2>
          <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
            {events.map((event) => (
              <div key={event.id} className="px-4 py-3 flex items-start gap-3">
                <div className="mt-0.5 w-2 h-2 rounded-full bg-[var(--portal-primary)] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">
                    {event.description || formatTypeName(event.type)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
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
    <div className="animate-pulse">
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="h-7 w-48 bg-gray-200 rounded mb-2" />
        <div className="h-4 w-32 bg-gray-100 rounded" />
      </div>

      {/* Cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-gray-200 p-4">
            <div className="flex justify-between mb-3">
              <div className="h-3 w-16 bg-gray-100 rounded" />
              <div className="h-5 w-14 bg-gray-100 rounded-full" />
            </div>
            <div className="h-4 w-32 bg-gray-200 rounded mb-3" />
            <div className="h-3 w-24 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      {/* Activity skeleton */}
      <div className="h-5 w-28 bg-gray-200 rounded mb-3" />
      <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
        {[1, 2, 3].map((i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-gray-200" />
            <div className="flex-1">
              <div className="h-4 w-48 bg-gray-100 rounded mb-1" />
              <div className="h-3 w-20 bg-gray-50 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
