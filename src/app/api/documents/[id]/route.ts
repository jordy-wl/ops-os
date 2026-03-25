/**
 * Document Detail API — P3-S6-BE-02
 *
 * GET /api/documents/[id]              — get document by ID (full content)
 * GET /api/documents/[id]?download=1   — get signed download URL for file
 */

import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'
import { getDocument, getDocumentDownloadUrl } from '@/lib/documents/storage'

export const GET = withAuth(async (req: NextRequest, ctx, params) => {
  const documentId = params.id
  if (!documentId) {
    return apiError('Document ID is required', 'validation/missing-id', 400)
  }

  const supabase = createServerClient()
  const { searchParams } = new URL(req.url)
  const wantDownload = searchParams.get('download') === '1'

  try {
    const document = await getDocument(supabase, ctx.orgId, documentId)

    if (!document) {
      return apiError('Document not found', 'document/not-found', 404)
    }

    // If download requested and file exists in storage, return signed URL
    if (wantDownload && document.file_path) {
      const downloadUrl = await getDocumentDownloadUrl(supabase, document.file_path)
      return ok({ ...document, download_url: downloadUrl })
    }

    return ok(document)
  } catch {
    logger.error('api-documents', 'get_failed', {
      org_id: ctx.orgId,
      document_id: documentId,
    })
    return apiError('Failed to get document', 'db/query-failed', 500)
  }
})
