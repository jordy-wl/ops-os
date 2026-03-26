'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { PageContainer } from '@/components/shell/page-container'
import { PageHeader } from '@/components/shell/page-header'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
  TrendingUp,
  DollarSign,
  Package,
  Wrench,
  Grid2X2,
  Target,
  Plus,
  Sparkles,
  Pencil,
  Save,
  X,
  Network,
  FolderTree,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { DynamicFieldRenderer } from '@/components/blocks/dynamic-field-renderer'
import type {
  OrgOverview,
  HierarchyNode,
  TeamStats,
  BlockStats,
  RecentEvent,
} from '@/lib/org/overview'
import type { HierarchyBlock } from '@/lib/org/block-hierarchy'

// ─── Revenue Types ──────────────────────────────────────────────────────────

interface RevenueSummary {
  total_pipeline: number
  weighted_forecast: number
  closed_won: number
  solution_recurring: number
  deal_count: number
  solution_count: number
}

interface StageFunnel {
  stage: string
  count: number
  value: number
  probability: number
}

interface MonthlyForecast {
  month: string
  value: number
}

interface RevenueData {
  summary: RevenueSummary
  stage_funnel: StageFunnel[]
  monthly_forecast: MonthlyForecast[]
  solutions: { id: string; name: string; pricing_model: string; value: number }[]
  products: { id: string; name: string; unit_price: number; currency: string }[]
  services: { id: string; name: string; hourly_rate: number; currency: string }[]
}

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
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <div>
          <p className="text-lg font-semibold text-foreground">{value}</p>
          <p className="text-[12px] text-muted-foreground">{label}</p>
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
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
          <span className="text-[13px] font-medium text-foreground">{node.name}</span>
          <span className="text-[11px] text-muted-foreground rounded bg-muted px-1.5 py-0.5">
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
      <h2 id="hierarchy-heading" className="text-[13px] font-semibold text-foreground mb-3">
        Organisation Hierarchy
      </h2>
      <div className="rounded-md border border-border bg-card p-4">
        <ul role="tree" aria-label="Organisation hierarchy">
          {rootNodes.map((root) => renderNode(root, 0))}
        </ul>
      </div>
    </section>
  )
}

// ─── Block Hierarchy Section (Structure Tab) ────────────────────────────────

const HIERARCHY_ICONS: Record<string, React.ElementType> = {
  organisation: Building2,
  division: Building2,
  department: FolderTree,
  team: Users,
}

const HIERARCHY_COLORS: Record<string, string> = {
  organisation: 'text-slate-500',
  division: 'text-indigo-500',
  department: 'text-violet-500',
  team: 'text-cyan-500',
}

