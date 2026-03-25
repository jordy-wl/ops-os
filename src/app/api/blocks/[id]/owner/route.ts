import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

const UpdateOwnerSchema = z.object({
  owner_id: z.string().uuid().nullable(),
})

/**
 * PATCH /api/blocks/[id]/owner — set or clear the owner of a block.
 *
 * The owner_id must reference a block of type 'team_member' in the same org,
 * or be null to clear the owner.
 */
export const PATCH = withAuth(
  requirePermission(['manage_blocks'], async (req: NextRequest, ctx, params) => {
    const { id } = params
    const body = await req.json().catch(() => null)
    if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

    const parsed = UpdateOwnerSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.issues)

    const { owner_id } = parsed.data
    const supabase = createServerClient()

    // 1. Verify the block exists and belongs to this org
    const { data: block, error: blockError } = await supabase
      .from('blocks')
      .select('id, owner_id')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .single()

    if (blockError) {
      if (blockError.code === 'PGRST116') {
        return apiError('Block not found', 'blocks/not-found', 404)
      }
      logger.error('api-blocks-owner', 'db.query_failed', { error_code: blockError.code })
      return apiError('Failed to fetch block', 'db/query-failed', 500)
    }
    if (!block) return apiError('Block not found', 'blocks/not-found', 404)

    // 2. If setting an owner, verify it's a team_member block in the same org
    if (owner_id !== null) {
      const { data: teamMember, error: tmError } = await supabase
        .from('blocks')
        .select('id')
        .eq('id', owner_id)
        .eq('org_id', ctx.orgId)
        .eq('type', 'team_member')
        .single()

      if (tmError || !teamMember) {
        return apiError(
          'Owner must be a team_member block in the same organisation',
          'validation/invalid-owner',
          400
        )
      }
    }

    const previousOwnerId = block.owner_id ?? null

    // 3. Update the block's owner_id
    const { error: updateError } = await supabase
      .from('blocks')
      .update({ owner_id, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', ctx.orgId)

    if (updateError) {
      logger.error('api-blocks-owner', 'db.update_failed', { error_code: updateError.code })
      return apiError('Failed to update owner', 'db/update-failed', 500)
    }

    // 4. Insert audit event
    const { error: eventError } = await supabase.from('events').insert({
      org_id: ctx.orgId,
      block_id: id,
      type: 'block.owner.changed',
      actor_id: ctx.userId,
      actor_type: 'human',
      payload: { previous_owner_id: previousOwnerId, new_owner_id: owner_id },
    })

    if (eventError) {
      logger.error('api-blocks-owner', 'db.event_insert_failed', {
        error_code: eventError.code,
        critical: true,
      })
    }

    logger.info('api-blocks-owner', 'block.owner.changed', {
      block_id: id,
      previous_owner_id: previousOwnerId,
      new_owner_id: owner_id,
    })

    return ok({ owner_id })
  })
)
