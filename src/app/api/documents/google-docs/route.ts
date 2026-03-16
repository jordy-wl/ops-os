/**
 * Google Docs Push API — Phase 4, Sprint 11
 *
 * POST /api/documents/google-docs — create a Google Doc from block data and share it
 *
 * Uses the existing Google integration connector to:
 * 1. Create a new Google Doc
 * 2. Fill it with block data (name, type, status, metadata fields)
 * 3. Optionally share with specified email addresses
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'
import { pushToGoogleDocs } from '@/lib/documents/google-docs'
import type { SourceBlock, BrandKit } from '@/lib/documents/renderer'

const PushSchema = z.object({
  connector_id: z.string().uuid(),
  source_block_id: z.string().uuid(),
  title: z.string().min(1).max(500),
  folder_id: z.string().max(200).optional(),
  share_with: z.array(z.string().email()).max(20).optional(),
})

export const POST = withAuth(requirePermission(['manage_blocks'], async (req: NextRequest, ctx) => {
  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

  const parsed = PushSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const supabase = createServerClient()

  // Verify the connector belongs to this org and is active
  const { data: connector, error: connErr } = await supabase
    .from('integration_connectors')
    .select('id, status')
    .eq('id', parsed.data.connector_id)
    .eq('org_id', ctx.orgId)
    .single()

  if (connErr || !connector) {
    return apiError('Connector not found', 'validation/connector-not-found', 404)
  }

  if (connector.status !== 'active') {
    return apiError('Connector is not active', 'validation/connector-inactive', 400)
  }

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

  const result = await pushToGoogleDocs({
    connectorId: parsed.data.connector_id,
    orgId: ctx.orgId,
    title: parsed.data.title,
    source: sourceBlock as SourceBlock,
    brandKit,
    folderId: parsed.data.folder_id,
    shareWith: parsed.data.share_with,
  })

  if ('error' in result) {
    logger.error('api-google-docs', 'push_failed', {
      org_id: ctx.orgId,
      error: result.error,
    })
    return apiError(result.error, 'google-docs/push-failed', 500)
  }

  return ok(result, 201)
}))
