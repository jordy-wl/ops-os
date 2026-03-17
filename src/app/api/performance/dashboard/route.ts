import { NextRequest } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError } from '@/lib/api/responses'

/**
 * GET /api/performance/dashboard
 *
 * Returns personal performance data for the authenticated user:
 * - Last N weekly snapshots (default 8)
 * - Current week live stats (not yet snapshotted)
 * - Team averages for comparison
 */
async function handler(req: NextRequest, ctx: AuthContext) {
  const url = new URL(req.url)
  const weeks = Math.min(parseInt(url.searchParams.get('weeks') ?? '8', 10), 52)

  const supabase = createServerClient()

  try {
    // Fetch user's snapshots
    const { data: snapshots, error: snapErr } = await supabase
      .from('performance_snapshots')
      .select('*')
      .eq('org_id', ctx.orgId)
      .eq('user_id', ctx.userId)
      .order('period_start', { ascending: false })
      .limit(weeks)

    if (snapErr) {
      return apiError('Failed to fetch snapshots', 'performance/query-failed', 500)
    }

    // Compute team averages for the same periods
    const periodStarts = (snapshots ?? []).map((s) => s.period_start)
    let teamAverages: Record<string, unknown>[] = []

    if (periodStarts.length > 0) {
      const { data: teamSnaps } = await supabase
        .from('performance_snapshots')
        .select('period_start, tasks_completed, tasks_on_time, tasks_overdue, total_time_seconds, billable_time_seconds')
        .eq('org_id', ctx.orgId)
        .in('period_start', periodStarts)

      // Group by period and compute averages
      const grouped = new Map<string, { tasks: number[]; time: number[]; onTime: number[]; billable: number[] }>()
      for (const snap of teamSnaps ?? []) {
        const key = snap.period_start
        if (!grouped.has(key)) {
          grouped.set(key, { tasks: [], time: [], onTime: [], billable: [] })
        }
        const g = grouped.get(key)!
        g.tasks.push(snap.tasks_completed)
        g.time.push(snap.total_time_seconds)
        g.onTime.push(snap.tasks_on_time)
        g.billable.push(snap.billable_time_seconds)
      }

      teamAverages = Array.from(grouped.entries()).map(([period, g]) => ({
        period_start: period,
        avg_tasks_completed: Math.round(g.tasks.reduce((a, b) => a + b, 0) / g.tasks.length),
        avg_total_time_seconds: Math.round(g.time.reduce((a, b) => a + b, 0) / g.time.length),
        avg_tasks_on_time: Math.round(g.onTime.reduce((a, b) => a + b, 0) / g.onTime.length),
        avg_billable_time_seconds: Math.round(g.billable.reduce((a, b) => a + b, 0) / g.billable.length),
        team_size: g.tasks.length,
      }))
    }

    // Live stats for current week (not yet snapshotted)
    const now = new Date()
    const dayOfWeek = (now.getUTCDay() + 6) % 7
    const weekStart = new Date(now)
    weekStart.setUTCDate(now.getUTCDate() - dayOfWeek)
    weekStart.setUTCHours(0, 0, 0, 0)

    const [timeRes, tasksRes] = await Promise.all([
      supabase
        .from('time_entries')
        .select('duration_seconds, is_billable')
        .eq('org_id', ctx.orgId)
        .eq('user_id', ctx.userId)
        .gte('started_at', weekStart.toISOString())
        .not('ended_at', 'is', null),
      supabase
        .from('blocks')
        .select('id, metadata, updated_at')
        .eq('org_id', ctx.orgId)
        .eq('type', 'task_queue_item')
        .gte('updated_at', weekStart.toISOString()),
    ])

    const currentWeekTime = (timeRes.data ?? []).reduce((s, e) => s + (e.duration_seconds ?? 0), 0)
    const currentWeekBillable = (timeRes.data ?? [])
      .filter((e) => e.is_billable)
      .reduce((s, e) => s + (e.duration_seconds ?? 0), 0)
    const currentWeekTasks = (tasksRes.data ?? []).filter((t) => {
      const meta = (t.metadata ?? {}) as Record<string, unknown>
      return meta.assigned_to === ctx.userId && meta.status === 'completed'
    }).length

    return ok({
      snapshots: (snapshots ?? []).reverse(), // chronological order
      team_averages: teamAverages,
      current_week: {
        period_start: weekStart.toISOString().slice(0, 10),
        tasks_completed: currentWeekTasks,
        total_time_seconds: currentWeekTime,
        billable_time_seconds: currentWeekBillable,
      },
      snapshot_count: (snapshots ?? []).length,
    })
  } catch {
    return apiError('Failed to load dashboard', 'performance/dashboard-failed', 500)
  }
}

export const GET = withAuth(handler)
