import { describe, it, expect } from 'vitest'
import { makeRoutingDecision } from '../engine'
import { extractRoutingConfig, DEFAULT_ROUTING } from '../policy'
import { buildTaskEnrichment } from '@/lib/workflow/task-enrichment'
import type { PolicyRoutingConfig, RoutingInput, RiskLevel } from '../types'

// ─── Integration: Policy → Engine → Task Enrichment ──────────────────────────

describe('routing integration: policy → engine → task enrichment', () => {
  const basePolicy: PolicyRoutingConfig = {
    routing_mode: 'hybrid',
    confidence_threshold: 0.7,
    risk_routing_map: {
      low: { mode: 'ai_only', threshold: 0.5 },
      medium: { mode: 'hybrid', threshold: 0.7 },
      high: { mode: 'human_only', threshold: 1.0 },
      critical: { mode: 'human_only', threshold: 1.0 },
    },
    approval_chain: [
      { role: 'ops-admin', order: 1, required: true },
      { role: 'compliance-approver', order: 2, required: true },
    ],
    fallback_routing: 'human_only',
    max_ai_attempts: 3,
  }

  it('routes low-risk high-confidence task to agent and enriches metadata', () => {
    const input: RoutingInput = {
      stepConfig: { instructions: 'Send welcome email to new client' },
      policy: basePolicy,
      confidenceScore: 0.9,
      riskLevel: 'low' as RiskLevel,
      context: { orgId: 'org-1', workflowInstanceId: 'wf-1', stepIndex: 0 },
    }

    const decision = makeRoutingDecision(input)
    expect(decision.route).toBe('agent')
    expect(decision.policyApplied).toBe(true)

    const enriched = buildTaskEnrichment({
      routingDecision: decision,
      inputData: { client_id: 'c1', email: 'test@example.com' },
      instructions: input.stepConfig.instructions,
    })

    expect(enriched.routing_decision).toBe('agent')
    expect(enriched.confidence_score).toBe(0.9)
    expect(enriched.instructions).toBe('Send welcome email to new client')
    expect(enriched.input_data).toEqual({ client_id: 'c1', email: 'test@example.com' })
  })

  it('routes high-risk task to human regardless of confidence', () => {
    const input: RoutingInput = {
      stepConfig: {},
      policy: basePolicy,
      confidenceScore: 0.99,
      riskLevel: 'high' as RiskLevel,
      context: { orgId: 'org-1', workflowInstanceId: 'wf-1', stepIndex: 1 },
    }

    const decision = makeRoutingDecision(input)
    expect(decision.route).toBe('human')
    expect(decision.reason).toContain('risk')

    const enriched = buildTaskEnrichment({ routingDecision: decision })
    expect(enriched.routing_decision).toBe('human')
  })

  it('step override bypasses policy entirely', () => {
    const input: RoutingInput = {
      stepConfig: { routing_mode: 'human_only' },
      policy: { ...basePolicy, routing_mode: 'ai_only', confidence_threshold: 0.1 },
      confidenceScore: 0.99,
      riskLevel: 'low' as RiskLevel,
      context: { orgId: 'org-1', workflowInstanceId: 'wf-1', stepIndex: 2 },
    }

    const decision = makeRoutingDecision(input)
    expect(decision.route).toBe('human')
    expect(decision.policyApplied).toBe(false)
  })

  it('below-threshold confidence routes to human in hybrid mode', () => {
    const input: RoutingInput = {
      stepConfig: {},
      policy: basePolicy,
      confidenceScore: 0.3,
      riskLevel: 'medium' as RiskLevel,
      context: { orgId: 'org-1', workflowInstanceId: 'wf-1', stepIndex: 3 },
    }

    const decision = makeRoutingDecision(input)
    expect(decision.route).toBe('human')

    const enriched = buildTaskEnrichment({ routingDecision: decision })
    expect(enriched.routing_decision).toBe('human')
    expect(enriched.confidence_score).toBe(0.3)
  })

  it('escalation chain produces approval path', () => {
    const escalationPolicy: PolicyRoutingConfig = {
      ...basePolicy,
      routing_mode: 'escalation_chain',
    }

    const input: RoutingInput = {
      stepConfig: {},
      policy: escalationPolicy,
      confidenceScore: 0.8,
      context: { orgId: 'org-1', workflowInstanceId: 'wf-1', stepIndex: 4 },
    }

    const decision = makeRoutingDecision(input)
    expect(decision.route).toBe('approval_chain')
    expect(decision.escalationPath).toEqual(['ops-admin', 'compliance-approver'])
  })
})

// ─── Policy extraction from block metadata ───────────────────────────────────

