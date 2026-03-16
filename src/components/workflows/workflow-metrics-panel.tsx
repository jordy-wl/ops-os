'use client'

import { useEffect, useState } from 'react'
import { BarChart3, Clock, CheckCircle, XCircle, TrendingUp, Activity, Lightbulb, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetricsData {
  template_id: string
  template_name: string
  period_days: number
  total_runs: number
  completed: number
  failed: number
  running: number
  pending: number
  success_rate: number | null
  avg_completion_seconds: number | null
  median_completion_seconds: number | null
  daily_runs: { date: string; count: number; completed: number; failed: number }[]
  bottleneck_steps: { step: string; avg_duration_ms: number; executions: number }[]
}

interface WorkflowMetricsPanelProps {
  templateId: string
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  return `${(seconds / 3600).toFixed(1)}h`
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={cn('flex h-6 w-6 items-center justify-center rounded', color)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-xl font-semibold text-foreground">{value}</p>
    </div>
  )
}

export function WorkflowMetricsPanel({ templateId }: WorkflowMetricsPanelProps) {
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const res = await fetch(`/api/workflow-templates/${templateId}/metrics?days=30`)
        if (!res.ok) {
          setError('Failed to load metrics')
          return
        }
        const { data } = await res.json()
        setMetrics(data)
      } catch {
        setError('Failed to load metrics')
      } finally {
        setLoading(false)
      }
    }
    fetchMetrics()
  }, [templateId])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-lg border border-border bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !metrics) {
    return (
      <div className="rounded-md border border-destructive/20 bg-destructive/5 p-4 text-center">
        <p className="text-sm text-destructive">{error ?? 'No metrics available'}</p>
      </div>
    )
  }

  const maxDailyCount = Math.max(...metrics.daily_runs.map((d) => d.count), 1)

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Runs"
          value={metrics.total_runs}
          icon={BarChart3}
          color="text-primary bg-primary/10"
        />
        <StatCard
          label="Success Rate"
          value={metrics.success_rate !== null ? `${metrics.success_rate}%` : '—'}
          icon={TrendingUp}
          color="text-success bg-success/10"
        />
        <StatCard
          label="Avg Time"
          value={metrics.avg_completion_seconds !== null ? formatDuration(metrics.avg_completion_seconds) : '—'}
          icon={Clock}
          color="text-warning bg-warning/10"
        />
        <StatCard
          label="Active"
          value={metrics.running + metrics.pending}
          icon={Activity}
          color="text-blue-500 bg-blue-500/10"
        />
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
          <CheckCircle className="h-3.5 w-3.5 text-success" />
          <span className="text-xs text-muted-foreground">Completed</span>
          <span className="ml-auto text-sm font-medium text-foreground">{metrics.completed}</span>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
          <XCircle className="h-3.5 w-3.5 text-destructive" />
          <span className="text-xs text-muted-foreground">Failed</span>
          <span className="ml-auto text-sm font-medium text-foreground">{metrics.failed}</span>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
          <Activity className="h-3.5 w-3.5 text-blue-500" />
          <span className="text-xs text-muted-foreground">Running</span>
          <span className="ml-auto text-sm font-medium text-foreground">{metrics.running}</span>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Pending</span>
          <span className="ml-auto text-sm font-medium text-foreground">{metrics.pending}</span>
        </div>
      </div>

      {/* Daily runs bar chart */}
      {metrics.daily_runs.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Daily Runs (Last 30 Days)
          </h4>
          <div className="flex items-end gap-1 h-24">
            {metrics.daily_runs.map((day) => (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-0.5" title={`${day.date}: ${day.count} runs`}>
                <div className="w-full flex flex-col-reverse">
                  <div
                    className="w-full rounded-t bg-primary/80"
                    style={{ height: `${(day.completed / maxDailyCount) * 80}px` }}
                  />
                  {day.failed > 0 && (
                    <div
                      className="w-full bg-destructive/60"
                      style={{ height: `${(day.failed / maxDailyCount) * 80}px` }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>{metrics.daily_runs[0]?.date?.slice(5)}</span>
            <span>{metrics.daily_runs[metrics.daily_runs.length - 1]?.date?.slice(5)}</span>
          </div>
        </div>
      )}

      {/* Bottleneck steps */}
      {metrics.bottleneck_steps.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Slowest Steps
          </h4>
          <div className="space-y-2">
            {metrics.bottleneck_steps.map((step) => {
              const maxMs = metrics.bottleneck_steps[0].avg_duration_ms
              const pct = maxMs > 0 ? (step.avg_duration_ms / maxMs) * 100 : 0
              return (
                <div key={step.step} className="flex items-center gap-3">
                  <span className="text-xs text-foreground font-medium w-36 truncate" title={step.step}>
                    {step.step}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-warning"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-16 text-right">
                    {formatDuration(step.avg_duration_ms / 1000)}
                  </span>
                  <span className="text-[10px] text-muted-foreground w-10 text-right">
                    {step.executions}x
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {metrics.total_runs === 0 && (
        <div className="text-center py-8">
          <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No workflow runs yet</p>
          <p className="text-xs text-muted-foreground">Metrics will appear once workflows start executing.</p>
        </div>
      )}

      {/* AI Optimization Suggestions */}
      <OptimizationSuggestions templateId={templateId} />
    </div>
  )
}

// ─── Optimization Suggestions Sub-Component ──────────────────────────────────

interface Suggestion {
  type: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  step_name?: string
  evidence: string
}

const SEVERITY_STYLES: Record<string, { border: string; bg: string; icon: React.ElementType; iconColor: string }> = {
  critical: { border: 'border-destructive/30', bg: 'bg-destructive/5', icon: AlertTriangle, iconColor: 'text-destructive' },
  warning: { border: 'border-warning/30', bg: 'bg-warning/5', icon: AlertTriangle, iconColor: 'text-warning' },
  info: { border: 'border-primary/20', bg: 'bg-primary/5', icon: Info, iconColor: 'text-primary' },
}

function OptimizationSuggestions({ templateId }: { templateId: string }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSuggestions() {
      try {
        const res = await fetch(`/api/workflow-templates/${templateId}/optimize`)
        if (!res.ok) return
        const { data } = await res.json()
        setSuggestions(data?.suggestions ?? [])
      } catch {
        // non-critical
      } finally {
        setLoading(false)
      }
    }
    fetchSuggestions()
  }, [templateId])

  if (loading) {
    return (
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          AI Suggestions
        </h4>
        <div className="h-16 rounded-md bg-muted animate-pulse" />
      </div>
    )
  }

  if (suggestions.length === 0) {
    return (
      <div className="rounded-md border border-success/20 bg-success/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-success" />
          <p className="text-sm text-success font-medium">No optimization issues found</p>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          This workflow is running efficiently based on recent execution data.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Lightbulb className="h-3.5 w-3.5" />
        AI Optimization Suggestions
      </h4>
      <div className="space-y-2">
        {suggestions.map((s, i) => {
          const style = SEVERITY_STYLES[s.severity] ?? SEVERITY_STYLES.info
          const SeverityIcon = style.icon
          return (
            <div key={i} className={cn('rounded-md border px-4 py-3', style.border, style.bg)}>
              <div className="flex items-start gap-2">
                <SeverityIcon className={cn('h-4 w-4 mt-0.5 shrink-0', style.iconColor)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{s.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 italic">{s.evidence}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
