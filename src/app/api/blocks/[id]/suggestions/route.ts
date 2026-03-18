import { NextRequest } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'
import { generateBlockSuggestions } from '@/lib/ai/block-suggestions-generator'
import { sanitizePayload } from '@/lib/embeddings'

/**
 * GET /api/blocks/[id]/suggestions
 * Returns AI-generated suggestions for ANY block type.
 * For workflow_instance blocks, redirects to the existing insights pipeline.
 */
async function handler(
  _req: NextRequest,
  ctx: AuthContext,
  params: Record<string, string>
) {
  const id = params.id
  const supabase = createServerClient()

  // 1. Fetch the block
  const { data: block, error: blockError } = await supabase
    .from('blocks')
    .select('id, type, name, state, metadata')
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .single()

  if (blockError || !block) {
    return apiError('Block not found', 'blocks/not-found', 404)
  }

  // 2. For workflow_instance, delegate to the insights endpoint
  if (block.type === 'workflow_instance') {
    return apiError(
      'Use /api/blocks/:id/insights for workflow_instance blocks',
      'blocks/use-insights-endpoint',
      400
    )
  }

  // 3. Fetch recent events for context
  const { data: events } = await supabase
    .from('events')
    .select('id, type, occurred_at, payload')
    .eq('block_id', id)
    .eq('org_id', ctx.orgId)
    .order('occurred_at', { ascending: false })
    .limit(10)

  // 4. Fetch one-hop neighbours
  const { data: edges } = await supabase
    .from('block_edges')
    .select('from_block_id, to_block_id')
    .eq('org_id', ctx.orgId)
    .or(`from_block_id.eq.${id},to_block_id.eq.${id}`)
    .limit(20)

  let neighbours: Array<{ name: string; type: string }> = []
  if (edges && edges.length > 0) {
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

    if (neighbourIds.length > 0) {
      const { data: neighbourBlocks } = await supabase
        .from('blocks')
        .select('name, type')
        .in('id', neighbourIds)
        .eq('org_id', ctx.orgId)

      neighbours = (neighbourBlocks ?? []).map((b) => ({
        name: b.name as string,
        type: b.type as string,
      }))
    }
  }

  // 5. Build context and generate suggestions
  const eventList = (events ?? []).map((e) => ({
    type: e.type as string,
    occurred_at: e.occurred_at as string,
    payload: sanitizePayload((e.payload ?? {}) as Record<string, unknown>),
  }))

  const lastEventId = eventList[0]
    ? (events![0].id as string)
    : 'none'

  const result = await generateBlockSuggestions({
    blockId: id,
    blockName: block.name as string,
    blockType: block.type as string,
    blockState: (block.state as string) ?? 'active',
    metadata: (block.metadata ?? {}) as Record<string, unknown>,
    events: eventList,
    neighbours,
    lastEventId,
  })

  logger.info('api-suggestions', 'suggestions.served', {
    block_id: id,
    block_type: block.type,
    count: result.suggestions.length,
    from_cache: result.fromCache,
  })

  return ok(result)
}

export const GET = withAuth(handler)
