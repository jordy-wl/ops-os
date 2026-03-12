/**
 * Routing Engine Types — defines the data structures used by the
 * routing decision engine and policy resolution system.
 */

/** Routing modes available for steps and policies. */
export const ROUTING_MODES = ['human_only', 'ai_only', 'hybrid', 'escalation_chain'] as const
export type RoutingMode = (typeof ROUTING_MODES)[number]

/** Risk levels used in routing policy maps. */
export const RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const
export type RiskLevel = (typeof RISK_LEVELS)[number]

/** A single entry in the risk routing map. */
export interface RiskRoutingEntry {
  mode: RoutingMode
  threshold: number // 0.0 – 1.0
}

/** An approver in an escalation/approval chain. */
export interface ApprovalChainEntry {
  role: string
  order: number
  required: boolean
}

/** The routing-specific fields stored in a Policy block's metadata. */
export interface PolicyRoutingConfig {
  routing_mode: RoutingMode
  confidence_threshold: number
  risk_routing_map: Record<string, RiskRoutingEntry>
  approval_chain: ApprovalChainEntry[]
  fallback_routing: 'human_only'
  max_ai_attempts: number
}

/** Input to the routing decision engine. */
export interface RoutingInput {
  stepConfig: {
    routing_mode?: string
    required_permissions?: string[]
    instructions?: string
  }
  policy: PolicyRoutingConfig | null
  confidenceScore?: number
  riskLevel?: RiskLevel | string
  context: {
    orgId: string
    workflowInstanceId: string
    stepIndex: number
  }
}

/** Output from the routing decision engine. */
export interface RoutingDecision {
  route: 'human' | 'agent' | 'approval_chain'
  reason: string
  confidence: number
  policyApplied: boolean
  requiredPermissions: string[]
  escalationPath?: string[]
}
