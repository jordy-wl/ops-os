'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { MetricCard } from './metric-card'
import { RecentEventsFeed } from './recent-events-feed'
import { CreateBlockModal } from './create-block-modal'
import { cn } from '@/lib/utils'
import type { DashboardSummary } from '@/app/api/dashboard/summary/route'

interface DashboardClientProps {
  /** Initial data from SSR — null if server fetch failed (client will re-fetch) */
  initialData: DashboardSummary | null
}

const POLL_INTERVAL_MS = 30_000

/**
 * DashboardClient — manages dashboard state and 30-second polling.
 * Renders metric cards, recent events feed, and the "Create Block" action.
 *
 * Receives SSR initial data to avoid loading flash on first paint.
 * After mount it polls GET /api/dashboard/summary every 30 seconds.
 *
 * @param initialData - Pre-fetched dashboard summary from the server component
 */
export function DashboardClient({ initialData }: DashboardClientProps) {
  const [data, setData] = useState<DashboardSummary | null>(initialData)
  const [loading, setLoading] = useState(initialData === null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/summary')
      const json = await res.json()

      if (!res.ok) {
        setFetchError('Failed to refresh dashboard data')
        return
      }

      setData(json.data as DashboardSummary)
      setFetchError(null)
    } catch {
      setFetchError('Network error — dashboard data may be stale')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // If no initial data, fetch immediately
    if (initialData === null) {
      fetchSummary()
    }

    const interval = setInterval(fetchSummary, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [initialData, fetchSummary])

  // Full-page skeleton while initial data loads
  if (loading) {
    return <DashboardSkeleton />
  }

  // Hard error: no data at all after fetch attempt
  if (!data) {
    return (
      <div className="p-6 lg:p-8">
        <p className="text-sm text-red-600" role="alert">
          {fetchError ?? 'Could not load dashboard data.'}
        </p>
        <button
          onClick={fetchSummary}
          className="mt-3 text-sm font-medium text-gray-900 underline hover:no-underline"
        >
          Try again
        </button>
      </div>
    )
  }

  const { block_counts, active_workflow_jobs, events_last_24h, recent_events } = data

  return (
    <div className="p-6 lg:p-8">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className={cn(
            'px-4 py-2 rounded-md text-sm font-medium bg-gray-900 text-white',
            'hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900'
          )}
        >
          + Create Block
        </button>
      </div>

      {/* Stale data warning — shown on refresh error but we still have previous data */}
      {fetchError && (
        <p role="status" className="mb-4 text-xs text-amber-600">
          {fetchError}
        </p>
      )}

      {/* Empty state CTA — shown when org has zero blocks */}
      {block_counts.total === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center mb-8">
          <div className="mx-auto mb-3 text-3xl" aria-hidden="true">
            +
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Create your first Block
          </h2>
          <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
            Blocks are the core entities in your workspace — clients, deals,
            projects, and more. Start by creating one.
          </p>
          <Link
            href="/blocks"
            className={cn(
              'inline-flex px-5 py-2.5 rounded-md text-sm font-medium bg-gray-900 text-white',
              'hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900'
            )}
          >
            Go to Blocks
          </Link>
        </div>
      )}

      {/* Metric cards — 2 cols on mobile, 4 on desktop */}
      <div
        className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-8"
        aria-label="Operational metrics"
      >
        <MetricCard label="Total Blocks" value={block_counts.total} />
        <MetricCard
          label="Active Workflows"
          value={active_workflow_jobs}
          sublabel="pending + running"
        />
        <MetricCard
          label="Events (24h)"
          value={events_last_24h}
          sublabel="across all blocks"
        />
        {/* Block type breakdown — shows the most populated type */}
        <div className="rounded-lg border bg-white p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            By Type
          </p>
          <dl className="space-y-0.5">
            {(
              [
                ['Clients', block_counts.client],
                ['Deals', block_counts.deal],
                ['Projects', block_counts.project],
                ['Contracts', block_counts.contract],
                ['Contacts', block_counts.contact],
              ] as [string, number][]
            ).map(([label, count]) => (
              <div key={label} className="flex justify-between text-xs">
                <dt className="text-gray-500">{label}</dt>
                <dd className="font-medium text-gray-900 tabular-nums">{count}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Recent events feed */}
      <RecentEventsFeed events={recent_events} />

      {/* Create block modal */}
      {showCreateModal && (
        <CreateBlockModal
          onClose={() => setShowCreateModal(false)}
          onCreated={fetchSummary}
        />
      )}
    </div>
  )
}

/** Loading skeleton shown while initial dashboard data fetches */
function DashboardSkeleton() {
  return (
    <div className="p-6 lg:p-8" aria-busy="true" aria-label="Loading dashboard">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-28 rounded-md bg-gray-100 animate-pulse" />
        <div className="h-9 w-32 rounded-md bg-gray-100 animate-pulse" />
      </div>

      {/* Metric card skeletons */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-white p-5 space-y-2">
            <div className="h-3 w-20 rounded bg-gray-100 animate-pulse" />
            <div className="h-8 w-12 rounded bg-gray-100 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Events feed skeleton */}
      <div className="h-4 w-28 rounded bg-gray-100 animate-pulse mb-3" />
      <div className="rounded-lg border bg-white divide-y">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3 gap-4">
            <div className="space-y-1.5 flex-1">
              <div className="h-3.5 w-40 rounded bg-gray-100 animate-pulse" />
              <div className="h-3 w-28 rounded bg-gray-100 animate-pulse" />
            </div>
            <div className="h-3 w-12 rounded bg-gray-100 animate-pulse shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
