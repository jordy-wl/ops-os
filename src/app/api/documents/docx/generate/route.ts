/**
 * DOCX Generation API — Phase 4, Sprint 11
 *
 * POST /api/documents/docx/generate — generate a .docx from a template + block data
 *
 * Accepts JSON with template_id + source_block_id.
 * Downloads the .docx template from storage, fills {tags}, returns the generated .docx.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { createServerClient } from '@/lib/supabase/server'
import { apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'
import { generateDocx } from '@/lib/documents/docx-generator'
import type { SourceBlock, BrandKit } from '@/lib/documents/renderer'

const GenerateSchema = z.object({
  template_id: z.string().uuid(),
  source_block_id: z.string().uuid(),
  extra_variables: z.record(z.string()).optional(),
  /** If true, also stores the generated doc in the documents table */
  store: z.boolean().default(false),
})

export const POST = withAuth(requirePermission(['manage_blocks'], async (req: NextRequest, ctx) => {
  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

  const parsed = GenerateSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const supabase = createServerClient()

  // Fetch the template block
  const { data: templateBlock, error: tplErr } = await supabase
    .from('blocks')
    .select('id, name, metadata')
    .eq('id', parsed.data.template_id)
    .eq('org_id', ctx.orgId)
    .eq('type', 'document_template')
    .single()

  if (tplErr || !templateBlock) {
    return apiError('Template not found', 'validation/template-not-found', 404)
  }

  const tplMeta = templateBlock.metadata as Record<string, unknown>
  const filePath = tplMeta.reference_file_path as string | undefined
  const mimeType = tplMeta.reference_mime_type as string | undefined

  if (!filePath || mimeType !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return apiError(
      'Template does not have a .docx reference file',
      'validation/not-docx-template',
      400
    )
  }

  // Download the .docx template from storage
  const { data: fileData, error: downloadErr } = await supabase.storage
    .from('documents')
    .download(filePath)

  if (downloadErr || !fileData) {
    return apiError('Failed to download template file', 'storage/download-failed', 500)
  }

  const templateBuffer = Buffer.from(await fileData.arrayBuffer())

  // Fetch source block
  const { data: sourceBlock, error: srcErr } = await supabase
    .from('blocks')
    .select('id, name, type, state, metadata, created_at, updated_at')
    .eq('id', parsed.data.source_block_id)
    .eq('org_id', ctx.orgId)
    .single()

  if (srcErr || !sourceBlock) {
    return apiError('Source block not found', 'validation/block-not-found', 404)
  }

  // Fetch brand kit (optional)
  const { data: brandKitBlock } = await supabase
    .from('blocks')
    .select('metadata')
    .eq('org_id', ctx.orgId)
    .eq('type', 'brand_kit')
    .limit(1)
    .single()

  const brandKit = brandKitBlock?.metadata as BrandKit | null

  // Generate the .docx
  const result = generateDocx({
    templateBuffer,
    source: sourceBlock as SourceBlock,
    brandKit,
    extraVariables: parsed.data.extra_variables,
  })

  // Optionally store in documents table
  if (parsed.data.store) {
    const { storeDocument } = await import('@/lib/documents/storage')
    await storeDocument(supabase, {
      orgId: ctx.orgId,
      blockId: parsed.data.source_block_id,
      title: `${templateBlock.name} — ${sourceBlock.name}`,
      format: 'pdf', // stored as binary
      pdfBuffer: result.buffer,
      templateId: parsed.data.template_id,
      aiGenerated: false,
      generationMetadata: {
        type: 'docx',
        found_tags: result.foundTags,
        missing_tags: result.missingTags,
      },
      createdBy: ctx.userId,
    })
  }

  // Log event
  await supabase.from('events').insert({
    org_id: ctx.orgId,
    block_id: parsed.data.source_block_id,
    type: 'document.docx_generated',
    actor_id: ctx.userId,
    actor_type: 'human',
    payload: {
      template_id: parsed.data.template_id,
      template_name: templateBlock.name,
      found_tags: result.foundTags.length,
      missing_tags: result.missingTags,
    },
  })

  logger.info('api-docx', 'docx.generated', {
    org_id: ctx.orgId,
    template_id: parsed.data.template_id,
    source_block_id: parsed.data.source_block_id,
    found_tags: result.foundTags.length,
    missing_tags: result.missingTags.length,
  })

  // Return the .docx as a downloadable file
  const fileName = `${templateBlock.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${sourceBlock.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.docx`

  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'X-Missing-Tags': JSON.stringify(result.missingTags),
    },
  })
}))
