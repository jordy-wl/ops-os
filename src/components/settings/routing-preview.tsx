'use client'

/**
 * RoutingPreview — displays 3 sample scenarios with routing decisions
 * based on the current policy config, to help admins understand the effect
 * of their configuration changes before saving.
 *
 * Uses a simplified client-side version of makeRoutingDecision logic.
 */

import type {
  PolicyRoutingConfig,
  RiskLevel,
  RiskRoutingEntry,
} from '@/lib/routing/types'

interface RoutingPreviewProps {
  config: PolicyRoutingConfig
}

interface Scenario {
  label: string
  riskLevel: RiskLevel
  confidence: number
}

const SCENARIOS: Scenario[] = [
  { label: 'Low-risk data entry', riskLevel: 'low', confidence: 0.9 },
  { label: 'Medium-risk approval', riskLevel: 'medium', confidence: 0.6 },
  { label: 'High-risk compliance review', riskLevel: 'high', confidence: 0.3 },
]

interface PreviewDecision {
  route: 'Human' | 'Agent' | 'Approval Chain'
  reason: string
}

const ROUTE_STYLES: Record<PreviewDecision['route'], string> = {
  Human:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  Agent:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  'Approval Chain':
    'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
}

/**
 * Simplified client-side routing decision that mirrors the server engine
 * for preview purposes. Does not include step-level overrides since this
 * is purely a policy-level preview.
 */
function previewDecision(
  config: PolicyRoutingConfig,
  scenario: Scenario
): PreviewDecision {
  const { riskLevel, confidence } = scenario

  // 1. Check risk routing map
  const riskEntry: RiskRoutingEntry | undefined =
    config.risk_routing_map[riskLevel]
  if (riskEntry) {
    if (riskEntry.mode === 'human_only') {
      return {
        route: 'Human',
        reason: `Risk "${riskLevel}" is configured for Human Only routing.`,
      }
    }
    if (riskEntry.mode === 'escalation_chain') {
      return {
        route: 'Approval Chain',
        reason: `Risk "${riskLevel}" requires escalation chain.`,
      }
    }
    // ai_only or hybrid: check confidence against risk threshold
    if (confidence >= riskEntry.threshold) {
      return {
        route: 'Agent',
        reason: `Confidence ${confidence.toFixed(2)} meets the ${riskLevel}-risk threshold of ${riskEntry.threshold.toFixed(2)}.`,
      }
    }
    return {
      route: 'Human',
      reason: `Confidence ${confidence.toFixed(2)} is below the ${riskLevel}-risk threshold of ${riskEntry.threshold.toFixed(2)}.`,
    }
  }

  // 2. Fall back to policy-level confidence threshold
  if (
    config.routing_mode === 'ai_only' ||
    config.routing_mode === 'hybrid'
  ) {
    if (confidence >= config.confidence_threshold) {
      return {
        route: 'Agent',
        reason: `Confidence ${confidence.toFixed(2)} meets the global threshold of ${config.confidence_threshold.toFixed(2)}.`,
      }
    }
    return {
      route: 'Human',
      reason: `Confidence ${confidence.toFixed(2)} is below the global threshold of ${config.confidence_threshold.toFixed(2)}.`,
    }
  }

  if (config.routing_mode === 'escalation_chain') {
    return {
      route: 'Approval Chain',
      reason: 'Policy routing mode is escalation chain.',
    }
  }

  // 3. Default: human_only
  return {
    route: 'Human',
    reason: `Policy routing mode is "${config.routing_mode}".`,
  }
}

export function RoutingPreview({ config }: RoutingPreviewProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground">
        Preview
      </label>
      <p className="text-xs text-muted-foreground mb-3">
        See how the current configuration affects routing decisions for sample scenarios.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {SCENARIOS.map((scenario) => {
          const decision = previewDecision(config, scenario)
          return (
            <div
              key={scenario.label}
              className="rounded-lg border border-input p-4 space-y-2"
            >
              <div className="text-sm font-medium text-foreground">
                {scenario.label}
              </div>
              <div className="text-xs text-muted-foreground">
                Confidence: {scenario.confidence.toFixed(1)} | Risk:{' '}
                <span className="capitalize">{scenario.riskLevel}</span>
              </div>
              <div className="pt-1">
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${ROUTE_STYLES[decision.route]}`}
                >
                  {decision.route}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{decision.reason}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
