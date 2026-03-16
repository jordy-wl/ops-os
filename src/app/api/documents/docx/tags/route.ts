/**
 * DOCX Tag Extraction API — Phase 4, Sprint 11
 *
 * POST /api/documents/docx/tags — extract {tag} placeholders from a .docx file
 *
 * Accepts multipart form data with a .docx file.
 * Returns the list of unique tags found in the template.
 * Used by the template upload dialog for tag preview.
 */

import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { ok, apiError } from '@/lib/api/responses'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export const POST = withAuth(async (req: NextRequest) => {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return apiError('Invalid form data', 'validation/invalid-form', 400)
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return apiError('File is required', 'validation/missing-file', 400)
  }

  if (file.type !== DOCX_MIME) {
    return apiError('Only .docx files are supported', 'validation/invalid-file-type', 400)
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  const { extractDocxTags } = await import('@/lib/documents/docx-generator')
  const tags = extractDocxTags(buffer)

  return ok({ tags, count: tags.length })
})
