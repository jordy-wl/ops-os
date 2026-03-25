import { logger } from '@/lib/logger'
import type { createServerClient } from '@/lib/supabase/server'
import type { StepResult } from '../step-engine'

type InstanceMeta = {
  source_block_id: string
  template_id: string
  applies_to_type: string
  step_results: StepResult[]
}

/**
 * Resolves a template block reference to a concrete block ID.
 *
 * Supports:
 * - `{{context.source_block_id}}` → triggering record
 * - `{{steps.<step_name>.<field>}}` → output from a previous step
 * - `{{related:<source>:<edge_type>:<direction>}}` → follow a relationship edge
 * - Literal UUID string → returned as-is (backward compatibility)
 * - Empty/undefined → falls back to source_block_id
 */
export async function resolveTemplateBlockId(
  value: string | undefined,
  meta: InstanceMeta,
  orgId: string,
  supabase: ReturnType<typeof createServerClient>
): Promise<{ blockId: string; error?: undefined } | { blockId: null; error: string }> {
  // Empty or undefined → default to triggering record
  if (!value) {
    return { blockId: meta.source_block_id }
  }

  // {{context.source_block_id}} → triggering record
  if (value === '{{context.source_block_id}}') {
    return { blockId: meta.source_block_id }
  }

  // {{context.*}} → other context fields
  const contextMatch = value.match(/^\{\{context\.(\w+)\}\}$/)
  if (contextMatch) {
    const key = contextMatch[1]
    const contextVars: Record<string, string> = {
      source_block_id: meta.source_block_id,
      template_id: meta.template_id,
      applies_to_type: meta.applies_to_type,
    }
    const resolved = contextVars[key]
    if (!resolved) {
      return { blockId: null, error: `Unknown context variable: ${key}` }
    }
    return { blockId: resolved }
  }

  // {{steps.<step_name>.<field>}} → previous step output
  const stepMatch = value.match(/^\{\{steps\.([^.]+)\.(.+)\}\}$/)
  if (stepMatch) {
    const [, stepName, fieldPath] = stepMatch
    const stepResult = meta.step_results.find((r) => r.step_name === stepName)
    if (!stepResult?.output) {
      return { blockId: null, error: `Step '${stepName}' not found or has no output` }
    }

    // Navigate the field path (supports dot notation and bracket notation)
    const resolved = navigatePath(stepResult.output, fieldPath)
    if (typeof resolved !== 'string') {
      return { blockId: null, error: `Step '${stepName}.${fieldPath}' did not resolve to a string` }
    }
    return { blockId: resolved }
  }

  // {{related:<source>:<edge_type>:<direction>}} → follow a relationship edge
  const relatedMatch = value.match(/^\{\{related:([^:]+):([^:]+):([^}]+)\}\}$/)
  if (relatedMatch) {
    const [, source, edgeType, direction] = relatedMatch

    // Resolve the source block ID
    let sourceBlockId: string
    if (source === 'triggering') {
      sourceBlockId = meta.source_block_id
    } else if (source.startsWith('steps.')) {
      const stepRef = `{{${source}.block_id}}`
      const result = await resolveTemplateBlockId(stepRef, meta, orgId, supabase)
      if (result.error || !result.blockId) return { blockId: null, error: result.error ?? 'Step did not produce a block ID' }
      sourceBlockId = result.blockId
    } else {
      return { blockId: null, error: `Unknown related record source: ${source}` }
    }

    // Query block_edges for the related record
    const isOutgoing = direction === 'outgoing'
    const query = supabase
      .from('block_edges')
      .select('from_block_id, to_block_id')
      .eq('org_id', orgId)

    if (isOutgoing) {
      query.eq('from_block_id', sourceBlockId)
    } else {
      query.eq('to_block_id', sourceBlockId)
    }

    // edge_type column is 'type' in the table
    query.eq('type', edgeType)
    query.limit(1)

    const { data: edges, error: edgeError } = await query

    if (edgeError) {
      logger.error('step-engine', 'resolve_block_ref.edge_query_failed', {
        error_code: edgeError.code,
      })
      return { blockId: null, error: `Failed to query edges: ${edgeError.message}` }
    }

    if (!edges || edges.length === 0) {
      return {
        blockId: null,
        error: `No '${edgeType}' ${direction} edge found from block ${sourceBlockId.slice(0, 8)}...`,
      }
    }

    const edge = edges[0]
    const relatedBlockId = isOutgoing ? edge.to_block_id : edge.from_block_id
    return { blockId: relatedBlockId }
  }

  // {{block.<field>}} → resolve from the source block's metadata
  const blockMatch = value.match(/^\{\{block\.(\w+)\}\}$/)
  if (blockMatch) {
    const field = blockMatch[1]
    const { data: sourceBlock } = await supabase
      .from('blocks')
      .select('id, metadata')
      .eq('id', meta.source_block_id)
      .eq('org_id', orgId)
      .single()

    if (!sourceBlock) {
      return { blockId: null, error: `Source block ${meta.source_block_id} not found` }
    }

    const metadata = (sourceBlock.metadata ?? {}) as Record<string, unknown>
    const resolved = metadata[field]
    if (typeof resolved !== 'string') {
      return { blockId: null, error: `Block field '${field}' is not a string` }
    }
    return { blockId: resolved }
  }

  // Literal UUID — return as-is (backward compat)
  return { blockId: value }
}

/**
 * Navigate a dot-path with optional array bracket notation.
 * Supports: "block_id", "results[0]", "nested.field", "results[0].id"
 */
function navigatePath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined

    // Check for bracket notation: results[0]
    const bracketMatch = part.match(/^(\w+)\[(\d+)\]$/)
    if (bracketMatch) {
      const [, key, indexStr] = bracketMatch
      const arr = (current as Record<string, unknown>)[key]
      if (!Array.isArray(arr)) return undefined
      current = arr[parseInt(indexStr, 10)]
    } else {
      current = (current as Record<string, unknown>)[part]
    }
  }

  return current
}
