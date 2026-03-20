import { ok, apiError } from '@/lib/api/responses'
import { validatePortalToken } from '@/lib/portal'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * GET /api/portal/[token]/documents -- list documents for this portal.
 * Public (no Clerk auth). Token-validated via shared_links.
 *
 * Returns documents linked to the client block or blocks connected to the client.
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

  // Check that documents feature is enabled
  if (!portalConfig.documents_enabled) {
    return apiError('Documents are not enabled for this portal', 'portal/feature-disabled', 403)
  }

  const supabase = createServerClient()
  const clientBlockId = portalConfig.client_block_id

  // Gather the client block ID plus all connected block IDs
  const blockIds: string[] = [clientBlockId]

  const { data: edges, error: edgesError } = await supabase
    .from('block_edges')
    .select('from_block_id, to_block_id')
    .eq('org_id', portalConfig.org_id)
    .or(`from_block_id.eq.${clientBlockId},to_block_id.eq.${clientBlockId}`)

  if (edgesError) {
    logger.error('portal', 'portal.documents.edges_query_failed', {
      org_id: portalConfig.org_id,
      error_code: edgesError.code,
      token_prefix: token.slice(0, 8) + '...',
    })
    return apiError('Failed to fetch portal documents', 'portal/documents-failed', 500)
  }

  for (const edge of edges ?? []) {
    if (edge.from_block_id !== clientBlockId) {
      blockIds.push(edge.from_block_id)
    }
    if (edge.to_block_id !== clientBlockId) {
      blockIds.push(edge.to_block_id)
    }
  }

  // Deduplicate
  const uniqueBlockIds = [...new Set(blockIds)]

  // Query documents for these blocks
  const { data: documents, error: docsError } = await supabase
    .from('documents')
    .select('id, title, version, format, created_at, file_path')
    .eq('org_id', portalConfig.org_id)
    .in('block_id', uniqueBlockIds)
    .order('created_at', { ascending: false })
    .limit(50)

  if (docsError) {
    logger.error('portal', 'portal.documents.query_failed', {
      org_id: portalConfig.org_id,
      error_code: docsError.code,
      token_prefix: token.slice(0, 8) + '...',
    })
    return apiError('Failed to fetch portal documents', 'portal/documents-failed', 500)
  }

  const result_docs = (documents ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    version: d.version,
    format: d.format,
    created_at: d.created_at,
    storage_path: d.file_path ?? null,
  }))

  logger.info('portal', 'portal.documents.fetched', {
    org_id: portalConfig.org_id,
    token_prefix: token.slice(0, 8) + '...',
    count: result_docs.length,
  })

  return ok(result_docs)
}
