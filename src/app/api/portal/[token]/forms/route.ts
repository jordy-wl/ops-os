import { ok, apiError } from '@/lib/api/responses'
import { validatePortalToken } from '@/lib/portal'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * GET /api/portal/[token]/forms -- list form templates available in this portal.
 * Public (no Clerk auth). Token-validated via shared_links.
 *
 * Returns form_template blocks connected to the client block.
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

  // Check that forms feature is enabled
  if (!portalConfig.forms_enabled) {
    return apiError('Forms are not enabled for this portal', 'portal/feature-disabled', 403)
  }

  const supabase = createServerClient()
  const clientBlockId = portalConfig.client_block_id

  // Find form_template blocks connected to the client block (both directions)
  const { data: edges, error: edgesError } = await supabase
    .from('block_edges')
    .select('from_block_id, to_block_id')
    .eq('org_id', portalConfig.org_id)
    .or(`from_block_id.eq.${clientBlockId},to_block_id.eq.${clientBlockId}`)

  if (edgesError) {
    logger.error('portal', 'portal.forms.edges_query_failed', {
      org_id: portalConfig.org_id,
      error_code: edgesError.code,
      token_prefix: token.slice(0, 8) + '...',
    })
    return apiError('Failed to fetch portal forms', 'portal/forms-failed', 500)
  }

  // Collect connected block IDs
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
    logger.info('portal', 'portal.forms.fetched', {
      org_id: portalConfig.org_id,
      token_prefix: token.slice(0, 8) + '...',
      count: 0,
    })
    return ok([])
  }

  // Query form_template blocks among connected blocks
  const { data: forms, error: formsError } = await supabase
    .from('blocks')
    .select('id, name, metadata')
    .eq('org_id', portalConfig.org_id)
    .eq('type', 'form_template')
    .in('id', Array.from(connectedBlockIds))
    .order('updated_at', { ascending: false })

  if (formsError) {
    logger.error('portal', 'portal.forms.query_failed', {
      org_id: portalConfig.org_id,
      error_code: formsError.code,
      token_prefix: token.slice(0, 8) + '...',
    })
    return apiError('Failed to fetch portal forms', 'portal/forms-failed', 500)
  }

  const result_forms = (forms ?? []).map((f) => {
    const meta = (f.metadata ?? {}) as Record<string, unknown>
    const questions = Array.isArray(meta.questions) ? meta.questions : []
    return {
      id: f.id,
      name: f.name,
      title: (meta.title as string) ?? f.name,
      description: (meta.description as string) ?? null,
      category: (meta.category as string) ?? null,
      status: (meta.status as string) ?? null,
      question_count: questions.length,
    }
  })

  logger.info('portal', 'portal.forms.fetched', {
    org_id: portalConfig.org_id,
    token_prefix: token.slice(0, 8) + '...',
    count: result_forms.length,
  })

  return ok(result_forms)
}
