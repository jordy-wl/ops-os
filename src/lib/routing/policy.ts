/**
 * Policy Resolution — finds the most specific routing policy for a given context.
 *
 * Priority: step-level policy > workflow-level policy > org default policy.
 *
 * Policies are stored as Block entities of type 'policy' with
 * `policy_type: 'routing'` and `status: 'active'` in their metadata.
 */

import { createServerClient } from '@/lib/supabase/server'
import type { PolicyRoutingConfig } from './types'

/** Default routing config when no policy is found. */
export const DEFAULT_ROUTING: PolicyRoutingConfig = {
  routing_mode: 'human_only',
  confidence_threshold: 1.0,
  risk_routing_map: {},
  approval_chain: [],
  fallback_routing: 'human_only',
  max_ai_attempts: 3,
}

interface PolicyBlock {
  id: string
  name: string
  metadata: Record<string, unknown>
}

/**
 * Resolve the applicable routing policy for a given context.
 *
 * Looks for Policy blocks (type='policy', metadata.policy_type='routing', metadata.status='active')
 * scoped to the org. If a stepPolicyId or workflowPolicyId is provided, fetches that specific policy.
 * Otherwise falls back to the org's default routing policy.
 */
export async function resolvePolicy(
  orgId: string,
  options?: { stepPolicyId?: string; workflowPolicyId?: string }
): Promise<{ config: PolicyRoutingConfig; policyId: string | null }> {
  const supabase = createServerClient()

  // 1. Try step-level policy (most specific)
  if (options?.stepPolicyId) {
    const result = await fetchPolicyById(supabase, options.stepPolicyId, orgId)
    if (result) return result
  }

  // 2. Try workflow-level policy
  if (options?.workflowPolicyId) {
    const result = await fetchPolicyById(supabase, options.workflowPolicyId, orgId)
    if (result) return result
  }

  // 3. Fallback to org default routing policy
  const { data: orgPolicy } = await supabase
    .from('blocks')
    .select('id, name, metadata')
    .eq('org_id', orgId)
    .eq('type', 'policy')
    .order('created_at', { ascending: false })
    .limit(10)

  if (orgPolicy) {
    const active = orgPolicy.find(
      (p: PolicyBlock) =>
        p.metadata?.policy_type === 'routing' && p.metadata?.status === 'active'
    )
    if (active) {
      return { config: extractRoutingConfig(active.metadata), policyId: active.id }
    }
  }

  // 4. No policy found — use hardcoded default
  return { config: DEFAULT_ROUTING, policyId: null }
}

async function fetchPolicyById(
  supabase: ReturnType<typeof createServerClient>,
  policyId: string,
  orgId: string
): Promise<{ config: PolicyRoutingConfig; policyId: string } | null> {
  const { data, error } = await supabase
    .from('blocks')
    .select('id, name, metadata')
    .eq('id', policyId)
    .eq('org_id', orgId)
    .eq('type', 'policy')
    .single()

  if (error || !data) return null

  const meta = (data as PolicyBlock).metadata
  if (meta?.policy_type !== 'routing' || meta?.status !== 'active') return null

  return { config: extractRoutingConfig(meta), policyId: data.id as string }
}

/** Extract a PolicyRoutingConfig from raw block metadata. */
export function extractRoutingConfig(meta: Record<string, unknown> | null | undefined): PolicyRoutingConfig {
  if (!meta) return { ...DEFAULT_ROUTING }
  return {
    routing_mode: (meta.routing_mode as PolicyRoutingConfig['routing_mode']) ?? 'human_only',
    confidence_threshold: typeof meta.confidence_threshold === 'number' ? meta.confidence_threshold : 1.0,
    risk_routing_map: (meta.risk_routing_map as PolicyRoutingConfig['risk_routing_map']) ?? {},
    approval_chain: (meta.approval_chain as PolicyRoutingConfig['approval_chain']) ?? [],
    fallback_routing: 'human_only',
    max_ai_attempts: typeof meta.max_ai_attempts === 'number' ? meta.max_ai_attempts : 3,
  }
}
