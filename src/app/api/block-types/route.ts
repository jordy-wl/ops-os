import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { isValidJsonSchema } from '@/lib/validation/json-schema'
import { logger } from '@/lib/logger'

const CreateBlockTypeSchema = z.object({
  type_name: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z][a-z0-9_]*$/, 'Must be lowercase snake_case starting with a letter'),
  display_name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  field_schema: z.record(z.unknown()).default({}),
  icon: z.string().max(50).default('box'),
  color: z.string().max(20).default('gray'),
})

/** GET /api/block-types — list all block type definitions for the org */
export const GET = withAuth(async (_req: NextRequest, ctx) => {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('block_type_definitions')
    .select('*')
    .eq('org_id', ctx.orgId)
    .order('type_name', { ascending: true })

  if (error) {
    logger.error('api-block-types', 'db.query_failed', { error_code: error.code })
    return apiError('Failed to fetch block types', 'db/query-failed', 500)
  }

  return ok(data)
})

/** POST /api/block-types — create a new block type definition (ops-admin only) */
export const POST = withAuth(
  requirePermission(['manage_blocks'], async (req: NextRequest, ctx) => {
    const body = await req.json().catch(() => null)
    if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

    const parsed = CreateBlockTypeSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.issues)

    // Validate field_schema is a valid JSON Schema document
    const schema = parsed.data.field_schema
    if (Object.keys(schema).length > 0 && !isValidJsonSchema(schema)) {
      return apiError(
        'field_schema is not a valid JSON Schema',
        'validation/invalid-field-schema',
        400
      )
    }

    const supabase = createServerClient()

    const { data, error } = await supabase
      .from('block_type_definitions')
      .insert({
        org_id: ctx.orgId,
        type_name: parsed.data.type_name,
        display_name: parsed.data.display_name,
        description: parsed.data.description,
        field_schema: parsed.data.field_schema,
        icon: parsed.data.icon,
        color: parsed.data.color,
      })
      .select()
      .single()

    if (error?.code === '23505') {
      return apiError(
        `Block type "${parsed.data.type_name}" already exists`,
        'block-types/duplicate',
        409
      )
    }

    if (error || !data) {
      logger.error('api-block-types', 'db.insert_failed', { error_code: error?.code })
      return apiError('Failed to create block type', 'db/insert-failed', 500)
    }

    return ok(data, 201)
  })
)
