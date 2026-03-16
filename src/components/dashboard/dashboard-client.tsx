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
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getBlockTypeLabel } from '@/lib/ui/block-type-badge'
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
  return 'bg-muted-foreground'
}

/** Convert a dot-delimited event type to human-readable label. */
function humanizeEventType(type: string): string {
  return type
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Map block type key to a Tailwind progress bar color. */
const BLOCK_TYPE_BAR_COLORS: Record<string, string> = {
  client: 'bg-blue-500',
  deal: 'bg-emerald-500',
  project: 'bg-amber-500',
  contract: 'bg-purple-500',
  contact: 'bg-slate-500',
  solution: 'bg-indigo-500',
  product: 'bg-teal-500',
  service: 'bg-violet-500',
  team_member: 'bg-orange-500',
  policy: 'bg-rose-500',
}

function getBarColor(type: string): string {
  return BLOCK_TYPE_BAR_COLORS[type] ?? 'bg-primary'
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

const BLOCK_TYPE_KEYS = ['client', 'deal', 'project', 'contract', 'contact', 'solution', 'product', 'service', 'team_member', 'policy'] as const

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
        <p className="text-[13px] text-destructive" role="alert">
          {fetchError ?? 'Could not load dashboard data.'}
        </p>
        <button
          onClick={fetchSummary}
          className="mt-3 text-[13px] font-medium text-foreground underline hover:no-underline"
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
          <h1 className="text-headline text-foreground">Dashboard</h1>
          <p className="text-[13px] text-muted-foreground mt-1">Your workspace at a glance</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} size="default">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Block
        </Button>
      </div>

      {/* ---- Stale data warning ---- */}
      {fetchError && (
        <p role="status" className="mb-4 text-xs text-amber-600 dark:text-amber-400">
          {fetchError}
        </p>
      )}

      {/* ---- Empty state CTA (zero blocks) ---- */}
      {block_counts.total === 0 && (
        <div className="rounded-lg border-2 border-dashed border-border bg-muted p-8 text-center mb-8">
          <LayoutGrid className="h-10 w-10 text-muted-foreground mx-auto mb-3 animate-list-item-in" aria-hidden="true" />
          <h2 className="text-title text-foreground mb-1">
            Create your first Block
          </h2>
          <p className="text-[13px] text-muted-foreground mb-4 max-w-md mx-auto">
            Blocks are the core entities in your workspace -- clients, deals,
            projects, and more. Start by creating one.
          </p>
          <Button asChild>
            <Link href="/library/blocks">Go to Blocks</Link>
          </Button>
        </div>
      )}

      {/* ---- Stat Cards ---- */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        aria-label="Operational metrics"
      >
        {STAT_CARDS.map((card) => {
          const Icon = card.icon
          const value = getStatValue(card.key)

          const cardContent = (
            <div
              className={cn(
                'rounded-xl border border-border bg-card p-6 hover-card',
                'flex flex-col justify-between h-full',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                'cursor-pointer transition-all'
              )}
            >
              <div className="flex items-start justify-between">
                <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                {card.href && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                )}
              </div>
              <div className="mt-3">
                <p className="text-display text-foreground tabular-nums">{value}</p>
                <p className="text-[13px] text-muted-foreground mt-1">{card.label}</p>
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
        <h2 className="text-title text-foreground mb-3">Recent Activity</h2>

        {displayEvents.length === 0 ? (
          <div className="rounded-lg border bg-background px-6 py-10 text-center">
            <Activity className="h-10 w-10 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
            <p className="text-[13px] text-muted-foreground">No events recorded yet.</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Events appear here when blocks are created or workflows run.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card divide-y max-h-[400px] overflow-y-auto">
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
                    <p className="text-[13px] font-medium text-foreground truncate">
                      {humanType}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {event.block_name ?? 'Org-level'}
                    </p>
                  </div>
                  <time
                    dateTime={event.occurred_at}
                    title={event.occurred_at}
                    className="text-xs text-muted-foreground shrink-0 whitespace-nowrap"
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
                    'block hover:bg-muted transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'
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
          <h2 className="text-title text-foreground mb-3">Quick Actions</h2>
          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon
              return (
                <Button
                  key={action.label}
                  variant="secondary"
                  size="sm"
                  asChild
                >
                  <Link href={action.href}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span className="text-[13px]">{action.label}</span>
                  </Link>
                </Button>
              )
            })}
          </div>
        </section>

        {/* Block Types Breakdown */}
        <section aria-label="Block type breakdown">
          <h2 className="text-title text-foreground mb-3">Block Types</h2>
          {activeBlockTypes.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              No blocks created yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {activeBlockTypes.map(({ key, count }) => (
                <Link
                  key={key}
                  href={`/library/blocks?type=${key}`}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1',
                    'text-[13px] text-foreground hover:bg-muted transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  )}
                >
                  <span
                    className={cn('h-2 w-2 rounded-full shrink-0', getBarColor(key))}
                    aria-hidden="true"
                  />
                  {getBlockTypeLabel(key)}
                  <span className="text-muted-foreground tabular-nums">{count}</span>
                </Link>
              ))}
            </div>
          )}
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
          <div className="h-8 w-28 rounded-md animate-pulse bg-muted" />
          <div className="h-4 w-48 rounded-md animate-pulse bg-muted mt-2" />
        </div>
        <div className="h-9 w-32 rounded-md animate-pulse bg-muted" />
      </div>

      {/* Stat card skeletons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-background p-6">
            <div className="flex items-start justify-between">
              <div className="h-5 w-5 rounded animate-pulse bg-muted" />
              <div className="h-4 w-4 rounded animate-pulse bg-muted" />
            </div>
            <div className="mt-3">
              <div className="h-9 w-16 rounded animate-pulse bg-muted" />
              <div className="h-4 w-24 rounded animate-pulse bg-muted mt-2" />
            </div>
          </div>
        ))}
      </div>

      {/* Activity feed skeleton */}
      <div className="mb-8">
        <div className="h-6 w-36 rounded animate-pulse bg-muted mb-3" />
        <div className="rounded-lg border bg-background divide-y">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="h-2.5 w-2.5 rounded-full animate-pulse bg-muted shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-40 rounded animate-pulse bg-muted" />
                <div className="h-3 w-28 rounded animate-pulse bg-muted" />
              </div>
              <div className="h-3 w-14 rounded animate-pulse bg-muted shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions + block types skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="h-6 w-32 rounded animate-pulse bg-muted mb-3" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-8 w-28 rounded-md animate-pulse bg-muted" />
            ))}
          </div>
        </div>
        <div>
          <div className="h-6 w-28 rounded animate-pulse bg-muted mb-3" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-7 w-20 rounded-md animate-pulse bg-muted" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
