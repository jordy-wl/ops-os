/**
 * Policy Settings — CRUD helpers for org-level routing policy configuration.
 *
 * Routing policies are stored as Block entities of type 'policy' with
 * metadata containing `policy_type: 'routing'` and `status: 'active'`.
 *
 * This module provides a settings-driven layer on top of the existing
 * policy resolution system in `./policy.ts`.
 */

import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { ROUTING_MODES, RISK_LEVELS } from './types'
import { DEFAULT_ROUTING, extractRoutingConfig } from './policy'
import type { PolicyRoutingConfig } from './types'

// ─── Validation Schema ───────────────────────────────────────────────────────

const RiskRoutingEntrySchema = z.object({
  mode: z.enum(ROUTING_MODES),
  threshold: z.number().min(0).max(1),
})

/**
 * Zod schema for validating routing policy configuration input.
 * Used by the PUT /api/settings/routing endpoint.
 */
export const RoutingPolicyInputSchema = z.object({
  routing_mode: z.enum(ROUTING_MODES),
  confidence_threshold: z.number().min(0, 'Must be >= 0').max(1, 'Must be <= 1'),
  risk_routing_map: z.record(z.enum(RISK_LEVELS), RiskRoutingEntrySchema)
    .refine(
      (map) => RISK_LEVELS.every((level) => level in map),
      { message: 'All 4 risk levels (low, medium, high, critical) must be mapped' }
    ),
  approval_chain: z.array(
    z.object({
      role: z.string().min(1),
      order: z.number().int().min(0),
      required: z.boolean(),
    })
  ).default([]),
  fallback_routing: z.literal('human_only').default('human_only'),
  max_ai_attempts: z.number().int().min(1).max(10).default(3),
})

export type RoutingPolicyInput = z.infer<typeof RoutingPolicyInputSchema>

// ─── Response Shape ──────────────────────────────────────────────────────────

export interface RoutingPolicyResponse extends PolicyRoutingConfig {
  policy_id: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Fetch the active routing policy for an org.
 * Returns the config from the most recent active routing policy block,
 * or defaults if no policy exists.
 */
export async function getOrgRoutingPolicy(orgId: string): Promise<RoutingPolicyResponse> {
  const supabase = createServerClient()

  const { data: policies, error } = await supabase
    .from('blocks')
    .select('id, name, metadata')
    .eq('org_id', orgId)
    .eq('type', 'policy')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    logger.error('policy-settings', 'db.fetch_failed', { error_code: error.code, org_id: orgId })
    return { ...DEFAULT_ROUTING, policy_id: null }
  }

  // Find the first active routing policy
  const active = (policies ?? []).find(
    (p: { id: string; metadata: Record<string, unknown> }) =>
      p.metadata?.policy_type === 'routing' && p.metadata?.status === 'active'
  )

  if (!active) {
    return { ...DEFAULT_ROUTING, policy_id: null }
  }

  const config = extractRoutingConfig(active.metadata as Record<string, unknown>)
  return { ...config, policy_id: active.id }
}

/**
 * Create or update the org's routing policy block.
 *
 * If an active routing policy block already exists for this org,
 * it is updated in place. Otherwise a new policy block is created.
 *
 * Returns the saved config with the policy block ID.
 */
export async function upsertOrgRoutingPolicy(
  orgId: string,
  userId: string,
  config: RoutingPolicyInput
): Promise<RoutingPolicyResponse> {
  const supabase = createServerClient()

  // Find existing active routing policy block
  const { data: policies } = await supabase
    .from('blocks')
    .select('id, metadata')
    .eq('org_id', orgId)
    .eq('type', 'policy')
    .order('created_at', { ascending: false })
    .limit(20)

  const existingActive = (policies ?? []).find(
    (p: { id: string; metadata: Record<string, unknown> }) =>
      p.metadata?.policy_type === 'routing' && p.metadata?.status === 'active'
  )

  const metadata = {
    policy_type: 'routing',
    status: 'active',
    routing_mode: config.routing_mode,
    confidence_threshold: config.confidence_threshold,
    risk_routing_map: config.risk_routing_map,
    approval_chain: config.approval_chain,
    fallback_routing: config.fallback_routing,
    max_ai_attempts: config.max_ai_attempts,
  }

  if (existingActive) {
    // Update existing policy block
    const { error: updateError } = await supabase
      .from('blocks')
      .update({ metadata, updated_at: new Date().toISOString() })
      .eq('id', existingActive.id)
      .eq('org_id', orgId)

    if (updateError) {
      logger.error('policy-settings', 'db.update_failed', {
        error_code: updateError.code,
        org_id: orgId,
        policy_id: existingActive.id,
      })
      throw new Error('Failed to update routing policy')
    }

    logger.info('policy-settings', 'policy.updated', {
      org_id: orgId,
      policy_id: existingActive.id,
    })

    return {
      routing_mode: config.routing_mode,
      confidence_threshold: config.confidence_threshold,
      risk_routing_map: config.risk_routing_map,
      approval_chain: config.approval_chain,
      fallback_routing: 'human_only',
      max_ai_attempts: config.max_ai_attempts,
      policy_id: existingActive.id,
    }
  }

  // Create new policy block
  const { data: newBlock, error: insertError } = await supabase
    .from('blocks')
    .insert({
      type: 'policy',
      name: 'Org Routing Policy',
      status: 'active',
      metadata: metadata,
      org_id: orgId,
      created_by: userId,
    })
    .select('id')
    .single()

  if (insertError || !newBlock) {
    logger.error('policy-settings', 'db.insert_failed', {
      error_code: insertError?.code,
      org_id: orgId,
    })
    throw new Error('Failed to create routing policy')
  }

  logger.info('policy-settings', 'policy.created', {
    org_id: orgId,
    policy_id: newBlock.id,
  })

  return {
    routing_mode: config.routing_mode,
    confidence_threshold: config.confidence_threshold,
    risk_routing_map: config.risk_routing_map,
    approval_chain: config.approval_chain,
    fallback_routing: 'human_only',
    max_ai_attempts: config.max_ai_attempts,
    policy_id: newBlock.id,
  }
}
