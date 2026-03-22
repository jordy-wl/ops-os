import { ok, apiError } from '@/lib/api/responses'
import { validatePortalToken } from '@/lib/portal'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * GET /api/portal/[token]/events -- event timeline for this portal.
 * Public (no Clerk auth). Token-validated via shared_links.
 *
 * Returns the last 20 events for the client block and connected blocks.
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
  const supabase = createServerClient()
  const clientBlockId = portalConfig.client_block_id

  // Gather client block + connected block IDs
  const blockIds: string[] = [clientBlockId]

  const { data: edges, error: edgesError } = await supabase
    .from('block_edges')
    .select('from_block_id, to_block_id')
    .eq('org_id', portalConfig.org_id)
    .or(`from_block_id.eq.${clientBlockId},to_block_id.eq.${clientBlockId}`)

  if (edgesError) {
    logger.error('portal', 'portal.events.edges_query_failed', {
      org_id: portalConfig.org_id,
      error_code: edgesError.code,
      token_prefix: token.slice(0, 8) + '...',
    })
    return apiError('Failed to fetch portal events', 'portal/events-failed', 500)
  }

  for (const edge of edges ?? []) {
    if (edge.from_block_id !== clientBlockId) {
      blockIds.push(edge.from_block_id)
    }
    if (edge.to_block_id !== clientBlockId) {
      blockIds.push(edge.to_block_id)
    }
  }

  const uniqueBlockIds = [...new Set(blockIds)]

  // Query recent events for these blocks
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('id, type, payload, occurred_at')
    .eq('org_id', portalConfig.org_id)
    .in('block_id', uniqueBlockIds)
    .order('occurred_at', { ascending: false })
    .limit(20)

  if (eventsError) {
    logger.error('portal', 'portal.events.query_failed', {
      org_id: portalConfig.org_id,
      error_code: eventsError.code,
      token_prefix: token.slice(0, 8) + '...',
    })
    return apiError('Failed to fetch portal events', 'portal/events-failed', 500)
  }

  const result_events = (events ?? []).map((e) => ({
    id: e.id,
    type: e.type,
    payload: e.payload,
    occurred_at: e.occurred_at,
  }))

  logger.info('portal', 'portal.events.fetched', {
    org_id: portalConfig.org_id,
    token_prefix: token.slice(0, 8) + '...',
    count: result_events.length,
  })

  return ok(result_events)
}
