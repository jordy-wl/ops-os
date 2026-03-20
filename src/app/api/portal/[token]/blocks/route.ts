import { ok, apiError } from '@/lib/api/responses'
import { validatePortalToken } from '@/lib/portal'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * GET /api/portal/[token]/blocks -- list blocks exposed to this portal.
 * Public (no Clerk auth). Token-validated via shared_links.
 *
 * Returns blocks connected to the client block, filtered by
 * exposed_block_types and optionally exposed_block_ids from the portal config.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const result = await validatePortalToken(token)
  if (!result.valid) {
    return apiError(result.reason, 'portal/invalid-token', 401)
  }

  const { portalConfig } = result

  // If no block types are exposed, return empty list
  if (!portalConfig.exposed_block_types || portalConfig.exposed_block_types.length === 0) {
    logger.info('portal', 'portal.blocks.fetched', {
      org_id: portalConfig.org_id,
      token_prefix: token.slice(0, 8) + '...',
      count: 0,
    })
    return ok([])
  }

  const supabase = createServerClient()
  const clientBlockId = portalConfig.client_block_id

  // Find all blocks connected to the client block via edges (both directions)
  const { data: edges, error: edgesError } = await supabase
    .from('block_edges')
    .select('from_block_id, to_block_id')
    .eq('org_id', portalConfig.org_id)
    .or(`from_block_id.eq.${clientBlockId},to_block_id.eq.${clientBlockId}`)

  if (edgesError) {
    logger.error('portal', 'portal.blocks.edges_query_failed', {
      org_id: portalConfig.org_id,
      error_code: edgesError.code,
      token_prefix: token.slice(0, 8) + '...',
    })
    return apiError('Failed to fetch portal blocks', 'portal/blocks-failed', 500)
  }

  // Collect unique connected block IDs (excluding the client block itself)
  const connectedBlockIds = new Set<string>()
  for (const edge of edges ?? []) {
    if (edge.from_block_id !== clientBlockId) {
      connectedBlockIds.add(edge.from_block_id)
    }
    if (edge.to_block_id !== clientBlockId) {
      connectedBlockIds.add(edge.to_block_id)
    }
  }

  if (connectedBlockIds.size === 0) {
    logger.info('portal', 'portal.blocks.fetched', {
      org_id: portalConfig.org_id,
      token_prefix: token.slice(0, 8) + '...',
      count: 0,
    })
    return ok([])
  }

  // Query blocks by connected IDs, filtered by exposed types
  let query = supabase
    .from('blocks')
    .select('id, name, type, state, metadata, updated_at')
    .eq('org_id', portalConfig.org_id)
    .in('id', Array.from(connectedBlockIds))
    .in('type', portalConfig.exposed_block_types)
    .order('updated_at', { ascending: false })

  // Further filter by specific exposed block IDs if set
  if (portalConfig.exposed_block_ids && portalConfig.exposed_block_ids.length > 0) {
    query = query.in('id', portalConfig.exposed_block_ids)
  }

  const { data: blocks, error: blocksError } = await query

  if (blocksError) {
    logger.error('portal', 'portal.blocks.query_failed', {
      org_id: portalConfig.org_id,
      error_code: blocksError.code,
      token_prefix: token.slice(0, 8) + '...',
    })
    return apiError('Failed to fetch portal blocks', 'portal/blocks-failed', 500)
  }

  // Return lean block info -- no internal org details
  const result_blocks = (blocks ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    type: b.type,
    status: (b.metadata as Record<string, unknown>)?.status ?? b.state ?? null,
    updated_at: b.updated_at,
  }))

  logger.info('portal', 'portal.blocks.fetched', {
    org_id: portalConfig.org_id,
    token_prefix: token.slice(0, 8) + '...',
    count: result_blocks.length,
  })

  return ok(result_blocks)
}
