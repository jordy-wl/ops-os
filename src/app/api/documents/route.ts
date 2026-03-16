/**
 * Documents API — P3-S6-BE-02
 *
 * GET  /api/documents?block_id=X      — list documents for a block
 * POST /api/documents                 — store a new document version
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'
import { storeDocument, listDocuments } from '@/lib/documents/storage'

const CreateDocumentSchema = z.object({
  block_id: z.string().uuid(),
  title: z.string().min(1).max(500),
  format: z.enum(['html', 'pdf', 'markdown']).default('html'),
  html_content: z.string().max(5_000_000).optional(),
  template_id: z.string().uuid().optional(),
  ai_generated: z.boolean().default(false),
  generation_metadata: z.record(z.unknown()).optional(),
})

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const { searchParams } = new URL(req.url)
  const blockId = searchParams.get('block_id')

  if (!blockId) {
    return apiError('block_id query parameter is required', 'validation/missing-block-id', 400)
  }

  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)
  const supabase = createServerClient()

  try {
    const documents = await listDocuments(supabase, ctx.orgId, blockId, limit)
    return ok(documents)
  } catch (err) {
    logger.error('api-documents', 'list_failed', { org_id: ctx.orgId, block_id: blockId })
    return apiError('Failed to list documents', 'db/query-failed', 500)
  }
})

export const POST = withAuth(requirePermission(['manage_blocks'], async (req: NextRequest, ctx) => {
  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

  const parsed = CreateDocumentSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const supabase = createServerClient()

  // Verify the block exists and belongs to this org
  const { data: block, error: blockErr } = await supabase
    .from('blocks')
    .select('id')
    .eq('id', parsed.data.block_id)
    .eq('org_id', ctx.orgId)
    .single()

  if (blockErr || !block) {
    return apiError('Block not found', 'validation/block-not-found', 404)
  }

  try {
    const document = await storeDocument(supabase, {
      orgId: ctx.orgId,
      blockId: parsed.data.block_id,
      title: parsed.data.title,
      format: parsed.data.format,
      htmlContent: parsed.data.html_content,
      templateId: parsed.data.template_id,
      aiGenerated: parsed.data.ai_generated,
      generationMetadata: parsed.data.generation_metadata,
      createdBy: ctx.userId,
    })

    return ok(document, 201)
  } catch (err) {
    logger.error('api-documents', 'store_failed', { org_id: ctx.orgId })
    return apiError('Failed to store document', 'db/insert-failed', 500)
  }
}))
