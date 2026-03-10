'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  LayoutGrid,
  GitBranch,
  Activity,
  CheckSquare,
  Plus,
  ArrowRight,
  Library,
  Cable,
} from 'lucide-react'
import { CreateBlockModal } from './create-block-modal'
import { cn } from '@/lib/utils'
import type { DashboardSummary, RecentEvent } from '@/app/api/dashboard/summary/route'

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatRelativeTime(dateString: string): string {
  const now = Date.now()
  const then = new Date(dateString).getTime()
  const diff = now - then
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days > 1 ? 's' : ''} ago`
}

function getEventColor(type: string): string {
  if (type.startsWith('block.')) return 'bg-blue-500'
  if (type.startsWith('email.')) return 'bg-green-500'
  if (type.startsWith('document.')) return 'bg-amber-500'
  if (type.startsWith('workflow.')) return 'bg-purple-500'
  if (type.startsWith('onboarding.')) return 'bg-cyan-500'
  return 'bg-gray-400'
}

/** Convert a dot-delimited event type to human-readable label. */
function humanizeEventType(type: string): string {
  return type
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Capitalize a single word. */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface DashboardClientProps {
  /** Initial data from SSR — null if server fetch failed (client will re-fetch) */
  initialData: DashboardSummary | null
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const POLL_INTERVAL_MS = 30_000

const STAT_CARDS = [
  {
    key: 'blocks',
    label: 'Total Blocks',
    icon: LayoutGrid,
    href: '/library/blocks',
  },
  {
    key: 'workflows',
    label: 'Active Workflows',
    icon: GitBranch,
    href: '/workflows',
  },
  {
    key: 'events',
    label: 'Events (24h)',
    icon: Activity,
    href: null, // scrolls to activity section
  },
  {
    key: 'tasks',
    label: 'Pending Tasks',
    icon: CheckSquare,
    href: '/my-work',
  },
] as const

const QUICK_ACTIONS = [
  { label: 'Create Block', href: '/library/blocks', icon: Plus },
  { label: 'New Workflow', href: '/workflows', icon: GitBranch },
  { label: 'Open Library', href: '/library/blocks', icon: Library },
  { label: 'View Integrations', href: '/library/integrations', icon: Cable },
] as const

const BLOCK_TYPE_KEYS = ['client', 'deal', 'project', 'contract', 'contact'] as const

/* -------------------------------------------------------------------------- */
/*  Main Component                                                             */
/* -------------------------------------------------------------------------- */

/**
 * DashboardClient -- manages dashboard state and 30-second polling.
 * Renders stat cards, recent activity, quick actions, and block type breakdown.
 *
 * Receives SSR initial data to avoid loading flash on first paint.
 * After mount it polls GET /api/dashboard/summary every 30 seconds.
 */
export function DashboardClient({ initialData }: DashboardClientProps) {
  const [data, setData] = useState<DashboardSummary | null>(initialData)
  const [loading, setLoading] = useState(initialData === null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const activityRef = useRef<HTMLElement>(null)

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
      setFetchError('Network error -- dashboard data may be stale')
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

  /* ---- Loading skeleton ---- */
  if (loading) {
    return <DashboardSkeleton />
  }

  /* ---- Hard error: no data at all after fetch attempt ---- */
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

  /** Resolve stat card value from the key */
  function getStatValue(key: string): number {
    switch (key) {
      case 'blocks':
        return block_counts.total
      case 'workflows':
        return active_workflow_jobs
      case 'events':
        return events_last_24h
      case 'tasks':
        return 0 // Pending tasks not yet in API -- show 0
      default:
        return 0
    }
  }

  /** Handle stat card click -- scroll for events, navigate for others */
  function handleStatClick(key: string) {
    if (key === 'events' && activityRef.current) {
      activityRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Limit to 10 most recent events for the feed
  const displayEvents = recent_events.slice(0, 10)

  // Block types with count > 0
  const activeBlockTypes = BLOCK_TYPE_KEYS
    .map((key) => ({ key, count: block_counts[key] }))
    .filter((entry) => entry.count > 0)

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* ---- Page Header ---- */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Your workspace at a glance</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className={cn(
            'inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium',
            'bg-gray-900 text-white',
            'hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900'
          )}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Block
        </button>
      </div>

      {/* ---- Stale data warning ---- */}
      {fetchError && (
        <p role="status" className="mb-4 text-xs text-amber-600">
          {fetchError}
        </p>
      )}

      {/* ---- Empty state CTA (zero blocks) ---- */}
      {block_counts.total === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center mb-8">
          <div className="mx-auto mb-3 text-3xl" aria-hidden="true">
            +
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Create your first Block
          </h2>
          <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
            Blocks are the core entities in your workspace -- clients, deals,
            projects, and more. Start by creating one.
          </p>
          <Link
            href="/library/blocks"
            className={cn(
              'inline-flex px-5 py-2.5 rounded-md text-sm font-medium bg-gray-900 text-white',
              'hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900'
            )}
          >
            Go to Blocks
          </Link>
        </div>
      )}

      {/* ---- Stat Cards ---- */}
      <div
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        aria-label="Operational metrics"
      >
        {STAT_CARDS.map((card) => {
          const Icon = card.icon
          const value = getStatValue(card.key)

          const cardContent = (
            <div
              className={cn(
                'rounded-lg border bg-white p-4',
                'hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-1',
                'flex flex-col justify-between h-full'
              )}
            >
              <div className="flex items-start justify-between">
                <Icon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                {card.href && (
                  <ArrowRight className="h-4 w-4 text-gray-300" aria-hidden="true" />
                )}
              </div>
              <div className="mt-3">
                <p className="text-3xl font-bold text-gray-900 tabular-nums">{value}</p>
                <p className="text-sm text-gray-500 mt-1">{card.label}</p>
              </div>
            </div>
          )

          if (card.href) {
            return (
              <Link
                key={card.key}
                href={card.href}
                className="block rounded-lg focus-visible:outline-none"
                aria-label={`${card.label}: ${value}`}
              >
                {cardContent}
              </Link>
            )
          }

          // Events card -- scroll to activity section instead of navigating
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => handleStatClick(card.key)}
              className="text-left rounded-lg focus-visible:outline-none"
              aria-label={`${card.label}: ${value}. Click to scroll to activity feed.`}
            >
              {cardContent}
            </button>
          )
        })}
      </div>

      {/* ---- Recent Activity Feed ---- */}
      <section ref={activityRef} aria-label="Recent activity" className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent Activity</h2>

        {displayEvents.length === 0 ? (
          <div className="rounded-lg border bg-white px-6 py-10 text-center">
            <Activity className="h-10 w-10 text-gray-300 mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm text-gray-500">No events recorded yet.</p>
            <p className="mt-1 text-xs text-gray-400">
              Events appear here when blocks are created or workflows run.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border bg-white divide-y">
            {displayEvents.map((event: RecentEvent) => {
              const dotColor = getEventColor(event.type)
              const relative = formatRelativeTime(event.occurred_at)
              const humanType = humanizeEventType(event.type)

              const row = (
                <div className="flex items-center gap-3 px-4 py-3">
                  <span
                    className={cn('h-2.5 w-2.5 rounded-full shrink-0', dotColor)}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {humanType}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {event.block_name ?? 'Org-level'}
                    </p>
                  </div>
                  <time
                    dateTime={event.occurred_at}
                    title={event.occurred_at}
                    className="text-xs text-gray-400 shrink-0 whitespace-nowrap"
                  >
                    {relative}
                  </time>
                </div>
              )

              return event.block_id ? (
                <Link
                  key={event.id}
                  href={`/blocks/${event.block_id}`}
                  className={cn(
                    'block hover:bg-gray-50 transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-900'
                  )}
                  aria-label={`${humanType} on ${event.block_name ?? 'org'} -- ${relative}`}
                >
                  {row}
                </Link>
              ) : (
                <div key={event.id}>{row}</div>
              )
            })}
          </div>
        )}
      </section>

      {/* ---- Quick Actions + Block Type Breakdown ---- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <section aria-label="Quick actions">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Quick Actions</h2>
          <div className="rounded-lg border bg-white p-4">
            <div className="flex flex-col gap-2">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon
                return (
                  <Link
                    key={action.label}
                    href={action.href}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-700',
                      'hover:bg-gray-50 border transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900'
                    )}
                  >
                    <Icon className="h-4 w-4 text-gray-400" aria-hidden="true" />
                    {action.label}
                  </Link>
                )
              })}
            </div>
          </div>
        </section>

        {/* Block Types Breakdown */}
        <section aria-label="Block type breakdown">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Block Types</h2>
          <div className="rounded-lg border bg-white p-4">
            {activeBlockTypes.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">
                No blocks created yet.
              </p>
            ) : (
              <dl className="space-y-3">
                {activeBlockTypes.map(({ key, count }) => {
                  const maxCount = Math.max(...activeBlockTypes.map((t) => t.count), 1)
                  const widthPercent = Math.round((count / maxCount) * 100)

                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <dt className="text-sm text-gray-700">
                          {capitalize(key)}s
                        </dt>
                        <dd className="text-sm font-medium text-gray-900 tabular-nums">
                          {count}
                        </dd>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-100" aria-hidden="true">
                        <div
                          className="h-2 rounded-full bg-gray-900 transition-all"
                          style={{ width: `${widthPercent}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </dl>
            )}
          </div>
        </section>
      </div>

      {/* ---- Create block modal ---- */}
      {showCreateModal && (
        <CreateBlockModal
          onClose={() => setShowCreateModal(false)}
          onCreated={fetchSummary}
        />
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Loading Skeleton                                                           */
/* -------------------------------------------------------------------------- */

/** Loading skeleton shown while initial dashboard data fetches */
function DashboardSkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto" aria-busy="true" aria-label="Loading dashboard">
      {/* Header skeleton */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="h-8 w-28 rounded-md bg-gray-100 animate-pulse" />
          <div className="h-4 w-48 rounded-md bg-gray-100 animate-pulse mt-2" />
        </div>
        <div className="h-9 w-32 rounded-md bg-gray-100 animate-pulse" />
      </div>

      {/* Stat card skeletons */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-white p-4">
            <div className="flex items-start justify-between">
              <div className="h-5 w-5 rounded bg-gray-100 animate-pulse" />
              <div className="h-4 w-4 rounded bg-gray-100 animate-pulse" />
            </div>
            <div className="mt-3">
              <div className="h-9 w-16 rounded bg-gray-100 animate-pulse" />
              <div className="h-4 w-24 rounded bg-gray-100 animate-pulse mt-2" />
            </div>
          </div>
        ))}
      </div>

      {/* Activity feed skeleton */}
      <div className="mb-8">
        <div className="h-6 w-36 rounded bg-gray-100 animate-pulse mb-3" />
        <div className="rounded-lg border bg-white divide-y">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="h-2.5 w-2.5 rounded-full bg-gray-100 animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-40 rounded bg-gray-100 animate-pulse" />
                <div className="h-3 w-28 rounded bg-gray-100 animate-pulse" />
              </div>
              <div className="h-3 w-14 rounded bg-gray-100 animate-pulse shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions + block types skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="h-6 w-32 rounded bg-gray-100 animate-pulse mb-3" />
          <div className="rounded-lg border bg-white p-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 w-full rounded-md bg-gray-100 animate-pulse" />
            ))}
          </div>
        </div>
        <div>
          <div className="h-6 w-28 rounded bg-gray-100 animate-pulse mb-3" />
          <div className="rounded-lg border bg-white p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <div className="flex justify-between mb-1">
                  <div className="h-4 w-20 rounded bg-gray-100 animate-pulse" />
                  <div className="h-4 w-8 rounded bg-gray-100 animate-pulse" />
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
