import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'
import { WorkflowTemplateSchema } from '@/lib/workflow/template-schema'
import { getFieldSchema, validateFields } from '@/lib/blocks/validation'

const CreateBlockBaseSchema = z.object({
  type: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  metadata: z.record(z.unknown()).optional().default({}),
})

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const q = searchParams.get('q')
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

  if (q) {
    query = query.ilike('name', `%${q}%`)
  }

  const { data, error } = await query

  if (error) {
    logger.error('api-blocks', 'db.query_failed', { error_code: error.code })
    return apiError('Failed to fetch blocks', 'db/query-failed', 500)
  }

  return ok(data)
})

export const POST = withAuth(requirePermission(['manage_blocks'], async (req: NextRequest, ctx) => {
  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

  const parsed = CreateBlockBaseSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const supabase = createServerClient()

  // Validate block type against block_type_definitions table (dynamic, not hardcoded)
  const { data: typeDef, error: typeError } = await supabase
    .from('block_type_definitions')
    .select('type_name')
    .or(`org_id.eq.${ctx.orgId},org_id.is.null`)
    .eq('type_name', parsed.data.type)
    .limit(1)
    .maybeSingle()

  if (typeError) {
    logger.error('api-blocks', 'db.type_lookup_failed', { error_code: typeError.code })
    return apiError('Failed to validate block type', 'db/type-lookup-failed', 500)
  }

  if (!typeDef) {
    return apiError(`Invalid block type: ${parsed.data.type}`, 'validation/invalid-type', 400)
  }

  // Validate workflow template metadata shape
  if (parsed.data.type === 'workflow_template') {
    const templateParsed = WorkflowTemplateSchema.safeParse(parsed.data.metadata)
    if (!templateParsed.success) return validationError(templateParsed.error.issues)
  }

  // Validate metadata fields against the type's field_schema
  if (parsed.data.metadata && Object.keys(parsed.data.metadata).length > 0) {
    const fieldSchema = await getFieldSchema(ctx.orgId, parsed.data.type)
    if (fieldSchema) {
      const fieldErrors = validateFields(fieldSchema, parsed.data.metadata as Record<string, unknown>)
      if (fieldErrors.length > 0) {
        return apiError(
          `Field validation failed: ${fieldErrors.map((e) => e.message).join('; ')}`,
          'validation/invalid-fields',
          400
        )
      }
    }
  }

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
