import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

export const GET = withAuth(async (_req: NextRequest, ctx, params) => {
  const { id } = params
  const supabase = createServerClient()

  // Verify block exists in this org
  const { data: block, error: blockError } = await supabase
    .from('blocks')
    .select('id')
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .single()

  if (blockError?.code === 'PGRST116' || !block) {
    return apiError('Block not found', 'blocks/not-found', 404)
  }
  if (blockError) {
    logger.error('api-blocks', 'db.query_failed', { error_code: blockError.code })
    return apiError('Failed to fetch block', 'db/query-failed', 500)
  }

  // Get all edges where this block appears (either direction)
  const { data: edges, error: edgesError } = await supabase
    .from('block_edges')
    .select('from_block_id, to_block_id')
    .eq('org_id', ctx.orgId)
    .or(`from_block_id.eq.${id},to_block_id.eq.${id}`)

  if (edgesError) {
    logger.error('api-blocks', 'db.edges_query_failed', { error_code: edgesError.code })
    return apiError('Failed to fetch neighbours', 'db/query-failed', 500)
  }

  if (!edges || edges.length === 0) {
    return ok([])
  }

  // Collect unique neighbour IDs (excluding self)
  const neighbourIds = [
    ...new Set(
      edges
        .flatMap((e: { from_block_id: string; to_block_id: string }) => [
          e.from_block_id,
          e.to_block_id,
        ])
        .filter((bid: string) => bid !== id)
    ),
  ]

  const { data: neighbours, error: neighboursError } = await supabase
    .from('blocks')
    .select('*')
    .in('id', neighbourIds)
    .eq('org_id', ctx.orgId)

  if (neighboursError) {
    logger.error('api-blocks', 'db.query_failed', { error_code: neighboursError.code })
    return apiError('Failed to fetch neighbour blocks', 'db/query-failed', 500)
  }

  return ok(neighbours ?? [])
})
