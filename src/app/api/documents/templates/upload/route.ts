/**
 * Template Extraction Trigger — P3-S6-BE-01
 *
 * POST /api/documents/templates/upload  — trigger AI extraction on an existing template
 *
 * Used after upload for file types where extraction couldn't be done synchronously.
 * Also allows re-extraction when AI improves.
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'
import {
  extractTemplateStructure,
  extractTextFromHtml,
} from '@/lib/documents/reference-extraction'

const ExtractSchema = z.object({
  template_id: z.string().uuid(),
  content_override: z.string().max(50000).optional(), // For manually pasted content
})

export const POST = withAuth(requirePermission(['manage_blocks'], async (req: NextRequest, ctx) => {
  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

  const parsed = ExtractSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const supabase = createServerClient()

  // Fetch the template block
  const { data: templateBlock, error: fetchErr } = await supabase
    .from('blocks')
    .select('id, name, metadata')
    .eq('id', parsed.data.template_id)
    .eq('org_id', ctx.orgId)
    .eq('type', 'document_template')
    .single()

  if (fetchErr || !templateBlock) {
    return apiError('Template not found', 'validation/template-not-found', 404)
  }

  const metadata = templateBlock.metadata as Record<string, unknown>
  let contentToAnalyze = parsed.data.content_override ?? ''

  // If no override, try to download from storage
  if (!contentToAnalyze && metadata.reference_file_path) {
    const filePath = metadata.reference_file_path as string
    const mimeType = (metadata.reference_mime_type as string) ?? ''

    // Only text-based files can be extracted
    if (['text/html', 'text/markdown', 'text/plain'].includes(mimeType)) {
      const { data: fileData, error: downloadErr } = await supabase.storage
        .from('documents')
        .download(filePath)

      if (downloadErr || !fileData) {
        return apiError('Failed to download reference file', 'storage/download-failed', 500)
      }

      const text = await fileData.text()
      contentToAnalyze = mimeType === 'text/html' ? extractTextFromHtml(text) : text
    } else {
      return apiError(
        'Automatic extraction not supported for this file type. Provide content_override.',
        'validation/unsupported-extraction',
        400
      )
    }
  }

  if (!contentToAnalyze) {
    return apiError(
      'No content available for extraction',
      'validation/no-content',
      400
    )
  }

  const fileName = (metadata.reference_file_name as string) ?? templateBlock.name
  const mimeType = (metadata.reference_mime_type as string) ?? 'text/plain'

  const extraction = await extractTemplateStructure(contentToAnalyze, fileName, mimeType)

  // Update template block metadata with extraction results
  const updatedMetadata: Record<string, unknown> = {
    ...metadata,
    structure_description: extraction.structureDescription,
  }

  if (extraction.detectedVariables.length > 0) {
    updatedMetadata.variables = extraction.detectedVariables.map((v) => ({
      name: v.name,
      type: v.type,
      required: false,
    }))
  }

  if (extraction.suggestedCategory !== 'other' && !metadata.category) {
    updatedMetadata.category = extraction.suggestedCategory
  }

  const { error: updateErr } = await supabase
    .from('blocks')
    .update({ metadata: updatedMetadata })
    .eq('id', templateBlock.id)
    .eq('org_id', ctx.orgId)

  if (updateErr) {
    logger.error('api-templates', 'db.update_failed', {
      org_id: ctx.orgId,
      template_id: templateBlock.id,
      error_code: updateErr.code,
    })
    return apiError('Failed to update template', 'db/update-failed', 500)
  }

  logger.info('api-templates', 'extraction.completed', {
    org_id: ctx.orgId,
    template_id: templateBlock.id,
    variables_count: extraction.detectedVariables.length,
    category: extraction.suggestedCategory,
  })

  return ok({
    template_id: templateBlock.id,
    extraction: {
      structure_description: extraction.structureDescription,
      detected_variables: extraction.detectedVariables,
      suggested_category: extraction.suggestedCategory,
    },
  })
}))
