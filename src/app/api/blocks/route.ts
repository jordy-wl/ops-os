import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requireRole } from '@/lib/auth/requireRole'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'
import { WorkflowTemplateSchema } from '@/lib/workflow/template-schema'

const BLOCK_TYPES = ['client', 'deal', 'project', 'contact', 'contract', 'workflow_template', 'workflow_instance', 'task_queue_item'] as const

const CreateBlockSchema = z.object({
  type: z.enum(BLOCK_TYPES),
  name: z.string().min(1).max(255),
  metadata: z.record(z.unknown()).optional().default({}),
})

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)

  const supabase = createServerClient()
  let query = supabase
    .from('blocks')
    .select('*')
    .eq('org_id', ctx.orgId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (type) {
    query = query.eq('type', type)
  }

  const { data, error } = await query

  if (error) {
    logger.error('api-blocks', 'db.query_failed', { error_code: error.code })
    return apiError('Failed to fetch blocks', 'db/query-failed', 500)
  }

  return ok(data)
})

export const POST = withAuth(requireRole(['ops-admin', 'ops-user'], async (req: NextRequest, ctx) => {
  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

  const parsed = CreateBlockSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  // Validate workflow template metadata shape
  if (parsed.data.type === 'workflow_template') {
    const templateParsed = WorkflowTemplateSchema.safeParse(parsed.data.metadata)
    if (!templateParsed.success) return validationError(templateParsed.error.issues)
  }

  const supabase = createServerClient()

  // Atomic: block + audit event in a single transaction via Postgres function
  const { data: result, error: rpcError } = await supabase.rpc('create_block_with_event', {
    p_org_id: ctx.orgId,
    p_type: parsed.data.type,
    p_name: parsed.data.name,
    p_metadata: parsed.data.metadata,
    p_actor_id: ctx.userId,
    p_actor_type: 'human',
  })

  if (rpcError || !result) {
    logger.error('api-blocks', 'db.insert_failed', { error_code: rpcError?.code })
    return apiError('Failed to create block', 'db/insert-failed', 500)
  }

  return ok({ block: result.block, event: result.event }, 201)
}))
