import { logger } from '@/lib/logger'
import type { StepHandler } from './types'

/**
 * create_edge handler — links two blocks via block_edges table.
 *
 * Step config:
 * - from_block_id: UUID or '{{context.source_block_id}}' (defaults to source block)
 * - to_block_id: UUID (required)
 * - edge_type: string label (defaults to 'related')
 */
const handler: StepHandler = async (step, meta, orgId, supabase) => {
  const now = new Date().toISOString()
  const stepAny = step as Record<string, unknown>

  const fromBlockId = (stepAny.from_block_id as string) ?? meta.source_block_id
  const toBlockId = stepAny.to_block_id as string | undefined
  const edgeType = (stepAny.edge_type as string) ?? 'related'

  if (!toBlockId) {
    return { step_name: step.name, step_type: step.type, status: 'failed', error: 'Missing to_block_id', executed_at: now }
  }

  // Resolve template expressions
  const resolvedFrom = fromBlockId === '{{context.source_block_id}}' ? meta.source_block_id : fromBlockId
  const resolvedTo = toBlockId === '{{context.source_block_id}}' ? meta.source_block_id : toBlockId

  if (resolvedFrom === resolvedTo) {
    return { step_name: step.name, step_type: step.type, status: 'failed', error: 'Cannot create self-edge', executed_at: now }
  }

  // Verify both blocks exist and belong to this org
  const { data: blocks } = await supabase
    .from('blocks')
    .select('id')
    .eq('org_id', orgId)
    .in('id', [resolvedFrom, resolvedTo])

  if (!blocks || blocks.length < 2) {
    return { step_name: step.name, step_type: step.type, status: 'failed', error: 'One or both blocks not found in org', executed_at: now }
  }

  // Check for existing edge (prevent duplicates)
  const { data: existing } = await supabase
    .from('block_edges')
    .select('id')
    .eq('org_id', orgId)
    .eq('from_block_id', resolvedFrom)
    .eq('to_block_id', resolvedTo)
    .maybeSingle()

  if (existing) {
    return {
      step_name: step.name,
      step_type: step.type,
      status: 'completed',
      output: { edge_id: existing.id, already_existed: true },
      executed_at: now,
    }
  }

  // Create the edge
  const { data: edge, error: edgeError } = await supabase
    .from('block_edges')
    .insert({
      org_id: orgId,
      from_block_id: resolvedFrom,
      to_block_id: resolvedTo,
      type: edgeType,
    })
    .select('id')
    .single()

  if (edgeError || !edge) {
    logger.error('step-engine', 'step.create_edge_failed', { error_code: edgeError?.code })
    return { step_name: step.name, step_type: step.type, status: 'failed', error: edgeError?.message ?? 'Failed to create edge', executed_at: now }
  }

  // Emit event on both blocks
  await supabase.from('events').insert([
    {
      org_id: orgId,
      block_id: resolvedFrom,
      type: 'block.edge_created',
      actor_type: 'workflow',
      payload: { edge_id: edge.id, to_block_id: resolvedTo, edge_type: edgeType, step_name: step.name },
    },
    {
      org_id: orgId,
      block_id: resolvedTo,
      type: 'block.edge_created',
      actor_type: 'workflow',
      payload: { edge_id: edge.id, from_block_id: resolvedFrom, edge_type: edgeType, step_name: step.name },
    },
  ])

  logger.info('step-engine', 'step.create_edge_completed', {
    from: resolvedFrom,
    to: resolvedTo,
    edge_type: edgeType,
  })

  return {
    step_name: step.name,
    step_type: step.type,
    status: 'completed',
    output: { edge_id: edge.id, from_block_id: resolvedFrom, to_block_id: resolvedTo, edge_type: edgeType },
    executed_at: now,
  }
}

export default handler
