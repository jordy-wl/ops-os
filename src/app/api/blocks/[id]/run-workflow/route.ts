import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requireRole } from '@/lib/auth/requireRole'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'
import type { WorkflowTemplate } from '@/lib/workflow/template-schema'

const RunWorkflowSchema = z.object({
  template_id: z.string().uuid(),
})

/**
 * POST /api/blocks/[id]/run-workflow
 *
 * Manual trigger: spawn a workflow instance for this block from the given template.
 * Validates the template exists, is a workflow_template, and applies to this block's type.
 */
export const POST = withAuth(requireRole(['ops-admin', 'ops-user'], async (req: NextRequest, ctx, params) => {
  const { id: blockId } = params
  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

  const parsed = RunWorkflowSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const supabase = createServerClient()

  // 1. Verify the block exists and belongs to this org
  const { data: block, error: blockError } = await supabase
    .from('blocks')
    .select('id, type, name')
    .eq('id', blockId)
    .eq('org_id', ctx.orgId)
    .single()

  if (blockError?.code === 'PGRST116' || !block) {
    return apiError('Block not found', 'blocks/not-found', 404)
  }
  if (blockError) {
    logger.error('api-run-workflow', 'db.block_query_failed', { error_code: blockError.code })
    return apiError('Failed to fetch block', 'db/query-failed', 500)
  }

  // 2. Verify the template exists and is a workflow_template
  const { data: template, error: templateError } = await supabase
    .from('blocks')
    .select('id, metadata, name')
    .eq('id', parsed.data.template_id)
    .eq('type', 'workflow_template')
    .single()

  if (templateError?.code === 'PGRST116' || !template) {
    return apiError('Workflow template not found', 'workflow/template-not-found', 404)
  }
  if (templateError) {
    logger.error('api-run-workflow', 'db.template_query_failed', { error_code: templateError.code })
    return apiError('Failed to fetch template', 'db/query-failed', 500)
  }

  // 3. Check template applies to this block type
  const tmplMeta = template.metadata as WorkflowTemplate
  if (tmplMeta.applies_to_type !== block.type) {
    return apiError(
      `Template applies to "${tmplMeta.applies_to_type}" but block is "${block.type}"`,
      'workflow/type-mismatch',
      422
    )
  }

  // 4. Check template has a manual trigger (or allow any trigger type for manual runs)
  // Manual runs are always allowed regardless of trigger type — the trigger config
  // only controls auto-spawning. This matches the spec in backend-tasks.md.

  // 5. Spawn the workflow instance
  const now = new Date().toISOString()
  const instanceName = `${template.name ?? 'Workflow'} — ${block.name ?? blockId}`

  const { data: instance, error: insertError } = await supabase
    .from('blocks')
    .insert({
      org_id: ctx.orgId,
      type: 'workflow_instance',
      name: instanceName.slice(0, 255),
      metadata: {
        template_id: template.id,
        source_block_id: blockId,
        applies_to_type: block.type,
        status: 'pending',
        current_step_index: 0,
        step_results: [],
        started_at: null,
        completed_at: null,
      },
    })
    .select()
    .single()

  if (insertError || !instance) {
    logger.error('api-run-workflow', 'db.instance_insert_failed', { error_code: insertError?.code })
    return apiError('Failed to create workflow instance', 'db/insert-failed', 500)
  }

  // 6. Create block edges: instance_of + processing
  await supabase.from('block_edges').insert([
    { org_id: ctx.orgId, from_block_id: instance.id, to_block_id: template.id, type: 'instance_of' },
    { org_id: ctx.orgId, from_block_id: instance.id, to_block_id: blockId, type: 'processing' },
  ])

  // 7. Emit spawned event
  const { data: event } = await supabase
    .from('events')
    .insert({
      org_id: ctx.orgId,
      block_id: instance.id,
      type: 'workflow.instance.spawned',
      actor_id: ctx.userId,
      actor_type: 'human',
      payload: {
        template_id: template.id,
        source_block_id: blockId,
        trigger_type: 'manual',
        spawned_at: now,
      },
    })
    .select()
    .single()

  return ok({ instance, event: event ?? null }, 201)
}))
