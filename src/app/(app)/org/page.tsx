'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { PageContainer } from '@/components/shell/page-container'
import { PageHeader } from '@/components/shell/page-header'
import {
  Boxes,
  Users,
  GitBranch,
  CheckCircle2,
  Settings,
  UserPlus,
  Building2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import type {
  OrgOverview,
  HierarchyNode,
  TeamStats,
  BlockStats,
  RecentEvent,
} from '@/lib/org/overview'

// ─── Types ──────────────────────────────────────────────────────────────────

interface MetricCardProps {
  icon: React.ElementType
  value: number
  label: string
}

// ─── Constants ──────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: 'Configure Org', href: '/settings/org-profile', icon: Settings },
  { label: 'Add Team Member', href: '/settings/team/new', icon: UserPlus },
  { label: 'Create Sub-Org', href: '/settings/org-profile', icon: Building2 },
] as const

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(dateStr)
}

function formatEventType(eventType: string): string {
  return eventType
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatRoleName(role: string): string {
  return role
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatBlockType(type: string): string {
  return type
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function MetricCard({ icon: Icon, value, label }: MetricCardProps) {
  return (
    <div className="rounded-lg border bg-background p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  )
}

function QuickActionsBar() {
  return (
    <div className="flex flex-wrap gap-2" role="navigation" aria-label="Quick actions">
      {QUICK_ACTIONS.map((action) => (
        <Link
          key={action.href + action.label}
          href={action.href}
          className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <action.icon className="h-4 w-4" aria-hidden="true" />
          {action.label}
        </Link>
      ))}
    </div>
  )
}

function HierarchySection({ hierarchy }: { hierarchy: HierarchyNode[] }) {
  if (hierarchy.length === 0) return null

  // Build parent-child map
  const childMap = new Map<string | null, HierarchyNode[]>()
  for (const node of hierarchy) {
    const parentId = node.parent_org_id
    if (!childMap.has(parentId)) {
      childMap.set(parentId, [])
    }
    childMap.get(parentId)!.push(node)
  }

  function renderNode(node: HierarchyNode, depth: number): React.ReactNode {
    const children = childMap.get(node.id) ?? []
    return (
      <li key={node.id} style={{ paddingLeft: `${depth * 16}px` }}>
        <div className="flex items-center gap-2 py-1">
          <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm font-medium text-foreground">{node.name}</span>
          <span className="text-xs text-muted-foreground rounded bg-muted px-1.5 py-0.5">
            {node.level}
          </span>
        </div>
        {children.length > 0 && (
          <ul role="group">
            {children.map((child) => renderNode(child, depth + 1))}
          </ul>
        )}
      </li>
    )
  }

  // Find root nodes (those whose parent_org_id is not in the set of hierarchy node ids)
  const nodeIds = new Set(hierarchy.map((n) => n.id))
  const rootNodes = hierarchy.filter(
    (n) => n.parent_org_id === null || !nodeIds.has(n.parent_org_id)
  )

  return (
    <section aria-labelledby="hierarchy-heading">
      <h2 id="hierarchy-heading" className="text-lg font-semibold text-foreground mb-3">
        Organisation Hierarchy
      </h2>
      <div className="rounded-lg border bg-background p-4">
        <ul role="tree" aria-label="Organisation hierarchy">
          {rootNodes.map((root) => renderNode(root, 0))}
        </ul>
      </div>
    </section>
  )
}

function TeamSection({ team }: { team: TeamStats }) {
  const sortedRoles = Object.entries(team.by_role).sort(([, a], [, b]) => b - a)
  const maxCount = sortedRoles.length > 0 ? sortedRoles[0][1] : 0

  return (
    <section aria-labelledby="team-heading">
      <div className="flex items-center justify-between mb-3">
        <h2 id="team-heading" className="text-lg font-semibold text-foreground">
          Team Summary
        </h2>
        <Link
          href="/settings/team"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
        >
          View all
        </Link>
      </div>
      <div className="rounded-lg border bg-background p-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          <span className="text-xl font-bold text-foreground">{team.total}</span>{' '}
          team members
        </p>

        {sortedRoles.length > 0 && (
          <div className="space-y-2" aria-label="Role distribution">
            {sortedRoles.map(([role, count]) => (
              <div key={role} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{formatRoleName(role)}</span>
                  <span className="text-muted-foreground">{count}</span>
                </div>
                <div
                  className="h-2 rounded-full bg-muted overflow-hidden"
                  role="progressbar"
                  aria-valuenow={count}
                  aria-valuemin={0}
                  aria-valuemax={maxCount}
                  aria-label={`${formatRoleName(role)}: ${count} members`}
                >
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: maxCount > 0 ? `${(count / maxCount) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {team.recent.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-foreground mb-2">Recent Additions</h3>
            <ul className="space-y-1">
              {team.recent.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center justify-between text-sm py-1"
                >
                  <span className="text-foreground">{member.name}</span>
                  <span className="text-xs text-muted-foreground rounded bg-muted px-1.5 py-0.5">
                    {formatRoleName(member.role)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

function BlocksSection({ blocks }: { blocks: BlockStats }) {
  const sortedTypes = Object.entries(blocks.by_type).sort(([, a], [, b]) => b - a)
  const maxCount = sortedTypes.length > 0 ? sortedTypes[0][1] : 0

  return (
    <section aria-labelledby="blocks-heading">
      <div className="flex items-center justify-between mb-3">
        <h2 id="blocks-heading" className="text-lg font-semibold text-foreground">
          Block Distribution
        </h2>
        <Link
          href="/library/blocks"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
        >
          View all
        </Link>
      </div>
      <div className="rounded-lg border bg-background p-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          <span className="text-xl font-bold text-foreground">{blocks.total}</span>{' '}
          total blocks
        </p>

        {sortedTypes.length > 0 ? (
          <div className="space-y-2" aria-label="Block type distribution">
            {sortedTypes.map(([type, count]) => (
              <div key={type} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{formatBlockType(type)}</span>
                  <span className="text-muted-foreground">{count}</span>
                </div>
                <div
                  className="h-2 rounded-full bg-muted overflow-hidden"
                  role="progressbar"
                  aria-valuenow={count}
                  aria-valuemin={0}
                  aria-valuemax={maxCount}
                  aria-label={`${formatBlockType(type)}: ${count} blocks`}
                >
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: maxCount > 0 ? `${(count / maxCount) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No blocks created yet.</p>
        )}
      </div>
    </section>
  )
}

function RecentActivitySection({ events }: { events: RecentEvent[] }) {
  return (
    <section aria-labelledby="activity-heading">
      <h2 id="activity-heading" className="text-lg font-semibold text-foreground mb-3">
        Recent Activity
      </h2>
      <div className="rounded-lg border bg-background p-4">
        {events.length > 0 ? (
          <ul className="space-y-3" aria-label="Recent events timeline">
            {events.map((event) => (
              <li key={event.id} className="flex items-start gap-3">
                <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                      {formatEventType(event.event_type)}
                    </span>
                    <time
                      className="text-xs text-muted-foreground"
                      dateTime={event.created_at}
                    >
                      {formatRelativeTime(event.created_at)}
                    </time>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No recent events recorded.</p>
        )}
      </div>
    </section>
  )
}

function LoadingSkeleton() {
  return (
    <PageContainer maxWidth="xl">
      <div className="animate-pulse space-y-6">
        {/* Header skeleton */}
        <div className="border-b pb-4 mb-6">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-4 w-32 bg-muted rounded mt-2" />
        </div>

        {/* Quick actions skeleton */}
        <div className="flex gap-2">
          <div className="h-8 w-32 bg-muted rounded" />
          <div className="h-8 w-36 bg-muted rounded" />
          <div className="h-8 w-32 bg-muted rounded" />
        </div>

        {/* Metric cards skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-background p-4">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 bg-muted rounded" />
                <div>
                  <div className="h-7 w-12 bg-muted rounded" />
                  <div className="h-3 w-20 bg-muted rounded mt-1" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Sections skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-lg border bg-background p-4 h-48" />
          <div className="rounded-lg border bg-background p-4 h-48" />
        </div>
        <div className="rounded-lg border bg-background p-4 h-40" />
      </div>
    </PageContainer>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <PageContainer maxWidth="xl">
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="h-10 w-10 text-destructive mb-4" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-foreground mb-1">
          Failed to load organisation
        </h2>
        <p className="text-sm text-muted-foreground mb-4">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Retry
        </button>
      </div>
    </PageContainer>
  )
}

function EmptyState() {
  return (
    <PageContainer maxWidth="xl">
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Building2 className="h-10 w-10 text-muted-foreground mb-4" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-foreground mb-1">
          No organisation data
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Your organisation has not been set up yet. Configure your org profile to get started.
        </p>
        <Link
          href="/settings/org-profile"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
          Configure Org
        </Link>
      </div>
    </PageContainer>
  )
}

// ─── Main Page Component ────────────────────────────────────────────────────

export default function OrgOverviewPage() {
  const [data, setData] = useState<OrgOverview | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/org/overview')

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        const msg = body?.error?.message ?? `Request failed with status ${res.status}`
        throw new Error(msg)
      }

      const json = await res.json()
      setData(json.data as OrgOverview)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (isLoading) {
    return <LoadingSkeleton />
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchData} />
  }

  if (!data) {
    return <EmptyState />
  }

  return (
    <PageContainer maxWidth="xl">
      {/* Page header */}
      <PageHeader
        title={data.org.name}
        subtitle="Organisation Overview"
        actions={<QuickActionsBar />}
      />

      {/* Org meta info */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-6 text-sm text-muted-foreground">
        {data.org.slug && (
          <span>
            Slug: <span className="font-medium text-foreground">{data.org.slug}</span>
          </span>
        )}
        <span>
          Created: <time dateTime={data.org.created_at} className="font-medium text-foreground">{formatDate(data.org.created_at)}</time>
        </span>
        <span>
          Level: <span className="font-medium text-foreground">{data.org.org_level}</span>
        </span>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard icon={Boxes} value={data.blocks.total} label="Total Blocks" />
        <MetricCard icon={Users} value={data.team.total} label="Team Size" />
        <MetricCard icon={GitBranch} value={data.workflows.active} label="Active Workflows" />
        <MetricCard icon={CheckCircle2} value={data.workflows.completed} label="Completed Workflows" />
      </div>

      {/* Hierarchy section (conditional) */}
      <div className="space-y-8">
        <HierarchySection hierarchy={data.hierarchy} />

        {/* Two-column layout for Team + Blocks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TeamSection team={data.team} />
          <BlocksSection blocks={data.blocks} />
        </div>

        {/* Recent activity */}
        <RecentActivitySection events={data.recent_events} />
      </div>
    </PageContainer>
  )
}