function BlockHierarchySection({ hierarchy }: { hierarchy: HierarchyBlock[] }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  if (hierarchy.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Network className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-foreground mb-1">No hierarchy blocks yet</p>
        <p className="text-[13px] text-muted-foreground max-w-sm">
          Create divisions, departments, and teams to build your org structure.
          Use the AI chat or create blocks manually to get started.
        </p>
      </div>
    )
  }

  // Build parent-child map
  const childMap = new Map<string | null, HierarchyBlock[]>()
  for (const node of hierarchy) {
    const parentId = node.parent_id
    if (!childMap.has(parentId)) {
      childMap.set(parentId, [])
    }
    childMap.get(parentId)!.push(node)
  }

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function renderNode(node: HierarchyBlock, depth: number): React.ReactNode {
    const children = childMap.get(node.id) ?? []
    const Icon = HIERARCHY_ICONS[node.block_type] ?? Building2
    const colorClass = HIERARCHY_COLORS[node.block_type] ?? 'text-muted-foreground'
    const isCollapsed = collapsed.has(node.id)
    const hasChildren = children.length > 0

    return (
      <li key={node.id}>
        <div
          className="flex items-center gap-2 py-1.5 group"
          style={{ paddingLeft: `${depth * 20}px` }}
        >
          {/* Tree connector */}
          {depth > 0 && (
            <span className="text-border" aria-hidden="true">
              {'└'}
            </span>
          )}

          {/* Expand/collapse */}
          {hasChildren ? (
            <button
              onClick={() => toggleCollapse(node.id)}
              className="flex h-5 w-5 items-center justify-center rounded hover:bg-accent"
              aria-label={isCollapsed ? 'Expand' : 'Collapse'}
            >
              {isCollapsed ? (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          ) : (
            <span className="w-5" />
          )}

          {/* Icon */}
          <Icon className={`h-4 w-4 ${colorClass}`} aria-hidden="true" />

          {/* Name — clickable link to block detail */}
          <Link
            href={`/blocks/${node.id}`}
            className="text-[13px] font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            {node.name}
          </Link>

          {/* Type badge */}
          <span className={`text-[10px] font-medium uppercase tracking-wide ${colorClass}`}>
            {node.block_type}
          </span>

          {/* Head/lead name */}
          {node.head_name && (
            <span className="text-[11px] text-muted-foreground">
              — {node.head_name}
            </span>
          )}

          {/* Member count for teams */}
          {node.block_type === 'team' && node.member_count !== undefined && (
            <span className="text-[11px] text-muted-foreground">
              ({node.member_count} {node.member_count === 1 ? 'member' : 'members'})
            </span>
          )}
        </div>

        {/* Children */}
        {hasChildren && !isCollapsed && (
          <ul role="group">
            {children.map((child) => renderNode(child, depth + 1))}
          </ul>
        )}
      </li>
    )
  }

  // Find root nodes
  const nodeIds = new Set(hierarchy.map((n) => n.id))
  const rootNodes = hierarchy.filter(
    (n) => n.parent_id === null || !nodeIds.has(n.parent_id)
  )

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <ul role="tree" aria-label="Organisation structure">
        {rootNodes.map((root) => renderNode(root, 0))}
      </ul>
    </div>
  )
}

