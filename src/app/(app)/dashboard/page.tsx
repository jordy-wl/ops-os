import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardClient } from '@/components/dashboard/dashboard-client'
import { logger } from '@/lib/logger'
import type { DashboardSummary } from '@/app/api/dashboard/summary/route'

/**
 * DashboardPage — server component that fetches the initial dashboard summary
 * directly from Supabase (avoids an extra HTTP round-trip on first paint).
 *
 * Passes pre-fetched data to DashboardClient which handles 30-second polling
 * for subsequent refreshes via GET /api/dashboard/summary.
 */
export default async function DashboardPage() {
  const { userId, orgId } = await auth()

  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/org-setup')

  const supabase = createServerClient()
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [blocksRes, activeJobsRes, eventsCountRes, recentEventsRes] = await Promise.all([
    supabase.from('blocks').select('type').eq('org_id', orgId),
    supabase
      .from('workflow_jobs')
      .select('id')
      .eq('org_id', orgId)
      .in('status', ['pending', 'running']),
    supabase.from('events').select('id').eq('org_id', orgId).gte('occurred_at', since24h),
    supabase
      .from('events')
      .select('id, type, actor_type, occurred_at, block_id')
      .eq('org_id', orgId)
      .order('occurred_at', { ascending: false })
      .limit(20),
  ])

  const queryError =
    blocksRes.error ?? activeJobsRes.error ?? eventsCountRes.error ?? recentEventsRes.error

  if (queryError) {
    logger.error('dashboard-page', 'db.query_failed', {
      error_code: queryError.code,
      org_id: orgId,
    })
    // Render client with no initial data — it will fetch on mount
    return <DashboardClient initialData={null} />
  }

  // Tally block counts by type
  const blockCounts: DashboardSummary['block_counts'] = {
    client: 0,
    deal: 0,
    project: 0,
    contract: 0,
    contact: 0,
    total: 0,
  }
  for (const block of blocksRes.data ?? []) {
    if (block.type in blockCounts) {
      ;(blockCounts as Record<string, number>)[block.type] += 1
    }
    blockCounts.total += 1
  }

  // Resolve block names for recent events
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
      .eq('org_id', orgId)
    for (const b of blockNames ?? []) {
      blockNameMap.set(b.id, b.name)
    }
  }

  const initialData: DashboardSummary = {
    block_counts: blockCounts,
    active_workflow_jobs: activeJobsRes.data?.length ?? 0,
    events_last_24h: eventsCountRes.data?.length ?? 0,
    recent_events: (recentEventsRes.data ?? []).map((e) => ({
      id: e.id,
      type: e.type,
      block_name: e.block_id ? (blockNameMap.get(e.block_id) ?? null) : null,
      block_id: e.block_id ?? null,
      occurred_at: e.occurred_at,
      actor_type: e.actor_type,
    })),
  }

  return <DashboardClient initialData={initialData} />
}
