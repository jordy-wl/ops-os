import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

const SpawnInstanceSchema = z.object({
  template_id: z.string().uuid(),
  source_block_id: z.string().uuid(),
})

/**
 * GET /api/workflow-instances
 * Lists workflow instances for the org.
 * Optional filters: ?status=running, ?template_id=X, ?source_block_id=X
 */
export const GET = withAuth(async (req: NextRequest, ctx) => {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const templateId = searchParams.get('template_id')
  const sourceBlockId = searchParams.get('source_block_id')

  const supabase = createServerClient()

  let query = supabase
    .from('blocks')
    .select('*')
    .eq('org_id', ctx.orgId)
    .eq('type', 'workflow_instance')
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('metadata->>status', status)
  }
  if (templateId) {
    query = query.eq('metadata->>template_id', templateId)
  }
  if (sourceBlockId) {
    query = query.eq('metadata->>source_block_id', sourceBlockId)
  }

  const { data, error } = await query

  if (error) {
    logger.error('api-workflow-instances', 'db.query_failed', { error_code: error.code })
    return apiError('Failed to fetch workflow instances', 'db/query-failed', 500)
  }

  return ok(data)
})

/**
 * POST /api/workflow-instances
 * Spawns a new workflow instance from a template.
 * Body: { template_id, source_block_id }
 */
export const POST = withAuth(requirePermission(['execute_workflows'], async (req: NextRequest, ctx) => {
  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

  const parsed = SpawnInstanceSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const supabase = createServerClient()

  // 1. Verify template exists and is a workflow_template in this org
  const { data: template, error: templateError } = await supabase
    .from('blocks')
    .select('id, name, metadata, type')
    .eq('id', parsed.data.template_id)
    .eq('org_id', ctx.orgId)
    .eq('type', 'workflow_template')
    .single()

  if (templateError || !template) {
    return apiError('Workflow template not found', 'workflow/template-not-found', 404)
  }

  // 2. Verify source block exists in this org
  const { data: sourceBlock, error: sourceError } = await supabase
    .from('blocks')
    .select('id, name, type')
    .eq('id', parsed.data.source_block_id)
    .eq('org_id', ctx.orgId)
    .single()

  if (sourceError || !sourceBlock) {
    return apiError('Source block not found', 'workflow/source-block-not-found', 404)
  }

  const templateMeta = template.metadata as Record<string, unknown>

  // 3. Create workflow_instance Block
  const instanceMetadata = {
    template_id: template.id,
    source_block_id: sourceBlock.id,
    applies_to_type: templateMeta.applies_to_type ?? sourceBlock.type,
    status: 'pending',
    current_step_index: 0,
    step_results: [],
    started_at: null,
    completed_at: null,
  }

  const { data: instance, error: instanceError } = await supabase
    .from('blocks')
    .insert({
      org_id: ctx.orgId,
      type: 'workflow_instance',
      name: `${template.name} → ${sourceBlock.name}`,
      metadata: instanceMetadata,
    })
    .select()
    .single()

  if (instanceError || !instance) {
    logger.error('api-workflow-instances', 'db.insert_failed', { error_code: instanceError?.code })
    return apiError('Failed to create workflow instance', 'db/insert-failed', 500)
  }

  // 4. Create block edges: instance_of (instance → template) and processing (instance → source)
  await supabase.from('block_edges').insert([
    {
      org_id: ctx.orgId,
      from_block_id: instance.id,
      to_block_id: template.id,
      edge_type: 'instance_of',
    },
    {
      org_id: ctx.orgId,
      from_block_id: instance.id,
      to_block_id: sourceBlock.id,
      edge_type: 'processing',
    },
  ])

  // 5. Emit workflow.instance.spawned event
  const { data: event, error: eventError } = await supabase
    .from('events')
    .insert({
      org_id: ctx.orgId,
      block_id: instance.id,
      type: 'workflow.instance.spawned',
      actor_id: ctx.userId,
      actor_type: 'user',
      payload: {
        template_id: template.id,
        template_name: template.name,
        source_block_id: sourceBlock.id,
        source_block_name: sourceBlock.name,
      },
    })
    .select()
    .single()

  if (eventError) {
    logger.error('api-workflow-instances', 'db.event_insert_failed', {
      error_code: eventError.code,
      critical: true,
    })
  }

  return ok({ instance, event: event ?? null }, 201)
}))
