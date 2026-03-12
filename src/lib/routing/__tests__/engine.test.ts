import { describe, it, expect } from 'vitest'
import { makeRoutingDecision } from '../engine'
import type { RoutingInput, PolicyRoutingConfig } from '../types'

// ─── Helpers ────────────────────────────────────────────────────────────────────

const defaultContext: RoutingInput['context'] = {
  orgId: '00000000-0000-0000-0000-000000000001',
  workflowInstanceId: '00000000-0000-0000-0000-000000000002',
  stepIndex: 0,
}

const hybridPolicy: PolicyRoutingConfig = {
  routing_mode: 'hybrid',
  confidence_threshold: 0.85,
  risk_routing_map: {
    low: { mode: 'ai_only', threshold: 0.7 },
    medium: { mode: 'hybrid', threshold: 0.9 },
    high: { mode: 'human_only', threshold: 1.0 },
    critical: { mode: 'escalation_chain', threshold: 1.0 },
  },
  approval_chain: [
    { role: 'ops-admin', order: 1, required: true },
    { role: 'compliance-approver', order: 2, required: true },
  ],
  fallback_routing: 'human_only',
  max_ai_attempts: 3,
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('makeRoutingDecision', () => {
  // ── Step-level overrides ──────────────────────────────────────────────────

  it('step-level human_only override takes absolute priority', () => {
    const result = makeRoutingDecision({
      stepConfig: { routing_mode: 'human_only' },
      policy: hybridPolicy,
      confidenceScore: 1.0,
      context: defaultContext,
    })

    expect(result.route).toBe('human')
    expect(result.reason).toContain('Step-level override')
    expect(result.policyApplied).toBe(false)
  })

  it('step-level ai_only override routes to agent regardless of policy', () => {
    const result = makeRoutingDecision({
      stepConfig: { routing_mode: 'ai_only' },
      policy: { ...hybridPolicy, routing_mode: 'human_only' },
      confidenceScore: 0.1,
      context: defaultContext,
    })

    expect(result.route).toBe('agent')
    expect(result.policyApplied).toBe(false)
  })

  it('step-level escalation_chain override builds approval path', () => {
    const result = makeRoutingDecision({
      stepConfig: { routing_mode: 'escalation_chain' },
      policy: hybridPolicy,
      confidenceScore: 0.5,
      context: defaultContext,
    })

    expect(result.route).toBe('approval_chain')
    expect(result.escalationPath).toEqual(['ops-admin', 'compliance-approver'])
  })

  it('policy_default routing_mode defers to policy (not treated as override)', () => {
    const result = makeRoutingDecision({
      stepConfig: { routing_mode: 'policy_default' },
      policy: hybridPolicy,
      confidenceScore: 0.95,
      context: defaultContext,
    })

    // Should use policy, not step override
    expect(result.policyApplied).toBe(true)
    expect(result.route).toBe('agent')
  })

  // ── No policy fallback ────────────────────────────────────────────────────

  it('returns human when no policy exists', () => {
    const result = makeRoutingDecision({
      stepConfig: {},
      policy: null,
      confidenceScore: 1.0,
      context: defaultContext,
    })

    expect(result.route).toBe('human')
    expect(result.reason).toContain('No routing policy')
    expect(result.policyApplied).toBe(false)
  })

  // ── Risk-based routing ────────────────────────────────────────────────────

  it('low risk + high confidence routes to agent', () => {
    const result = makeRoutingDecision({
      stepConfig: {},
      policy: hybridPolicy,
      confidenceScore: 0.8,
      riskLevel: 'low',
      context: defaultContext,
    })

    expect(result.route).toBe('agent')
    expect(result.reason).toContain('Risk-based')
    expect(result.reason).toContain('risk="low"')
  })

  it('low risk + low confidence routes to human', () => {
    const result = makeRoutingDecision({
      stepConfig: {},
      policy: hybridPolicy,
      confidenceScore: 0.5,
      riskLevel: 'low',
      context: defaultContext,
    })

    expect(result.route).toBe('human')
  })

  it('high risk always routes to human regardless of confidence', () => {
    const result = makeRoutingDecision({
      stepConfig: {},
      policy: hybridPolicy,
      confidenceScore: 1.0,
      riskLevel: 'high',
      context: defaultContext,
    })

    expect(result.route).toBe('human')
  })

  it('critical risk triggers escalation chain', () => {
    const result = makeRoutingDecision({
      stepConfig: {},
      policy: hybridPolicy,
      confidenceScore: 1.0,
      riskLevel: 'critical',
      context: defaultContext,
    })

    expect(result.route).toBe('approval_chain')
    expect(result.escalationPath).toEqual(['ops-admin', 'compliance-approver'])
  })

  // ── Confidence threshold routing ──────────────────────────────────────────

  it('hybrid policy routes to agent when confidence >= threshold', () => {
    const result = makeRoutingDecision({
      stepConfig: {},
      policy: hybridPolicy,
      confidenceScore: 0.85,
      context: defaultContext,
    })

    expect(result.route).toBe('agent')
    expect(result.reason).toContain('>= threshold')
  })

  it('hybrid policy routes to human when confidence < threshold', () => {
    const result = makeRoutingDecision({
      stepConfig: {},
      policy: hybridPolicy,
      confidenceScore: 0.84,
      context: defaultContext,
    })

    expect(result.route).toBe('human')
    expect(result.reason).toContain('< threshold')
  })

  // ── Policy routing modes ──────────────────────────────────────────────────

  it('human_only policy always routes to human', () => {
    const result = makeRoutingDecision({
      stepConfig: {},
      policy: { ...hybridPolicy, routing_mode: 'human_only' },
      confidenceScore: 1.0,
      context: defaultContext,
    })

    expect(result.route).toBe('human')
    expect(result.policyApplied).toBe(true)
  })

  it('escalation_chain policy routes to approval_chain', () => {
    const result = makeRoutingDecision({
      stepConfig: {},
      policy: { ...hybridPolicy, routing_mode: 'escalation_chain' },
      confidenceScore: 1.0,
      context: defaultContext,
    })

    expect(result.route).toBe('approval_chain')
    expect(result.escalationPath).toEqual(['ops-admin', 'compliance-approver'])
  })

  // ── Required permissions ──────────────────────────────────────────────────

  it('passes required_permissions through from step config', () => {
    const result = makeRoutingDecision({
      stepConfig: { required_permissions: ['approve_tasks', 'manage_blocks'] },
      policy: hybridPolicy,
      confidenceScore: 0.9,
      context: defaultContext,
    })

    expect(result.requiredPermissions).toEqual(['approve_tasks', 'manage_blocks'])
  })

  it('defaults to empty required_permissions when not specified', () => {
    const result = makeRoutingDecision({
      stepConfig: {},
      policy: hybridPolicy,
      confidenceScore: 0.9,
      context: defaultContext,
    })

    expect(result.requiredPermissions).toEqual([])
  })

  // ── Edge cases ────────────────────────────────────────────────────────────

  it('handles missing confidence score (defaults to 0)', () => {
    const result = makeRoutingDecision({
      stepConfig: {},
      policy: hybridPolicy,
      context: defaultContext,
    })

    expect(result.route).toBe('human')
    expect(result.confidence).toBe(0)
  })

  it('handles unknown risk level by falling through to confidence check', () => {
    const result = makeRoutingDecision({
      stepConfig: {},
      policy: hybridPolicy,
      confidenceScore: 0.9,
      riskLevel: 'unknown_level',
      context: defaultContext,
    })

    // unknown_level not in risk_routing_map, falls through to confidence check
    expect(result.route).toBe('agent')
    expect(result.policyApplied).toBe(true)
  })

  it('approval chain is sorted by order', () => {
    const reverseChainPolicy: PolicyRoutingConfig = {
      ...hybridPolicy,
      routing_mode: 'escalation_chain',
      approval_chain: [
        { role: 'cfo', order: 3, required: false },
        { role: 'ops-admin', order: 1, required: true },
        { role: 'manager', order: 2, required: true },
      ],
    }

    const result = makeRoutingDecision({
      stepConfig: {},
      policy: reverseChainPolicy,
      context: defaultContext,
    })

    expect(result.escalationPath).toEqual(['ops-admin', 'manager', 'cfo'])
  })
})
