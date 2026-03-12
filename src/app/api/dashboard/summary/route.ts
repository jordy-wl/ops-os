import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

export type RecentEvent = {
  id: string
  type: string
  block_name: string | null
  block_id: string | null
  occurred_at: string
  actor_type: string
}

export type DashboardSummary = {
  block_counts: {
    client: number
    deal: number
    project: number
    contract: number
    contact: number
    solution: number
    product: number
    service: number
    team_member: number
    policy: number
    total: number
  }
  active_workflow_jobs: number
  events_last_24h: number
  recent_events: RecentEvent[]
}

/**
 * GET /api/dashboard/summary
 *
 * Returns an org-level operational snapshot for the dashboard:
 *   - Block counts by type (+ total)
 *   - Active workflow job count (pending + running)
 *   - Event count in the last 24 hours
 *   - Last 20 events across all blocks (with block name resolved)
 *
 * All queries are org-scoped via ctx.orgId from the Clerk JWT.
 */
export const GET = withAuth(async (_req: NextRequest, ctx) => {
  const supabase = createServerClient()
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Run all queries in parallel — independent of each other
  const [blocksRes, activeJobsRes, eventsCountRes, recentEventsRes] = await Promise.all([
    supabase
      .from('blocks')
      .select('type')
      .eq('org_id', ctx.orgId),

    supabase
      .from('workflow_jobs')
      .select('id')
      .eq('org_id', ctx.orgId)
      .in('status', ['pending', 'running']),

    supabase
      .from('events')
      .select('id')
      .eq('org_id', ctx.orgId)
      .gte('occurred_at', since24h),

    supabase
      .from('events')
      .select('id, type, actor_type, occurred_at, block_id')
      .eq('org_id', ctx.orgId)
      .order('occurred_at', { ascending: false })
      .limit(20),
  ])

  const queryError =
    blocksRes.error ?? activeJobsRes.error ?? eventsCountRes.error ?? recentEventsRes.error

  if (queryError) {
    logger.error('api-dashboard', 'db.query_failed', {
      error_code: queryError.code,
      org_id: ctx.orgId,
    })
    return apiError('Failed to load dashboard data', 'db/query-failed', 500)
  }

  // Tally block counts by type
  const blockCounts: DashboardSummary['block_counts'] = {
    client: 0,
    deal: 0,
    project: 0,
    contract: 0,
    contact: 0,
    solution: 0,
    product: 0,
    service: 0,
    team_member: 0,
    policy: 0,
    total: 0,
  }
  for (const block of blocksRes.data ?? []) {
    if (block.type in blockCounts) {
      ;(blockCounts as Record<string, number>)[block.type] += 1
    }
    blockCounts.total += 1
  }

  // Resolve block names for the recent events (second query — non-critical)
  const blockIds = [
    ...new Set(
      (recentEventsRes.data ?? [])
        .map((e) => e.block_id)
        .filter((id): id is string => typeof id === 'string')
    ),
  ]

  const blockNameMap = new Map<string, string>()
  if (blockIds.length > 0) {
    const { data: blockNames } = await supabase
      .from('blocks')
      .select('id, name')
      .in('id', blockIds)
      .eq('org_id', ctx.orgId)
    for (const b of blockNames ?? []) {
      blockNameMap.set(b.id, b.name)
    }
  }

  const recent_events: RecentEvent[] = (recentEventsRes.data ?? []).map((e) => ({
    id: e.id,
    type: e.type,
    block_name: e.block_id ? (blockNameMap.get(e.block_id) ?? null) : null,
    block_id: e.block_id ?? null,
    occurred_at: e.occurred_at,
    actor_type: e.actor_type,
  }))

  logger.info('api-dashboard', 'dashboard.summary.fetched', { org_id: ctx.orgId })

  return ok({
    block_counts: blockCounts,
    active_workflow_jobs: activeJobsRes.data?.length ?? 0,
    events_last_24h: eventsCountRes.data?.length ?? 0,
    recent_events,
  } satisfies DashboardSummary)
})
