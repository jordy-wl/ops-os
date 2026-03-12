/**
 * Routing Decision Engine — determines whether a workflow task should be
 * handled by a human, an AI agent, or routed through an approval chain.
 *
 * Decision priority:
 * 1. Step-level routing_mode override (absolute priority)
 * 2. Policy risk_routing_map (matches riskLevel → mode + threshold)
 * 3. Policy confidence_threshold vs. confidenceScore
 * 4. Policy default routing_mode
 * 5. Hardcoded fallback: human
 */

import type {
  RoutingInput,
  RoutingDecision,
  RoutingMode,
  PolicyRoutingConfig,
  RiskRoutingEntry,
} from './types'

/**
 * Make a routing decision given step config, policy, and AI confidence.
 */
export function makeRoutingDecision(input: RoutingInput): RoutingDecision {
  const { stepConfig, policy, confidenceScore, riskLevel, context: _context } = input
  const score = confidenceScore ?? 0

  // ── 1. Step-level override (absolute priority) ───────────────────────────
  if (stepConfig.routing_mode && stepConfig.routing_mode !== 'policy_default') {
    const route = modeToRoute(stepConfig.routing_mode as RoutingMode)
    return {
      route,
      reason: `Step-level override: routing_mode="${stepConfig.routing_mode}"`,
      confidence: score,
      policyApplied: false,
      requiredPermissions: stepConfig.required_permissions ?? [],
      ...(route === 'approval_chain' && policy
        ? { escalationPath: buildEscalationPath(policy) }
        : {}),
    }
  }

  // ── 2. No policy → fallback to human ─────────────────────────────────────
  if (!policy) {
    return {
      route: 'human',
      reason: 'No routing policy found — defaulting to human',
      confidence: score,
      policyApplied: false,
      requiredPermissions: stepConfig.required_permissions ?? [],
    }
  }

  // ── 3. Risk-based routing (risk_routing_map) ─────────────────────────────
  if (riskLevel && policy.risk_routing_map[riskLevel]) {
    const riskEntry: RiskRoutingEntry = policy.risk_routing_map[riskLevel]
    const route = resolveRiskRoute(riskEntry, score)
    return {
      route,
      reason: `Risk-based routing: risk="${riskLevel}", threshold=${riskEntry.threshold}, confidence=${score}`,
      confidence: score,
      policyApplied: true,
      requiredPermissions: stepConfig.required_permissions ?? [],
      ...(route === 'approval_chain' ? { escalationPath: buildEscalationPath(policy) } : {}),
    }
  }

  // ── 4. Confidence threshold vs. policy default mode ──────────────────────
  if (policy.routing_mode === 'ai_only' || policy.routing_mode === 'hybrid') {
    if (score >= policy.confidence_threshold) {
      return {
        route: 'agent',
        reason: `Confidence ${score} >= threshold ${policy.confidence_threshold} — routed to agent`,
        confidence: score,
        policyApplied: true,
        requiredPermissions: stepConfig.required_permissions ?? [],
      }
    }
    return {
      route: 'human',
      reason: `Confidence ${score} < threshold ${policy.confidence_threshold} — routed to human`,
      confidence: score,
      policyApplied: true,
      requiredPermissions: stepConfig.required_permissions ?? [],
    }
  }

  // ── 5. Escalation chain ──────────────────────────────────────────────────
  if (policy.routing_mode === 'escalation_chain') {
    return {
      route: 'approval_chain',
      reason: 'Policy routing_mode is escalation_chain',
      confidence: score,
      policyApplied: true,
      requiredPermissions: stepConfig.required_permissions ?? [],
      escalationPath: buildEscalationPath(policy),
    }
  }

  // ── 6. Policy says human_only ────────────────────────────────────────────
  return {
    route: 'human',
    reason: `Policy routing_mode="${policy.routing_mode}" — routed to human`,
    confidence: score,
    policyApplied: true,
    requiredPermissions: stepConfig.required_permissions ?? [],
  }
}

/** Map a RoutingMode to a RoutingDecision route. */
function modeToRoute(mode: RoutingMode): RoutingDecision['route'] {
  switch (mode) {
    case 'ai_only':
      return 'agent'
    case 'hybrid':
      return 'agent'
    case 'escalation_chain':
      return 'approval_chain'
    case 'human_only':
    default:
      return 'human'
  }
}

/** Resolve a risk routing entry: if confidence >= risk threshold → agent, else human. */
function resolveRiskRoute(entry: RiskRoutingEntry, confidence: number): RoutingDecision['route'] {
  if (entry.mode === 'escalation_chain') return 'approval_chain'
  if (entry.mode === 'human_only') return 'human'
  // For ai_only or hybrid: check if confidence meets the risk-specific threshold
  return confidence >= entry.threshold ? 'agent' : 'human'
}

/** Build an ordered escalation path from the policy's approval_chain. */
function buildEscalationPath(policy: PolicyRoutingConfig): string[] {
  return [...policy.approval_chain]
    .sort((a, b) => a.order - b.order)
    .map((entry) => entry.role)
}
