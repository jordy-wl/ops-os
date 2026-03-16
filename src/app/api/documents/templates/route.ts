/**
 * Document Templates API — P3-S6-BE-01
 *
 * GET  /api/documents/templates           — list document_template blocks
 * POST /api/documents/templates           — create template from uploaded reference file
 */

import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)

  const supabase = createServerClient()

  let query = supabase
    .from('blocks')
    .select('id, name, type, state, metadata, created_at, updated_at')
    .eq('org_id', ctx.orgId)
    .eq('type', 'document_template')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (category) {
    query = query.eq('metadata->>category', category)
  }

  const { data, error } = await query

  if (error) {
    logger.error('api-templates', 'db.list_failed', { error_code: error.code })
    return apiError('Failed to list templates', 'db/query-failed', 500)
  }

  return ok(data)
})

export const POST = withAuth(requirePermission(['manage_blocks'], async (req: NextRequest, ctx) => {
  const supabase = createServerClient()

  // Parse multipart form data
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return apiError('Invalid form data', 'validation/invalid-form', 400)
  }

  const file = formData.get('file') as File | null
  const name = formData.get('name') as string | null
  const category = (formData.get('category') as string) ?? 'other'

  if (!file) {
    return apiError('File is required', 'validation/missing-file', 400)
  }

  if (!name || name.trim().length === 0) {
    return apiError('Template name is required', 'validation/missing-name', 400)
  }

  // Validate file type
  const allowedTypes = [
    'application/pdf',
    'text/html',
    'text/markdown',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]

  if (!allowedTypes.includes(file.type)) {
    return apiError(
      `Unsupported file type: ${file.type}. Allowed: PDF, HTML, Markdown, DOCX`,
      'validation/invalid-file-type',
      400
    )
  }

  // Validate file size (max 50MB)
  const maxSize = 50 * 1024 * 1024
  if (file.size > maxSize) {
    return apiError('File exceeds 50MB limit', 'validation/file-too-large', 400)
  }

  // Upload file to Supabase Storage
  const fileBuffer = Buffer.from(await file.arrayBuffer())
  const storagePath = `${ctx.orgId}/templates/${crypto.randomUUID()}/${file.name}`

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, fileBuffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    logger.error('api-templates', 'storage.upload_failed', {
      org_id: ctx.orgId,
      error: uploadError.message,
    })
    return apiError('Failed to upload file', 'storage/upload-failed', 500)
  }

  // Extract text content for AI analysis (non-blocking for PDF/DOCX — just store the file)
  let structureDescription = `Uploaded reference document: ${file.name}`
  let detectedVariables: Array<{ name: string; type: string; description: string }> = []
  let suggestedCategory = category

  // For text-based files, extract and analyze immediately
  if (file.type === 'text/html' || file.type === 'text/markdown' || file.type === 'text/plain') {
    try {
      const textContent = fileBuffer.toString('utf-8')
      const { extractTemplateStructure, extractTextFromHtml } = await import(
        '@/lib/documents/reference-extraction'
      )

      const content = file.type === 'text/html' ? extractTextFromHtml(textContent) : textContent

      const extraction = await extractTemplateStructure(content, file.name, file.type)
      structureDescription = extraction.structureDescription
      detectedVariables = extraction.detectedVariables
      if (category === 'other') suggestedCategory = extraction.suggestedCategory
    } catch {
      logger.warn('api-templates', 'extraction.failed', {
        org_id: ctx.orgId,
        file_name: file.name,
      })
      // Non-blocking — template is created even if extraction fails
    }
  }

  // Create document_template block
  const metadata: Record<string, unknown> = {
    template_content: '', // Empty for reference-based templates (AI generates content on demand)
    category: suggestedCategory,
    reference_file_path: storagePath,
    reference_file_name: file.name,
    reference_mime_type: file.type,
    structure_description: structureDescription,
    output_format: 'html',
  }

  if (detectedVariables.length > 0) {
    metadata.variables = detectedVariables.map((v) => ({
      name: v.name,
      type: v.type,
      required: false,
    }))
  }

  const { data: result, error: rpcError } = await supabase.rpc('create_block_with_event', {
    p_org_id: ctx.orgId,
    p_type: 'document_template',
    p_name: name.trim(),
    p_metadata: metadata,
    p_actor_id: ctx.userId,
    p_actor_type: 'human',
  })

  if (rpcError || !result) {
    logger.error('api-templates', 'db.create_failed', {
      org_id: ctx.orgId,
      error_code: rpcError?.code,
    })
    return apiError('Failed to create template', 'db/insert-failed', 500)
  }

  logger.info('api-templates', 'template.created', {
    org_id: ctx.orgId,
    template_id: result.block.id,
    file_name: file.name,
    file_type: file.type,
    has_extraction: structureDescription !== `Uploaded reference document: ${file.name}`,
  })

  return ok({
    block: result.block,
    event: result.event,
    extraction: {
      structure_description: structureDescription,
      detected_variables: detectedVariables,
      suggested_category: suggestedCategory,
    },
  }, 201)
}))
