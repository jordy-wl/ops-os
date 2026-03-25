/**
 * Document Versions API — P3-S6-BE-02
 *
 * GET /api/documents/versions?block_id=X&title=Y — get all versions of a document
 */

import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'
import { getDocumentVersions } from '@/lib/documents/storage'

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const { searchParams } = new URL(req.url)
  const blockId = searchParams.get('block_id')
  const title = searchParams.get('title')

  if (!blockId || !title) {
    return apiError(
      'block_id and title query parameters are required',
      'validation/missing-params',
      400
    )
  }

  const supabase = createServerClient()

  try {
    const versions = await getDocumentVersions(supabase, ctx.orgId, blockId, title)
    return ok(versions)
  } catch {
    logger.error('api-documents', 'versions_failed', {
      org_id: ctx.orgId,
      block_id: blockId,
    })
    return apiError('Failed to get document versions', 'db/query-failed', 500)
  }
})