describe('extractRoutingConfig edge cases', () => {
  it('extracts complete config from well-formed metadata', () => {
    const meta = {
      routing_mode: 'hybrid',
      confidence_threshold: 0.65,
      risk_routing_map: { low: { mode: 'ai_only', threshold: 0.5 } },
      approval_chain: [{ role: 'admin', order: 1 }],
      fallback_routing: 'human_only',
      max_ai_attempts: 5,
    }

    const config = extractRoutingConfig(meta)
    expect(config.routing_mode).toBe('hybrid')
    expect(config.confidence_threshold).toBe(0.65)
    expect(config.max_ai_attempts).toBe(5)
    expect(config.approval_chain).toHaveLength(1)
  })

  it('returns defaults for empty metadata', () => {
    const config = extractRoutingConfig({})
    expect(config).toEqual(DEFAULT_ROUTING)
  })

  it('returns defaults for null metadata', () => {
    const config = extractRoutingConfig(null as unknown as Record<string, unknown>)
    expect(config).toEqual(DEFAULT_ROUTING)
  })

  it('preserves partial metadata with defaults for missing fields', () => {
    const config = extractRoutingConfig({ routing_mode: 'ai_only' })
    expect(config.routing_mode).toBe('ai_only')
    expect(config.confidence_threshold).toBe(DEFAULT_ROUTING.confidence_threshold)
    expect(config.fallback_routing).toBe('human_only')
  })
})

// ─── Task enrichment edge cases ──────────────────────────────────────────────

describe('buildTaskEnrichment', () => {
  it('returns empty object when no input provided', () => {
    const enriched = buildTaskEnrichment({})
    expect(enriched).toEqual({})
  })

  it('maps all routing decision fields', () => {
    const enriched = buildTaskEnrichment({
      routingDecision: {
        route: 'agent',
        reason: 'High confidence, low risk',
        confidence: 0.92,
        policyApplied: true,
        requiredPermissions: ['execute_workflows'],
      },
    })

    expect(enriched.routing_decision).toBe('agent')
    expect(enriched.routing_reason).toBe('High confidence, low risk')
    expect(enriched.confidence_score).toBe(0.92)
  })

  it('includes expected output schema when provided', () => {
    const schema = { type: 'object', properties: { approved: { type: 'boolean' } } }
    const enriched = buildTaskEnrichment({ expectedOutputSchema: schema })
    expect(enriched.expected_output_schema).toEqual(schema)
  })

  it('includes all fields when everything is provided', () => {
    const enriched = buildTaskEnrichment({
      routingDecision: {
        route: 'human',
        reason: 'Critical task',
        confidence: 0.4,
        policyApplied: true,
        requiredPermissions: ['approve_tasks'],
      },
      inputData: { block_id: 'b1', status: 'pending' },
      expectedOutputSchema: { type: 'object' },
      instructions: 'Review and approve the compliance report',
    })

    expect(enriched.routing_decision).toBe('human')
    expect(enriched.routing_reason).toBe('Critical task')
    expect(enriched.confidence_score).toBe(0.4)
    expect(enriched.input_data).toEqual({ block_id: 'b1', status: 'pending' })
    expect(enriched.expected_output_schema).toEqual({ type: 'object' })
    expect(enriched.instructions).toBe('Review and approve the compliance report')
  })
})

// ─── Routing decision matrix ─────────────────────────────────────────────────

describe('routing decision matrix', () => {
  // Tests use risk_routing_map which overrides policy routing_mode.
  // Risk map: low=ai_only(0.5), medium=hybrid(0.7), high=human_only(1.0), critical=human_only(1.0)
  // Risk-based routing takes priority over policy default mode (engine step 3 before step 4).
  const testCases: Array<{
    name: string
    mode: string
    risk: RiskLevel
    confidence: number
    expectedRoute: string
  }> = [
    { name: 'low risk + high confidence → agent (risk map: ai_only, threshold 0.5)', mode: 'ai_only', risk: 'low', confidence: 0.9, expectedRoute: 'agent' },
    { name: 'critical risk + high confidence → human (risk map: human_only)', mode: 'ai_only', risk: 'critical', confidence: 0.9, expectedRoute: 'human' },
    { name: 'low risk + high confidence → agent (risk map overrides human_only mode)', mode: 'human_only', risk: 'low', confidence: 0.9, expectedRoute: 'agent' },
    { name: 'medium risk + above threshold → agent (risk map: hybrid, threshold 0.7)', mode: 'hybrid', risk: 'medium', confidence: 0.8, expectedRoute: 'agent' },
    { name: 'medium risk + below threshold → human (risk map: hybrid, threshold 0.7)', mode: 'hybrid', risk: 'medium', confidence: 0.3, expectedRoute: 'human' },
    { name: 'high risk + high confidence → human (risk map: human_only, threshold 1.0)', mode: 'hybrid', risk: 'high', confidence: 0.99, expectedRoute: 'human' },
  ]

  const matrixPolicy: PolicyRoutingConfig = {
    routing_mode: 'hybrid',
    confidence_threshold: 0.7,
    risk_routing_map: {
      low: { mode: 'ai_only', threshold: 0.5 },
      medium: { mode: 'hybrid', threshold: 0.7 },
      high: { mode: 'human_only', threshold: 1.0 },
      critical: { mode: 'human_only', threshold: 1.0 },
    },
    approval_chain: [],
    fallback_routing: 'human_only',
    max_ai_attempts: 3,
  }

  for (const tc of testCases) {
    it(tc.name, () => {
      const policy: PolicyRoutingConfig = {
        ...matrixPolicy,
        routing_mode: tc.mode as PolicyRoutingConfig['routing_mode'],
      }

      const decision = makeRoutingDecision({
        stepConfig: {},
        policy,
        confidenceScore: tc.confidence,
        riskLevel: tc.risk,
        context: { orgId: 'org-1', workflowInstanceId: 'wf-1', stepIndex: 0 },
      })

      expect(decision.route).toBe(tc.expectedRoute)
    })
  }
})
