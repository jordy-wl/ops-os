import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

const CreateEdgeSchema = z.object({
  to_block_id: z.string().uuid(),
  edge_type: z.string().min(1).max(100),
  metadata: z.record(z.unknown()).optional().default({}),
})

export const POST = withAuth(async (req: NextRequest, ctx, params) => {
  const from_block_id = params.id
  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

  const parsed = CreateEdgeSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  if (from_block_id === parsed.data.to_block_id) {
    return apiError('A block cannot be connected to itself', 'blocks/self-loop', 400)
  }

  const supabase = createServerClient()

  // Verify both blocks exist in this org (one query)
  const { data: blocks, error: blocksError } = await supabase
    .from('blocks')
    .select('id')
    .eq('org_id', ctx.orgId)
    .in('id', [from_block_id, parsed.data.to_block_id])

  if (blocksError) {
    logger.error('api-blocks', 'db.query_failed', { error_code: blocksError.code })
    return apiError('Failed to verify blocks', 'db/query-failed', 500)
  }

  if (!blocks || blocks.length < 2) {
    return apiError('One or both blocks not found', 'blocks/not-found', 404)
  }

  const { data: edge, error: edgeError } = await supabase
    .from('block_edges')
    .insert({
      org_id: ctx.orgId,
      from_block_id,
      to_block_id: parsed.data.to_block_id,
      edge_type: parsed.data.edge_type,
      metadata: parsed.data.metadata,
    })
    .select()
    .single()

  if (edgeError || !edge) {
    logger.error('api-blocks', 'db.insert_failed', { error_code: edgeError?.code })
    return apiError('Failed to create edge', 'db/insert-failed', 500)
  }

  return ok(edge, 201)
})
