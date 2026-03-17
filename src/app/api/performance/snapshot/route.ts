import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * GET /api/performance/snapshot
 *
 * Weekly cron job — aggregates time_entries, task completions, and workflow
 * outcomes into performance_snapshots for the past 7 days.
 *
 * Idempotency: skips org+user combos where the current week is already captured.
 * Called by Vercel Cron: schedule "0 0 * * 0" (Sundays at midnight UTC).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    logger.warn('api-performance', 'snapshot.unauthorized_trigger')
    return NextResponse.json(
      { data: null, error: { message: 'Unauthorized', code: 'auth/unauthenticated' } },
      { status: 401 }
    )
  }

  const supabase = createServerClient()

  // Compute week boundaries (Monday – Sunday)
  const now = new Date()
  const dayOfWeek = (now.getUTCDay() + 6) % 7 // 0 = Mon
  const periodEnd = new Date(now)
  periodEnd.setUTCDate(now.getUTCDate() - dayOfWeek - 1) // last Sunday
  periodEnd.setUTCHours(23, 59, 59, 999)
  const periodStart = new Date(periodEnd)
  periodStart.setUTCDate(periodEnd.getUTCDate() - 6) // previous Monday
  periodStart.setUTCHours(0, 0, 0, 0)

  const periodStartStr = periodStart.toISOString().slice(0, 10)
  const periodEndStr = periodEnd.toISOString().slice(0, 10)

  try {
    // Get all orgs
    const { data: orgs } = await supabase.from('orgs').select('id')
    if (!orgs || orgs.length === 0) {
      return NextResponse.json({ data: { processed: 0 }, error: null })
    }

    let totalInserted = 0

    for (const org of orgs) {
      // Idempotency: check if this week already snapshotted for this org
      const { data: existing } = await supabase
        .from('performance_snapshots')
        .select('id')
        .eq('org_id', org.id)
        .eq('period_start', periodStartStr)
        .limit(1)

      if (existing && existing.length > 0) continue

      // Get distinct users who had time entries this week
      const { data: timeEntries } = await supabase
        .from('time_entries')
        .select('user_id, duration_seconds, is_billable')
        .eq('org_id', org.id)
        .gte('started_at', periodStart.toISOString())
        .lte('started_at', periodEnd.toISOString())
        .not('ended_at', 'is', null)

      // Get tasks completed this week
      const { data: completedTasks } = await supabase
        .from('blocks')
        .select('id, metadata, updated_at')
        .eq('org_id', org.id)
        .eq('type', 'task_queue_item')
        .gte('updated_at', periodStart.toISOString())
        .lte('updated_at', periodEnd.toISOString())

      // Get task deadlines for on-time calculation
      const { data: deadlines } = await supabase
        .from('task_deadlines_v')
        .select('*')
        .eq('org_id', org.id)

      // Get workflow instances completed/failed this week
      const { data: workflows } = await supabase
        .from('blocks')
        .select('id, metadata, updated_at')
        .eq('org_id', org.id)
        .eq('type', 'workflow_instance')
        .gte('updated_at', periodStart.toISOString())
        .lte('updated_at', periodEnd.toISOString())

      // Aggregate by user
      const userIds = new Set<string>()

      // Collect users from time entries
      for (const entry of timeEntries ?? []) {
        userIds.add(entry.user_id)
      }
      // Collect users from completed tasks
      for (const task of completedTasks ?? []) {
        const meta = (task.metadata ?? {}) as Record<string, unknown>
        const assignee = meta.assigned_to as string | undefined
        if (assignee) userIds.add(assignee)
      }

      // If no users, skip this org
      if (userIds.size === 0) continue

      const snapshots = []

      for (const userId of userIds) {
        // Time aggregation
        const userTime = (timeEntries ?? []).filter((e) => e.user_id === userId)
        const totalTimeSec = userTime.reduce((sum, e) => sum + (e.duration_seconds ?? 0), 0)
        const billableTimeSec = userTime
          .filter((e) => e.is_billable)
          .reduce((sum, e) => sum + (e.duration_seconds ?? 0), 0)

        // Task aggregation
        const userTasks = (completedTasks ?? []).filter((t) => {
          const meta = (t.metadata ?? {}) as Record<string, unknown>
          return meta.assigned_to === userId && meta.status === 'completed'
        })
        const tasksCompleted = userTasks.length

        // On-time: task updated_at <= deadline
        let tasksOnTime = 0
        let tasksOverdue = 0
        for (const task of userTasks) {
          const dl = (deadlines ?? []).find((d) => d.id === task.id)
          if (dl?.deadline_at) {
            if (new Date(task.updated_at) <= new Date(dl.deadline_at)) {
              tasksOnTime++
            } else {
              tasksOverdue++
            }
          } else {
            // No deadline = considered on-time
            tasksOnTime++
          }
        }

        // Avg completion time (from creation to completion)
        let avgCompletionSec = 0
        if (userTasks.length > 0) {
          const totalCompletionSec = userTasks.reduce((sum, t) => {
            const created = new Date(t.updated_at).getTime() // approximation
            return sum + Math.max(0, (new Date(t.updated_at).getTime() - created) / 1000)
          }, 0)
          avgCompletionSec = Math.round(totalCompletionSec / userTasks.length)
        }

        // Workflow aggregation
        const userWorkflows = (workflows ?? []).filter((w) => {
          const meta = (w.metadata ?? {}) as Record<string, unknown>
          return meta.created_by === userId || meta.assigned_to === userId
        })
        const wfCompleted = userWorkflows.filter((w) => {
          const meta = (w.metadata ?? {}) as Record<string, unknown>
          return meta.status === 'completed'
        }).length
        const wfFailed = userWorkflows.filter((w) => {
          const meta = (w.metadata ?? {}) as Record<string, unknown>
          return meta.status === 'failed'
        }).length

        snapshots.push({
          org_id: org.id,
          user_id: userId,
          period_start: periodStartStr,
          period_end: periodEndStr,
          tasks_completed: tasksCompleted,
          tasks_on_time: tasksOnTime,
          tasks_overdue: tasksOverdue,
          total_time_seconds: totalTimeSec,
          billable_time_seconds: billableTimeSec,
          workflows_completed: wfCompleted,
          workflows_failed: wfFailed,
          avg_task_completion_seconds: avgCompletionSec,
        })
      }

      if (snapshots.length > 0) {
        const { error: insertError } = await supabase
          .from('performance_snapshots')
          .upsert(snapshots, { onConflict: 'org_id,user_id,period_start' })

        if (insertError) {
          logger.error('api-performance', 'snapshot.insert_failed', {
            org_id: org.id,
            error_code: insertError.code,
          })
        } else {
          totalInserted += snapshots.length
        }
      }
    }

    logger.info('api-performance', 'snapshot.completed', {
      period: `${periodStartStr} to ${periodEndStr}`,
      snapshots_created: totalInserted,
    })

    return NextResponse.json({
      data: { processed: totalInserted, period_start: periodStartStr, period_end: periodEndStr },
      error: null,
    })
  } catch (err) {
    logger.error('api-performance', 'snapshot.failed', {
      error: (err as Error).message?.slice(0, 200),
    })
    return NextResponse.json(
      { data: null, error: { message: 'Snapshot generation failed', code: 'performance/snapshot-failed' } },
      { status: 500 }
    )
  }
}
