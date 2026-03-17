'use client'

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

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

interface PerformanceChartsProps {
  snapshots: Snapshot[]
  teamAverages: TeamAverage[]
}

function formatWeekLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })
}

function formatHours(seconds: number): string {
  return `${(seconds / 3600).toFixed(1)}h`
}

export function PerformanceCharts({ snapshots, teamAverages }: PerformanceChartsProps) {
  // Build chart data by merging user snapshots with team averages
  const teamMap = new Map(teamAverages.map((t) => [t.period_start, t]))

  const taskData = snapshots.map((snap) => {
    const team = teamMap.get(snap.period_start)
    return {
      week: formatWeekLabel(snap.period_start),
      completed: snap.tasks_completed,
      on_time: snap.tasks_on_time,
      overdue: snap.tasks_overdue,
      team_avg: team?.avg_tasks_completed ?? 0,
    }
  })

  const timeData = snapshots.map((snap) => {
    const team = teamMap.get(snap.period_start)
    return {
      week: formatWeekLabel(snap.period_start),
      hours: +(snap.total_time_seconds / 3600).toFixed(1),
      billable_hours: +(snap.billable_time_seconds / 3600).toFixed(1),
      team_avg_hours: team ? +(team.avg_total_time_seconds / 3600).toFixed(1) : 0,
    }
  })

  const onTimeData = snapshots.map((snap) => {
    const rate = snap.tasks_completed > 0
      ? Math.round((snap.tasks_on_time / snap.tasks_completed) * 100)
      : 100
    const team = teamMap.get(snap.period_start)
    const teamRate = team && team.avg_tasks_completed > 0
      ? Math.round((team.avg_tasks_on_time / team.avg_tasks_completed) * 100)
      : 100
    return {
      week: formatWeekLabel(snap.period_start),
      rate,
      team_rate: teamRate,
    }
  })

  return (
    <div className="space-y-6">
      {/* Task Completion Trend */}
      <div>
        <h3 className="text-[13px] font-semibold text-foreground mb-3">Task Completion</h3>
        <div className="rounded-lg border border-border bg-card p-4">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={taskData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="completed" name="Completed" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
              <Bar dataKey="overdue" name="Overdue" fill="hsl(var(--destructive))" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Time Logged Trend */}
      <div>
        <h3 className="text-[13px] font-semibold text-foreground mb-3">Time Logged</h3>
        <div className="rounded-lg border border-border bg-card p-4">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={timeData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                tickFormatter={formatHours}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
                formatter={(value) => [`${value}h`, '']}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Area
                type="monotone"
                dataKey="hours"
                name="Total Hours"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.1}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="billable_hours"
                name="Billable Hours"
                stroke="hsl(142, 71%, 45%)"
                fill="hsl(142, 71%, 45%)"
                fillOpacity={0.1}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="team_avg_hours"
                name="Team Average"
                stroke="hsl(var(--muted-foreground))"
                fill="none"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* On-Time Rate Trend */}
      <div>
        <h3 className="text-[13px] font-semibold text-foreground mb-3">On-Time Rate</h3>
        <div className="rounded-lg border border-border bg-card p-4">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={onTimeData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
                formatter={(value) => [`${value}%`, '']}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Area
                type="monotone"
                dataKey="rate"
                name="Your Rate"
                stroke="hsl(217, 91%, 60%)"
                fill="hsl(217, 91%, 60%)"
                fillOpacity={0.1}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="team_rate"
                name="Team Average"
                stroke="hsl(var(--muted-foreground))"
                fill="none"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
