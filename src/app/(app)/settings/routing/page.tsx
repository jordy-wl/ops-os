'use client'

/**
 * Routing Policy Settings Page — allows org admins to configure
 * the routing decision engine: default mode, confidence threshold,
 * and per-risk-level routing rules.
 *
 * Loads current policy via GET /api/settings/routing on mount.
 * Saves via PUT /api/settings/routing.
 */

import { useState, useEffect, useCallback } from 'react'
import { ConfidenceSlider } from '@/components/settings/confidence-slider'
import { RiskMatrix } from '@/components/settings/risk-matrix'
import { RoutingPreview } from '@/components/settings/routing-preview'
import type {
  RoutingMode,
  PolicyRoutingConfig,
  RiskRoutingEntry,
} from '@/lib/routing/types'
import { ROUTING_MODES } from '@/lib/routing/types'

/** Labels for the routing mode selector. */
const MODE_LABELS: Record<RoutingMode, string> = {
  human_only: 'Human Only',
  ai_only: 'AI Only',
  hybrid: 'Hybrid',
  escalation_chain: 'Escalation Chain',
}

/** Description text for each routing mode. */
const MODE_DESCRIPTIONS: Record<RoutingMode, string> = {
  human_only: 'All tasks are routed to human operators.',
  ai_only: 'Tasks are routed to AI agents when confidence meets the threshold.',
  hybrid: 'AI handles tasks above the confidence threshold; humans handle the rest.',
  escalation_chain: 'Tasks follow an approval chain before being actioned.',
}

/** Default risk routing map used when the API returns an empty map. */
const DEFAULT_RISK_MAP: Record<string, RiskRoutingEntry> = {
  low: { mode: 'ai_only', threshold: 0.7 },
  medium: { mode: 'hybrid', threshold: 0.8 },
  high: { mode: 'human_only', threshold: 0.9 },
  critical: { mode: 'human_only', threshold: 1.0 },
}

function ensureFullRiskMap(
  map: Record<string, RiskRoutingEntry> | undefined
): Record<string, RiskRoutingEntry> {
  const base = { ...DEFAULT_RISK_MAP }
  if (!map) return base
  for (const key of Object.keys(base)) {
    if (map[key]) {
      base[key] = map[key]
    }
  }
  return base
}

export default function RoutingSettingsPage() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [routingMode, setRoutingMode] = useState<RoutingMode>('human_only')
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.8)
  const [riskRoutingMap, setRiskRoutingMap] = useState<
    Record<string, RiskRoutingEntry>
  >(DEFAULT_RISK_MAP)
  const [maxAiAttempts, setMaxAiAttempts] = useState(3)

  // ── Load ───────────────────────────────────────────────────────────────────
  const loadPolicy = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/settings/routing')
      if (!res.ok) {
        throw new Error(`Failed to load routing policy (${res.status})`)
      }
      const json = await res.json()
      const data = json.data as PolicyRoutingConfig & { policy_id: string | null }

      setRoutingMode(data.routing_mode)
      setConfidenceThreshold(data.confidence_threshold)
      setRiskRoutingMap(ensureFullRiskMap(data.risk_routing_map))
      setMaxAiAttempts(data.max_ai_attempts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load policy')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPolicy()
  }, [loadPolicy])

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const body = {
        routing_mode: routingMode,
        confidence_threshold: confidenceThreshold,
        risk_routing_map: riskRoutingMap,
        approval_chain: [],
        fallback_routing: 'human_only' as const,
        max_ai_attempts: maxAiAttempts,
      }

      const res = await fetch('/api/settings/routing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(
          json.error?.message ?? `Save failed (${res.status})`
        )
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save policy')
    } finally {
      setSaving(false)
    }
  }, [routingMode, confidenceThreshold, riskRoutingMap, maxAiAttempts])

  // ── Build preview config ───────────────────────────────────────────────────
  const previewConfig: PolicyRoutingConfig = {
    routing_mode: routingMode,
    confidence_threshold: confidenceThreshold,
    risk_routing_map: riskRoutingMap,
    approval_chain: [],
    fallback_routing: 'human_only',
    max_ai_attempts: maxAiAttempts,
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div>
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground">
            Routing Policies
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure confidence thresholds and risk-based routing for task
            assignments.
          </p>
        </div>
        <div
          className="flex items-center justify-center py-12"
          role="status"
          aria-label="Loading routing policy"
        >
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
          <span className="sr-only">Loading routing policy...</span>
        </div>
      </div>
    )
  }

  // ── Error state (failed to load) ──────────────────────────────────────────
  if (error && !saving) {
    // If we have data loaded (error from save), show inline error.
    // If we never loaded, show full-page error with retry.
    if (loading === false && routingMode === 'human_only' && confidenceThreshold === 0.8) {
      // Likely a load failure — show retry
    }
  }

  // ── Main content ──────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Routing Policies
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure confidence thresholds and risk-based routing for task
            assignments.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        >
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save Policy'}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div
          className="mb-6 rounded-md bg-destructive/5 border border-destructive/20 px-4 py-3 text-[13px] text-destructive flex items-center justify-between"
          role="alert"
        >
          <span>{error}</span>
          <button
            onClick={loadPolicy}
            className="ml-4 text-sm font-medium underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Retry
          </button>
        </div>
      )}

      <div className="space-y-8">
        {/* Section 1: Default Routing Mode */}
        <section>
          <h3 className="text-sm font-medium text-foreground mb-3">
            Default Routing Mode
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {ROUTING_MODES.map((mode) => {
              const isSelected = routingMode === mode
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setRoutingMode(mode)}
                  aria-pressed={isSelected}
                  className={`rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isSelected
                      ? 'border-primary bg-primary/5 dark:bg-primary/10'
                      : 'border-input hover:border-primary/50 hover:bg-muted/50'
                  }`}
                >
                  <div className="text-sm font-medium text-foreground">
                    {MODE_LABELS[mode]}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {MODE_DESCRIPTIONS[mode]}
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* Section 2: Confidence Threshold */}
        <section>
          <ConfidenceSlider
            value={confidenceThreshold}
            onChange={setConfidenceThreshold}
          />
        </section>

        {/* Section 3: Risk Matrix */}
        <section>
          <RiskMatrix
            value={riskRoutingMap}
            onChange={setRiskRoutingMap}
          />
        </section>

        {/* Section 4: Max AI Attempts */}
        <section>
          <div className="max-w-xs">
            <label
              htmlFor="max-ai-attempts"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Max AI Attempts
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Maximum times AI can retry a task before escalating to a human.
            </p>
            <input
              id="max-ai-attempts"
              type="number"
              min={1}
              max={10}
              value={maxAiAttempts}
              onChange={(e) =>
                setMaxAiAttempts(
                  Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1))
                )
              }
              className="w-20 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground font-mono tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </section>

        {/* Section 5: Preview */}
        <section className="border-t border-input pt-6">
          <RoutingPreview config={previewConfig} />
        </section>
      </div>
    </div>
  )
}
