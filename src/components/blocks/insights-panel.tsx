'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { DeltaProgressBar } from './delta-progress-bar'
import { RiskIndicators } from './risk-indicators'
import type { DeltaResult } from '@/lib/ai/delta-types'

interface InsightsData {
  delta: DeltaResult
  insights: {
    whatsDone: string[]
    whatsNext: string[]
    whatsAtRisk: string[]
    recommendations: string[]
  } | null
}

interface InsightsPanelProps {
  blockId: string
}

const POLL_INTERVAL_MS = 30_000

/**
 * InsightsPanel — right-side panel on block detail pages for workflow_instance blocks.
 * Shows delta visualization, risk indicators, and AI-generated insights.
 * Auto-refreshes every 30 seconds.
 */
export function InsightsPanel({ blockId }: InsightsPanelProps) {
  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const fetchInsights = useCallback(async () => {
    try {
      const res = await fetch(`/api/blocks/${blockId}/insights`)
      if (!res.ok) {
        if (res.status === 404) {
          setData(null)
          setLoading(false)
          return
        }
        throw new Error(`Failed to fetch insights: ${res.status}`)
      }
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load insights')
    } finally {
      setLoading(false)
    }
  }, [blockId])

  useEffect(() => {
    fetchInsights()
    const interval = setInterval(fetchInsights, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchInsights])

  const toggleSection = (section: string) => {
    setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  if (loading) {
    return (
      <div className="rounded-lg border p-4 space-y-3 animate-pulse">
        <div className="h-4 bg-muted rounded w-32" />
        <div className="h-2 bg-muted rounded" />
        <div className="h-2 bg-muted rounded w-3/4" />
        <div className="h-2 bg-muted rounded w-1/2" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-800 p-4">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    )
  }

  if (!data) return null

  const { delta, insights } = data

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Workflow Insights</h3>

      {/* Progress bar */}
      <DeltaProgressBar
        steps={delta.timelineDeltas}
        currentStepIndex={delta.currentStepIndex}
      />

      {/* Risk indicators */}
      <RiskIndicators
        gapAnalysis={delta.gapAnalysis}
        healthScore={delta.healthScore.score}
      />

      {/* Collapsible sections */}
      <div className="space-y-2">
        <InsightSection
          title="What's Done"
          items={insights?.whatsDone ?? delta.completedSteps.map(
            (s) => `${s.stepName.replace(/_/g, ' ')} — ${s.actualDurationHours ?? '?'}h`
          )}
          collapsed={collapsed['done'] ?? false}
          onToggle={() => toggleSection('done')}
          emptyText="No steps completed yet"
        />

        <InsightSection
          title="What's Next"
          items={insights?.whatsNext ?? delta.remainingSteps.map(
            (s) => `${s.stepName.replace(/_/g, ' ')} (expected ${s.expectedDurationHours}h)`
          )}
          collapsed={collapsed['next'] ?? false}
          onToggle={() => toggleSection('next')}
          emptyText="All steps completed"
        />

        <InsightSection
          title="What's at Risk"
          items={insights?.whatsAtRisk ?? buildRiskItems(delta)}
          collapsed={collapsed['risk'] ?? false}
          onToggle={() => toggleSection('risk')}
          emptyText="No risks detected"
          variant="warning"
        />

        <InsightSection
          title="Recommendations"
          items={insights?.recommendations ?? []}
          collapsed={collapsed['recs'] ?? true}
          onToggle={() => toggleSection('recs')}
          emptyText="No recommendations"
          variant="info"
        />
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface InsightSectionProps {
  title: string
  items: string[]
  collapsed: boolean
  onToggle: () => void
  emptyText: string
  variant?: 'default' | 'warning' | 'info'
}

function InsightSection({
  title,
  items,
  collapsed,
  onToggle,
  emptyText,
  variant = 'default',
}: InsightSectionProps) {
  const variantClasses = {
    default: '',
    warning: items.length > 0 ? 'border-l-2 border-l-amber-400 pl-2' : '',
    info: items.length > 0 ? 'border-l-2 border-l-blue-400 pl-2' : '',
  }

  return (
    <div className={cn('rounded', variantClasses[variant])}>
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full text-left py-1.5 text-sm font-medium text-foreground hover:text-foreground/80 transition-colors"
        aria-expanded={!collapsed}
      >
        <span>{title}</span>
        <span className="text-xs text-muted-foreground">
          {collapsed ? '▸' : '▾'} {items.length}
        </span>
      </button>

      {!collapsed && (
        <ul className="space-y-1 pb-2">
          {items.length === 0 ? (
            <li className="text-xs text-muted-foreground italic">{emptyText}</li>
          ) : (
            items.map((item, i) => (
              <li key={i} className="text-xs text-muted-foreground leading-relaxed">
                • {item}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildRiskItems(delta: DeltaResult): string[] {
  const items: string[] = []

  for (const step of delta.gapAnalysis.overdueSteps) {
    items.push(`"${step.stepName.replace(/_/g, ' ')}" is overdue by ${Math.round(step.overdueByHours)}h`)
  }
  for (const step of delta.gapAnalysis.skippedSteps) {
    items.push(`"${step.stepName.replace(/_/g, ' ')}" was skipped`)
  }
  if (delta.healthScore.score < 50) {
    items.push(`Workflow health is critical at ${delta.healthScore.score}/100`)
  }

  return items
}
