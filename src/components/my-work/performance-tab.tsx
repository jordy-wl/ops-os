'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Clock, Target, DollarSign, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PerformanceCharts } from './performance-charts'

interface Snapshot {
  period_start: string
  period_end: string
  tasks_completed: number
  tasks_on_time: number
  tasks_overdue: number
  total_time_seconds: number
  billable_time_seconds: number
  workflows_completed: number
  workflows_failed: number
  avg_task_completion_seconds: number
}

interface TeamAverage {
  period_start: string
  avg_tasks_completed: number
  avg_total_time_seconds: number
  avg_tasks_on_time: number
  avg_billable_time_seconds: number
  team_size: number
}

interface CurrentWeek {
  period_start: string
  tasks_completed: number
  total_time_seconds: number
  billable_time_seconds: number
}

interface DashboardData {
  snapshots: Snapshot[]
  team_averages: TeamAverage[]
  current_week: CurrentWeek
  snapshot_count: number
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return '0h'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  subValue?: string
  color?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('h-4 w-4', color ?? 'text-muted-foreground')} />
        <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="text-xl font-semibold text-foreground">{value}</p>
      {subValue && <p className="text-[11px] text-muted-foreground mt-0.5">{subValue}</p>}
    </div>
  )
}

// ─── Collecting Data Empty State (FE-04) ─────────────────────────────────────

function CollectingDataState({ snapshotCount }: { snapshotCount: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <TrendingUp className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-[15px] font-semibold text-foreground mb-1">Collecting Performance Data</h3>
      <p className="text-[13px] text-muted-foreground mb-4 max-w-sm">
        {snapshotCount === 0
          ? 'Performance trends require at least 2 weeks of data. Track your time and complete tasks to start building your performance profile.'
          : 'One week of data collected. Trend charts will appear after the second weekly snapshot.'}
      </p>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className={cn(
            'w-3 h-3 rounded-full',
            snapshotCount >= 1 ? 'bg-primary' : 'bg-muted-foreground/30'
          )} />
          <span className="text-[11px] text-muted-foreground">Week 1</span>
        </div>
        <div className="w-4 h-px bg-border" />
        <div className="flex items-center gap-1.5">
          <div className={cn(
            'w-3 h-3 rounded-full',
            snapshotCount >= 2 ? 'bg-primary' : 'bg-muted-foreground/30'
          )} />
          <span className="text-[11px] text-muted-foreground">Week 2</span>
        </div>
        <div className="w-4 h-px bg-border" />
        <div className="flex items-center gap-1.5">
          <div className={cn(
            'w-3 h-3 rounded-full bg-muted-foreground/30'
          )} />
          <span className="text-[11px] text-muted-foreground">Full Dashboard</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main Performance Tab ────────────────────────────────────────────────────

export function PerformanceTab() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/performance/dashboard?weeks=8')
      if (res.ok) {
        const json = await res.json()
        setData(json.data)
      }
    } catch {
      // Non-critical
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[13px] text-muted-foreground">
        Loading performance data...
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-10 text-[13px] text-muted-foreground">
        Failed to load performance data.
      </div>
    )
  }

  // Show collecting data state if < 2 snapshots
  if (data.snapshot_count < 2) {
    return <CollectingDataState snapshotCount={data.snapshot_count} />
  }

  // Compute aggregate stats from all snapshots + current week
  const allTasks = data.snapshots.reduce((s, snap) => s + snap.tasks_completed, 0) + data.current_week.tasks_completed
  const allOnTime = data.snapshots.reduce((s, snap) => s + snap.tasks_on_time, 0)
  const allOverdue = data.snapshots.reduce((s, snap) => s + snap.tasks_overdue, 0)
  const totalHistTasks = data.snapshots.reduce((s, snap) => s + snap.tasks_completed, 0)
  const onTimeRate = totalHistTasks > 0 ? Math.round((allOnTime / totalHistTasks) * 100) : 100
  const allTimeSec = data.snapshots.reduce((s, snap) => s + snap.total_time_seconds, 0) + data.current_week.total_time_seconds
  const billableSec = data.snapshots.reduce((s, snap) => s + snap.billable_time_seconds, 0) + data.current_week.billable_time_seconds
  const billableRate = allTimeSec > 0 ? Math.round((billableSec / allTimeSec) * 100) : 0

  return (
    <div className="p-4 space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={CheckCircle2}
          label="Tasks Completed"
          value={allTasks}
          subValue={`${data.current_week.tasks_completed} this week`}
          color="text-green-500"
        />
        <StatCard
          icon={Target}
          label="On-Time Rate"
          value={`${onTimeRate}%`}
          subValue={`${allOverdue} overdue across ${data.snapshot_count} weeks`}
          color="text-blue-500"
        />
        <StatCard
          icon={Clock}
          label="Time Logged"
          value={formatDuration(allTimeSec)}
          subValue={`${formatDuration(data.current_week.total_time_seconds)} this week`}
          color="text-primary"
        />
        <StatCard
          icon={DollarSign}
          label="Billable Rate"
          value={`${billableRate}%`}
          subValue={`${formatDuration(billableSec)} billable`}
          color="text-orange-500"
        />
      </div>

      {/* Trend Charts */}
      <PerformanceCharts
        snapshots={data.snapshots}
        teamAverages={data.team_averages}
      />
    </div>
  )
}