function TeamSection({ team }: { team: TeamStats }) {
  const sortedRoles = Object.entries(team.by_role).sort(([, a], [, b]) => b - a)
  const maxCount = sortedRoles.length > 0 ? sortedRoles[0][1] : 0

  return (
    <section aria-labelledby="team-heading">
      <div className="flex items-center justify-between mb-3">
        <h2 id="team-heading" className="text-[13px] font-semibold text-foreground">
          Team Summary
        </h2>
        <Link
          href="/settings/team"
          className="text-[13px] text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
        >
          View all
        </Link>
      </div>
      <div className="rounded-md border border-border bg-card p-4 space-y-4">
        <p className="text-[13px] text-muted-foreground">
          <span className="text-lg font-semibold text-foreground">{team.total}</span>{' '}
          team members
        </p>

        {sortedRoles.length > 0 && (
          <div className="space-y-2" aria-label="Role distribution">
            {sortedRoles.map(([role, count]) => (
              <div key={role} className="space-y-1">
                <div className="flex items-center justify-between text-[13px]">
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
            <h3 className="text-[13px] font-medium text-foreground mb-2">Recent Additions</h3>
            <ul className="space-y-1">
              {team.recent.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center justify-between text-[13px] py-1"
                >
                  <span className="text-foreground">{member.name}</span>
                  <span className="text-[11px] text-muted-foreground rounded bg-muted px-1.5 py-0.5">
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
        <h2 id="blocks-heading" className="text-[13px] font-semibold text-foreground">
          Block Distribution
        </h2>
        <Link
          href="/library/blocks"
          className="text-[13px] text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
        >
          View all
        </Link>
      </div>
      <div className="rounded-md border border-border bg-card p-4 space-y-4">
        <p className="text-[13px] text-muted-foreground">
          <span className="text-lg font-semibold text-foreground">{blocks.total}</span>{' '}
          total blocks
        </p>

        {sortedTypes.length > 0 ? (
          <div className="space-y-2" aria-label="Block type distribution">
            {sortedTypes.map(([type, count]) => (
              <div key={type} className="space-y-1">
                <div className="flex items-center justify-between text-[13px]">
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
          <p className="text-[13px] text-muted-foreground">No blocks created yet.</p>
        )}
      </div>
    </section>
  )
}

function RecentActivitySection({ events }: { events: RecentEvent[] }) {
  return (
    <section aria-labelledby="activity-heading">
      <h2 id="activity-heading" className="text-[13px] font-semibold text-foreground mb-3">
        Recent Activity
      </h2>
      <div className="rounded-md border border-border bg-card p-4">
        {events.length > 0 ? (
          <ul className="space-y-2.5" aria-label="Recent events timeline">
            {events.map((event) => (
              <li key={event.id} className="flex items-start gap-3">
                <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                      {formatEventType(event.event_type)}
                    </span>
                    <time
                      className="text-[12px] text-muted-foreground"
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
          <p className="text-[13px] text-muted-foreground">No recent events recorded.</p>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 bg-muted rounded" />
                <div>
                  <div className="h-6 w-12 bg-muted rounded" />
                  <div className="h-3 w-20 bg-muted rounded mt-1" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Sections skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-md border border-border bg-card p-4 h-48" />
          <div className="rounded-md border border-border bg-card p-4 h-48" />
        </div>
        <div className="rounded-md border border-border bg-card p-4 h-40" />
      </div>
    </PageContainer>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <PageContainer maxWidth="xl">
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="h-10 w-10 text-destructive mb-4" aria-hidden="true" />
        <h2 className="text-[15px] font-semibold text-foreground mb-1">
          Failed to load organisation
        </h2>
        <p className="text-[13px] text-muted-foreground mb-4">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
        <h2 className="text-[15px] font-semibold text-foreground mb-1">
          No organisation data
        </h2>
        <p className="text-[13px] text-muted-foreground mb-4">
          Your organisation has not been set up yet. Configure your org profile to get started.
        </p>
        <Link
          href="/settings/org-profile"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
          Configure Org
        </Link>
      </div>
    </PageContainer>
  )
}

// ─── Revenue Snapshot (Overview tab) ────────────────────────────────────────

function RevenueSnapshot() {
  const [summary, setSummary] = useState<RevenueSummary | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/org/revenue')
        if (res.ok) {
          const json = await res.json()
          if (json.data?.summary) setSummary(json.data.summary)
        }
      } catch {
        // Silently fail — this is a supplemental widget
      }
    }
    load()
  }, [])

  if (!summary) return null

  return (
    <section aria-labelledby="revenue-snapshot-heading">
      <div className="flex items-center justify-between mb-3">
        <h2 id="revenue-snapshot-heading" className="text-[13px] font-semibold text-foreground">
          Revenue Snapshot
        </h2>
        <span className="text-[11px] text-muted-foreground">Forecast</span>
      </div>
      <div className="rounded-md border border-border bg-card p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-lg font-semibold text-foreground">{formatCurrency(summary.total_pipeline)}</p>
            <p className="text-[11px] text-muted-foreground">Pipeline</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">{formatCurrency(summary.weighted_forecast)}</p>
            <p className="text-[11px] text-muted-foreground">Weighted Forecast</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">{formatCurrency(summary.closed_won)}</p>
            <p className="text-[11px] text-muted-foreground">Closed Won</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">{summary.deal_count}</p>
            <p className="text-[11px] text-muted-foreground">Active Deals</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function TeamUtilization({ team }: { team: TeamStats }) {
  const [utilData, setUtilData] = useState<{
    members: { user_id: string; name: string; tasks_completed: number; total_time_seconds: number; on_time_rate: number; billable_rate: number }[]
    totals: { total_tasks_completed: number; total_time_seconds: number; avg_on_time_rate: number }
  } | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/performance/team?weeks=4')
        if (res.ok) {
          const json = await res.json()
          if (json.data?.totals && Array.isArray(json.data?.members)) setUtilData(json.data)
        }
      } catch {
        // Best-effort — falls back to basic stats
      }
    }
    load()
  }, [])

  return (
    <section aria-labelledby="utilization-heading">
      <h2 id="utilization-heading" className="text-[13px] font-semibold text-foreground mb-3">
        Team Utilization
      </h2>
      <div className="rounded-md border border-border bg-card p-4">
        {/* Summary row */}
        <div className="grid grid-cols-3 gap-4 text-center mb-4">
          <div>
            <p className="text-lg font-semibold text-foreground">{team.total}</p>
            <p className="text-[11px] text-muted-foreground">Team Members</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">
              {utilData?.totals.total_tasks_completed ?? '—'}
            </p>
            <p className="text-[11px] text-muted-foreground">Tasks (4 wks)</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">
              {utilData?.totals.avg_on_time_rate != null ? `${utilData.totals.avg_on_time_rate}%` : '—'}
            </p>
            <p className="text-[11px] text-muted-foreground">On-Time Rate</p>
          </div>
        </div>

        {/* Per-member horizontal bars */}
        {utilData && utilData.members.length > 0 ? (
          <div className="space-y-2.5">
            {utilData.members.slice(0, 8).map((member) => {
              const maxTasks = Math.max(...utilData.members.map((m) => m.tasks_completed), 1)
              const barWidth = Math.max((member.tasks_completed / maxTasks) * 100, 2)
              return (
                <div key={member.user_id} className="space-y-1">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-foreground font-medium truncate max-w-[120px]">{member.name}</span>
                    <span className="text-muted-foreground tabular-nums">{member.tasks_completed} tasks</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground text-center">
            {utilData ? 'No utilization data yet. Complete tasks and log time to see metrics.' : 'Loading utilization data...'}
          </p>
        )}
      </div>
    </section>
  )
}

// ─── Strategy Tab ───────────────────────────────────────────────────────────

interface SwotBlock {
  id: string
  name: string
  data: {
    strengths?: string[]
    weaknesses?: string[]
    opportunities?: string[]
    threats?: string[]
    analysis_date?: string
    ai_generated?: boolean
  }
}

interface ValuePropBlock {
  id: string
  name: string
  data: {
    target_audience?: string
    unique_value?: string
    competitive_advantage?: string
    positioning_statement?: string
    proof_points?: string[]
    status?: string
  }
}

const QUADRANT_CONFIG = [
  { key: 'strengths' as const, label: 'Strengths', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800' },
  { key: 'weaknesses' as const, label: 'Weaknesses', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800' },
  { key: 'opportunities' as const, label: 'Opportunities', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800' },
  { key: 'threats' as const, label: 'Threats', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800' },
]

function StrategyTab() {
  const [swots, setSwots] = useState<SwotBlock[]>([])
  const [valueProps, setValueProps] = useState<ValuePropBlock[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [swotRes, vpRes] = await Promise.all([
          fetch('/api/blocks?type=swot_analysis&status=active'),
          fetch('/api/blocks?type=value_proposition&status=active'),
        ])
        if (swotRes.ok) {
          const json = await swotRes.json()
          setSwots((json.data ?? []) as SwotBlock[])
        }
        if (vpRes.ok) {
          const json = await vpRes.json()
          setValueProps((json.data ?? []) as ValuePropBlock[])
        }
      } catch {
        // Non-blocking
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-md border border-border bg-card p-4 h-40" />
          ))}
        </div>
        <div className="rounded-md border border-border bg-card p-4 h-32" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* SWOT Analysis Section */}
      <section aria-labelledby="swot-heading">
        <div className="flex items-center justify-between mb-4">
          <h2 id="swot-heading" className="text-[13px] font-semibold text-foreground flex items-center gap-2">
            <Grid2X2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            SWOT Analysis
          </h2>
          <Link
            href="/blocks?type=swot_analysis"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            New SWOT
          </Link>
        </div>

        {swots.length > 0 ? (
          swots.map((swot) => (
            <div key={swot.id} className="space-y-3 mb-6">
              <div className="flex items-center gap-2 text-[13px]">
                <Link href={`/blocks/${swot.id}`} className="font-medium text-foreground hover:underline">
                  {swot.name}
                </Link>
                {swot.data.ai_generated && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    AI Generated
                  </span>
                )}
                {swot.data.analysis_date && (
                  <span className="text-[11px] text-muted-foreground">{swot.data.analysis_date}</span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {QUADRANT_CONFIG.map((q) => {
                  const items = swot.data[q.key] ?? []
                  return (
                    <div key={q.key} className={`rounded-md border ${q.border} ${q.bg} p-3`}>
                      <h3 className={`text-[12px] font-semibold ${q.color} mb-2`}>{q.label}</h3>
                      {items.length > 0 ? (
                        <ul className="space-y-1">
                          {items.map((item, i) => (
                            <li key={i} className="text-[12px] text-foreground flex items-start gap-1.5">
                              <span className="mt-1.5 h-1 w-1 rounded-full bg-current flex-shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic">No items yet</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-md border border-border bg-card p-6 text-center">
            <Grid2X2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" aria-hidden="true" />
            <p className="text-[13px] text-muted-foreground">No SWOT analyses created yet.</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Create one to map your strengths, weaknesses, opportunities, and threats.
            </p>
          </div>
        )}
      </section>

      {/* Value Propositions Section */}
      <section aria-labelledby="vp-heading">
        <div className="flex items-center justify-between mb-4">
          <h2 id="vp-heading" className="text-[13px] font-semibold text-foreground flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Value Propositions
          </h2>
          <Link
            href="/blocks?type=value_proposition"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            New Value Prop
          </Link>
        </div>

        {valueProps.length > 0 ? (
          <div className="space-y-3">
            {valueProps.map((vp) => (
              <div key={vp.id} className="rounded-md border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <Link href={`/blocks/${vp.id}`} className="text-[13px] font-medium text-foreground hover:underline">
                    {vp.name}
                  </Link>
                  {vp.data.status && (
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                      vp.data.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                      vp.data.status === 'draft' ? 'bg-muted text-muted-foreground' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {vp.data.status}
                    </span>
                  )}
                </div>
                {vp.data.target_audience && (
                  <p className="text-[12px] text-muted-foreground mb-1">
                    <span className="font-medium">For:</span> {vp.data.target_audience}
                  </p>
                )}
                {vp.data.unique_value && (
                  <p className="text-[12px] text-foreground mb-1">{vp.data.unique_value}</p>
                )}
                {vp.data.proof_points && vp.data.proof_points.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {vp.data.proof_points.map((point, i) => (
                      <span key={i} className="text-[11px] bg-muted text-muted-foreground px-2 py-0.5 rounded">
                        {point}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-border bg-card p-6 text-center">
            <Target className="h-8 w-8 text-muted-foreground mx-auto mb-2" aria-hidden="true" />
            <p className="text-[13px] text-muted-foreground">No value propositions defined yet.</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Define your target audience, unique value, and competitive advantage.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}

// ─── Revenue Tab ────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`
  return `$${value.toLocaleString()}`
}

function formatStageName(stage: string): string {
  return stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function RevenueTab() {
  const [revenue, setRevenue] = useState<RevenueData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/org/revenue')
        if (res.ok) {
          const json = await res.json()
          setRevenue(json.data as RevenueData)
        }
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-6 h-20" />
          ))}
        </div>
        <div className="rounded-md border border-border bg-card p-4 h-48" />
      </div>
    )
  }

  if (!revenue || !revenue.summary) {
    return <p className="text-[13px] text-muted-foreground py-8 text-center">Unable to load revenue data.</p>
  }

  const { summary, stage_funnel = [], monthly_forecast = [], solutions = [] } = revenue
  const maxFunnelValue = Math.max(...stage_funnel.map((s) => s.value), 1)
  const maxMonthValue = Math.max(...monthly_forecast.map((m) => m.value), 1)

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-lg font-semibold text-foreground">{formatCurrency(summary.total_pipeline)}</p>
              <p className="text-[12px] text-muted-foreground">Total Pipeline</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <DollarSign className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-lg font-semibold text-foreground">{formatCurrency(summary.weighted_forecast)}</p>
              <p className="text-[12px] text-muted-foreground">Weighted Forecast</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
            <div>
              <p className="text-lg font-semibold text-foreground">{formatCurrency(summary.closed_won)}</p>
              <p className="text-[12px] text-muted-foreground">Closed Won</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <GitBranch className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-lg font-semibold text-foreground">{summary.deal_count}</p>
              <p className="text-[12px] text-muted-foreground">Active Deals</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline funnel by stage */}
        <section aria-labelledby="funnel-heading">
          <h2 id="funnel-heading" className="text-[13px] font-semibold text-foreground mb-3">Pipeline by Stage</h2>
          <div className="rounded-md border border-border bg-card p-4 space-y-3">
            {stage_funnel.length > 0 ? stage_funnel.map((s) => (
              <div key={s.stage} className="space-y-1">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-foreground">{formatStageName(s.stage)}</span>
                  <span className="text-muted-foreground">{formatCurrency(s.value)} ({s.count} deals, {Math.round(s.probability * 100)}%)</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={s.value} aria-valuemin={0} aria-valuemax={maxFunnelValue}>
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(s.value / maxFunnelValue) * 100}%` }} />
                </div>
              </div>
            )) : (
              <p className="text-[13px] text-muted-foreground">No deals in pipeline yet.</p>
            )}
          </div>
        </section>

        {/* Monthly forecast */}
        <section aria-labelledby="forecast-heading">
          <h2 id="forecast-heading" className="text-[13px] font-semibold text-foreground mb-3">Monthly Forecast</h2>
          <div className="rounded-md border border-border bg-card p-4 space-y-3">
            {monthly_forecast.length > 0 ? monthly_forecast.map((m) => (
              <div key={m.month} className="space-y-1">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-foreground">{m.month}</span>
                  <span className="text-muted-foreground">{formatCurrency(m.value)}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={m.value} aria-valuemin={0} aria-valuemax={maxMonthValue}>
                  <div className="h-full rounded-full bg-success transition-all" style={{ width: `${(m.value / maxMonthValue) * 100}%` }} />
                </div>
              </div>
            )) : (
              <p className="text-[13px] text-muted-foreground">No forecast data yet. Add expected close dates to deals.</p>
            )}
          </div>
        </section>
      </div>

      {/* Solutions breakdown */}
      {solutions.length > 0 && (
        <section aria-labelledby="solutions-heading">
          <h2 id="solutions-heading" className="text-[13px] font-semibold text-foreground mb-3">Solution Revenue</h2>
          <div className="rounded-md border border-border bg-card p-4">
            <div className="divide-y divide-border">
              {solutions.map((sol) => (
                <div key={sol.id} className="flex items-center justify-between py-2 text-[13px]">
                  <div>
                    <span className="text-foreground font-medium">{sol.name}</span>
                    <span className="ml-2 text-[11px] text-muted-foreground rounded bg-muted px-1.5 py-0.5">{sol.pricing_model}</span>
                  </div>
                  <span className="text-foreground">{formatCurrency(sol.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <p className="text-[11px] text-muted-foreground italic">
        All values are forecasts derived from deal pipeline probability, solution pricing, and product/service defaults.
      </p>
    </div>
  )
}

// ─── Offerings Tab ──────────────────────────────────────────────────────────

function OfferingsTab({ revenue }: { revenue: RevenueData | null }) {
  const [data, setData] = useState<RevenueData | null>(revenue)
  const [isLoading, setIsLoading] = useState(!revenue)

  useEffect(() => {
    if (data) return
    async function load() {
      try {
        const res = await fetch('/api/org/revenue')
        if (res.ok) {
          const json = await res.json()
          setData(json.data as RevenueData)
        }
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [data])

  if (isLoading) {
    return <div className="animate-pulse rounded-md border border-border bg-card p-4 h-48" />
  }

  if (!data || !data.products) {
    return <p className="text-[13px] text-muted-foreground py-8 text-center">Unable to load offerings data.</p>
  }

  return (
    <div className="space-y-6">
      {/* Products */}
      <section aria-labelledby="products-heading">
        <div className="flex items-center justify-between mb-3">
          <h2 id="products-heading" className="text-[13px] font-semibold text-foreground flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Products
          </h2>
          <Link
            href="/library/blocks?type=product"
            className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            View all
          </Link>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          {data.products.length > 0 ? (
            <div className="divide-y divide-border">
              {data.products.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2.5 text-[13px]">
                  <Link href={`/blocks/${p.id}`} className="text-foreground font-medium hover:underline">{p.name}</Link>
                  <span className="text-muted-foreground">{p.unit_price > 0 ? `${p.currency} ${p.unit_price.toLocaleString()}` : 'No price set'}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground text-center py-4">No products defined yet.</p>
          )}
        </div>
      </section>

      {/* Services */}
      <section aria-labelledby="services-heading">
        <div className="flex items-center justify-between mb-3">
          <h2 id="services-heading" className="text-[13px] font-semibold text-foreground flex items-center gap-2">
            <Wrench className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Services
          </h2>
          <Link
            href="/library/blocks?type=service"
            className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            View all
          </Link>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          {data.services.length > 0 ? (
            <div className="divide-y divide-border">
              {data.services.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2.5 text-[13px]">
                  <Link href={`/blocks/${s.id}`} className="text-foreground font-medium hover:underline">{s.name}</Link>
                  <span className="text-muted-foreground">{s.hourly_rate > 0 ? `${s.currency} ${s.hourly_rate.toLocaleString()}/hr` : 'No rate set'}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground text-center py-4">No services defined yet.</p>
          )}
        </div>
      </section>
    </div>
  )
}

// ─── Details Tab (Organisation Block Fields) ────────────────────────────────

interface OrgBlock {
  id: string
  name: string
  metadata: Record<string, unknown>
}

interface OrgTypeDef {
  id: string
  field_schema: Record<string, unknown>
}

function DetailsTab() {
  const [orgBlock, setOrgBlock] = useState<OrgBlock | null>(null)
  const [typeDef, setTypeDef] = useState<OrgTypeDef | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editValues, setEditValues] = useState<Record<string, unknown>>({})
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [blockRes, typeRes] = await Promise.all([
          fetch('/api/blocks?type=organisation&limit=1'),
          fetch('/api/block-types'),
        ])

        if (blockRes.ok) {
          const json = await blockRes.json()
          const blocks = (json.data ?? []) as OrgBlock[]
          if (blocks.length > 0) {
            setOrgBlock(blocks[0])
            setEditValues(blocks[0].metadata ?? {})
          }
        }

        if (typeRes.ok) {
          const json = await typeRes.json()
          const types = (json.data ?? []) as Array<{ type_name: string; id: string; field_schema: Record<string, unknown> }>
          const orgType = types.find((t) => t.type_name === 'organisation')
          if (orgType) {
            setTypeDef({ id: orgType.id, field_schema: orgType.field_schema })
          }
        }
      } catch {
        // Non-blocking
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const handleChange = useCallback((field: string, value: unknown) => {
    setEditValues((prev) => ({ ...prev, [field]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!orgBlock) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/blocks/${orgBlock.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata: editValues }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error?.message ?? 'Failed to save')
      }
      setOrgBlock((prev) => prev ? { ...prev, metadata: editValues } : prev)
      setEditing(false)
    } catch (e) {
      setSaveError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }, [orgBlock, editValues])

  const handleCancel = useCallback(() => {
    if (orgBlock) setEditValues(orgBlock.metadata ?? {})
    setEditing(false)
    setSaveError(null)
  }, [orgBlock])

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-md border border-border bg-card p-4 h-16" />
        ))}
      </div>
    )
  }

  if (!orgBlock) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
        <p className="text-[13px] text-muted-foreground">
          Organisation profile not yet created. It will be provisioned automatically on next page load.
        </p>
      </div>
    )
  }

  const fieldSchema = typeDef?.field_schema
  const hasSchema = fieldSchema && typeof fieldSchema === 'object' && 'properties' in fieldSchema &&
    Object.keys(fieldSchema.properties as Record<string, unknown>).length > 0

  return (
    <section aria-label="Organisation details">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground">Organisation Profile</h2>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil className="h-3 w-3" aria-hidden="true" />
            Edit
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" aria-hidden="true" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Save className="h-3 w-3" aria-hidden="true" />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {saveError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 mb-4 text-xs text-destructive">
          {saveError}
        </div>
      )}

      {hasSchema ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <DynamicFieldRenderer
            schema={fieldSchema as { type?: string; properties?: Record<string, unknown>; required?: string[] }}
            values={editing ? editValues : (orgBlock.metadata ?? {})}
            editing={editing}
            onChange={handleChange}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-[13px] text-muted-foreground">
            No fields configured yet. Use the chat to add fields: &quot;Add industry and headquarters fields to the organisation&quot;
          </p>
        </div>
      )}
    </section>
  )
}

// ─── Main Page Component ────────────────────────────────────────────────────

export default function OrgOverviewPage() {
  const [data, setData] = useState<OrgOverview | null>(null)
  const [blockHierarchy, setBlockHierarchy] = useState<HierarchyBlock[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [overviewRes, hierarchyRes] = await Promise.all([
        fetch('/api/org/overview'),
        fetch('/api/org/block-hierarchy'),
      ])

      if (!overviewRes.ok) {
        const body = await overviewRes.json().catch(() => null)
        const msg = body?.error?.message ?? `Request failed with status ${overviewRes.status}`
        throw new Error(msg)
      }

      const json = await overviewRes.json()
      setData(json.data as OrgOverview)

      if (hierarchyRes.ok) {
        const hJson = await hierarchyRes.json()
        setBlockHierarchy((hJson.data?.hierarchy ?? []) as HierarchyBlock[])
      }
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-6 text-[13px] text-muted-foreground">
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

      {/* Tabbed content */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-6 w-full overflow-x-auto scrollbar-none justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="structure">Structure</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="strategy">Strategy</TabsTrigger>
          <TabsTrigger value="offerings">Offerings</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          {/* Metric cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
            <MetricCard icon={Boxes} value={data.blocks.total} label="Total Blocks" />
            <MetricCard icon={Users} value={data.team.total} label="Team Size" />
            <MetricCard icon={GitBranch} value={data.workflows.active} label="Active Workflows" />
            <MetricCard icon={CheckCircle2} value={data.workflows.completed} label="Completed Workflows" />
          </div>

          <div className="space-y-8">
            <RevenueSnapshot />
            <HierarchySection hierarchy={data.hierarchy} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <BlocksSection blocks={data.blocks} />
              <RecentActivitySection events={data.recent_events} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TeamUtilization team={data.team} />
            </div>
          </div>
        </TabsContent>

        {/* Structure Tab */}
        <TabsContent value="structure">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[13px] font-semibold text-foreground">Organisation Structure</h2>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  Divisions, departments, and teams that make up your org hierarchy.
                </p>
              </div>
            </div>
            <BlockHierarchySection hierarchy={blockHierarchy} />
          </div>
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details">
          <DetailsTab />
        </TabsContent>

        {/* Revenue Tab */}
        <TabsContent value="revenue">
          <RevenueTab />
        </TabsContent>

        {/* Strategy Tab */}
        <TabsContent value="strategy">
          <StrategyTab />
        </TabsContent>

        {/* Offerings Tab */}
        <TabsContent value="offerings">
          <OfferingsTab revenue={null} />
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team">
          <div className="space-y-6">
            <TeamSection team={data.team} />
            <div className="flex justify-end">
              <Link
                href="/settings/team"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Settings className="h-4 w-4" aria-hidden="true" />
                Manage Team
              </Link>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}
