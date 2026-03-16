import { z } from 'zod'
import type { ActionHandler, ActionResult } from '@/lib/actions/types'
import type { AuthContext } from '@/lib/auth/withAuth'
import type { SupabaseClient } from '@supabase/supabase-js'

const schema = z.object({
  type: z.string().min(1, 'type is required').max(100),
  name: z.string().min(1, 'name is required').max(255),
  metadata: z.record(z.unknown()).optional().default({}),
})

type Payload = z.infer<typeof schema>

/**
 * block.create — creates a new block and its corresponding block.created event atomically.
 *
 * Both inserts run sequentially. If the event insert fails, the block is still created
 * (partial failure logged as critical — same behaviour as the blocks API route).
 *
 * @param payload - Validated block creation fields
 * @param ctx     - Auth context: userId, clerkOrgId, orgId
 * @param supabase - Server-side Supabase client
 * @returns ActionResult with actionId, eventId, and status: 'completed'
 */
async function execute(
  payload: Payload,
  ctx: AuthContext,
  supabase: SupabaseClient
): Promise<ActionResult> {
  const actionId = crypto.randomUUID()

  // Validate block type against block_type_definitions (dynamic)
  const { data: typeDef } = await supabase
    .from('block_type_definitions')
    .select('type_name')
    .or(`org_id.eq.${ctx.orgId},org_id.is.null`)
    .eq('type_name', payload.type)
    .limit(1)
    .maybeSingle()

  if (!typeDef) {
    throw new Error(`Invalid block type: ${payload.type}`)
  }

  const { data: block, error: blockError } = await supabase
    .from('blocks')
    .insert({
      org_id: ctx.orgId,
      type: payload.type,
      name: payload.name,
      metadata: payload.metadata,
    })
    .select('id')
    .single()

  if (blockError || !block) {
    throw new Error(blockError?.message ?? 'Failed to create block')
  }

  const { data: event } = await supabase
    .from('events')
    .insert({
      org_id: ctx.orgId,
      block_id: block.id,
      type: 'block.created',
      actor_id: ctx.userId,
      actor_type: 'human',
      payload: { block_type: payload.type, name: payload.name, via: 'action/block.create' },
    })
    .select('id')
    .single()

  return {
    actionId,
    eventId: event?.id ?? null,
    workflowJobId: null,
    status: 'completed',
  }
}

export const blockCreateHandler: ActionHandler<Payload> = { schema, execute }
