import { NextRequest } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError } from '@/lib/api/responses'

/**
 * GET /api/performance/team
 *
 * Returns team utilization data for the org overview page:
 * - Per-member stats: tasks assigned, tasks completed, time logged
 * - Overall team summary
 * - Last 4 weeks of aggregate data
 */
async function handler(req: NextRequest, ctx: AuthContext) {
  const url = new URL(req.url)
  const weeks = Math.min(parseInt(url.searchParams.get('weeks') ?? '4', 10), 12)

  const supabase = createServerClient()

  try {
    // Get snapshots for the last N weeks
    const cutoff = new Date()
    cutoff.setUTCDate(cutoff.getUTCDate() - weeks * 7)

    const { data: snapshots, error: snapErr } = await supabase
      .from('performance_snapshots')
      .select('*')
      .eq('org_id', ctx.orgId)
      .gte('period_start', cutoff.toISOString().slice(0, 10))
      .order('period_start', { ascending: true })

    if (snapErr) {
      return apiError('Failed to fetch team data', 'performance/query-failed', 500)
    }

    // Group by user
    const byUser = new Map<string, {
      tasks_completed: number
      tasks_on_time: number
      tasks_overdue: number
      total_time_seconds: number
      billable_time_seconds: number
      workflows_completed: number
      workflows_failed: number
      weeks_active: number
    }>()

    for (const snap of snapshots ?? []) {
      if (!byUser.has(snap.user_id)) {
        byUser.set(snap.user_id, {
          tasks_completed: 0,
          tasks_on_time: 0,
          tasks_overdue: 0,
          total_time_seconds: 0,
          billable_time_seconds: 0,
          workflows_completed: 0,
          workflows_failed: 0,
          weeks_active: 0,
        })
      }
      const u = byUser.get(snap.user_id)!
      u.tasks_completed += snap.tasks_completed
      u.tasks_on_time += snap.tasks_on_time
      u.tasks_overdue += snap.tasks_overdue
      u.total_time_seconds += snap.total_time_seconds
      u.billable_time_seconds += snap.billable_time_seconds
      u.workflows_completed += snap.workflows_completed
      u.workflows_failed += snap.workflows_failed
      u.weeks_active++
    }

    // Get team member names from blocks
    const { data: teamMembers } = await supabase
      .from('blocks')
      .select('id, name, metadata')
      .eq('org_id', ctx.orgId)
      .eq('type', 'team_member')

    // Map clerk user IDs to names
    const nameMap = new Map<string, string>()
    for (const member of teamMembers ?? []) {
      const meta = (member.metadata ?? {}) as Record<string, unknown>
      const clerkId = meta.clerk_user_id as string | undefined
      if (clerkId) nameMap.set(clerkId, member.name)
    }

    const members = Array.from(byUser.entries()).map(([userId, stats]) => ({
      user_id: userId,
      name: nameMap.get(userId) ?? userId.slice(0, 8),
      ...stats,
      on_time_rate: stats.tasks_completed > 0
        ? Math.round((stats.tasks_on_time / stats.tasks_completed) * 100)
        : 100,
      billable_rate: stats.total_time_seconds > 0
        ? Math.round((stats.billable_time_seconds / stats.total_time_seconds) * 100)
        : 0,
    }))

    // Sort by tasks completed descending
    members.sort((a, b) => b.tasks_completed - a.tasks_completed)

    // Team totals
    const totals = {
      total_members: members.length,
      total_tasks_completed: members.reduce((s, m) => s + m.tasks_completed, 0),
      total_time_seconds: members.reduce((s, m) => s + m.total_time_seconds, 0),
      total_billable_seconds: members.reduce((s, m) => s + m.billable_time_seconds, 0),
      avg_on_time_rate: members.length > 0
        ? Math.round(members.reduce((s, m) => s + m.on_time_rate, 0) / members.length)
        : 100,
    }

    return ok({ members, totals, weeks_covered: weeks })
  } catch {
    return apiError('Failed to load team utilization', 'performance/team-failed', 500)
  }
}

export const GET = withAuth(handler)
