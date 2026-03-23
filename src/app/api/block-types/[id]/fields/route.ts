import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { isValidJsonSchema } from '@/lib/validation/json-schema'
import { logger } from '@/lib/logger'
import { isValidFieldType, FIELD_TYPE_DEFINITIONS, VALID_EDGE_TYPE_VALUES } from '@/lib/block-types/field-types'
import {
  addFieldToSchema,
  extractFieldsFromSchema,
  type BuiltSchema,
} from '@/lib/block-types/field-schema-builder'

const AddFieldSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z][a-z0-9_]*$/, 'Must be lowercase snake_case starting with a letter'),
  field_type: z.string().min(1),
  description: z.string().max(200).optional(),
  required: z.boolean().default(false),
  placeholder: z.string().max(200).optional(),
  config: z.record(z.unknown()).optional(),
})

/** GET /api/block-types/[id]/fields — list fields sorted by display order */
export const GET = withAuth(async (_req: NextRequest, ctx, params) => {
  const { id } = params
  const supabase = createServerClient()

  const { data: typeDef, error } = await supabase
    .from('block_type_definitions')
    .select('id, field_schema')
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return apiError('Block type not found', 'block-types/not-found', 404)
    logger.error('api-fields', 'db.query_failed', { error_code: error.code })
    return apiError('Failed to fetch block type', 'db/query-failed', 500)
  }

  const schema = (typeDef.field_schema ?? { type: 'object', properties: {} }) as BuiltSchema
  const fields = extractFieldsFromSchema(schema)

  return ok(fields)
})

/** POST /api/block-types/[id]/fields — add a new field (ops-admin only) */
export const POST = withAuth(
  requirePermission(['manage_blocks'], async (req: NextRequest, ctx, params) => {
    const { id } = params
    const body = await req.json().catch(() => null)
    if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

    const parsed = AddFieldSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.issues)

    if (!isValidFieldType(parsed.data.field_type)) {
      return apiError(
        `Invalid field type: ${parsed.data.field_type}`,
        'validation/invalid-field-type',
        400
      )
    }

    const supabase = createServerClient()

    // Fetch the block type
    const { data: typeDef, error: fetchError } = await supabase
      .from('block_type_definitions')
      .select('id, type_name, field_schema')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') return apiError('Block type not found', 'block-types/not-found', 404)
      logger.error('api-fields', 'db.query_failed', { error_code: fetchError.code })
      return apiError('Failed to fetch block type', 'db/query-failed', 500)
    }

    const schema = (typeDef.field_schema ?? { type: 'object', properties: {} }) as BuiltSchema
    if (!schema.properties) schema.properties = {}

    // Check for duplicate field name
    if (schema.properties[parsed.data.name]) {
      return apiError(
        `Field "${parsed.data.name}" already exists`,
        'fields/duplicate',
        409
      )
    }

    // Validate relation fields (both relation and multi-relation)
    const isRelationType =
      parsed.data.field_type === 'relation' || parsed.data.field_type === 'multi-relation'

    if (isRelationType) {
      const target = parsed.data.config?.['x-relation-target'] as string | undefined
      if (!target) {
        return apiError(
          'Relation fields require x-relation-target in config',
          'validation/missing-relation-target',
          400
        )
      }

      // Prevent self-referencing
      if (target === typeDef.type_name) {
        return apiError(
          'Relation fields cannot reference their own block type',
          'validation/self-reference',
          400
        )
      }

      // Validate target type exists
      const { data: targetType, error: targetError } = await supabase
        .from('block_type_definitions')
        .select('id')
        .eq('org_id', ctx.orgId)
        .eq('type_name', target)
        .single()

      if (targetError || !targetType) {
        return apiError(
          `Relation target type "${target}" does not exist`,
          'validation/invalid-relation-target',
          400
        )
      }

      // Validate edge type if provided
      const edgeType = parsed.data.config?.['x-relation-edge-type'] as string | undefined
      if (edgeType && !(VALID_EDGE_TYPE_VALUES as readonly string[]).includes(edgeType)) {
        return apiError(
          `Invalid edge type: ${edgeType}`,
          'validation/invalid-edge-type',
          400
        )
      }
    }

    // Build updated schema
    const updatedSchema = addFieldToSchema(schema, {
      name: parsed.data.name,
      fieldType: parsed.data.field_type as Parameters<typeof addFieldToSchema>[1]['fieldType'],
      description: parsed.data.description,
      required: parsed.data.required,
      placeholder: parsed.data.placeholder,
      config: parsed.data.config,
    })

    // Validate the resulting schema
    if (!isValidJsonSchema(updatedSchema)) {
      return apiError(
        'Resulting schema is invalid',
        'validation/invalid-schema-result',
        400
      )
    }

    // Persist
    const { error: updateError } = await supabase
      .from('block_type_definitions')
      .update({ field_schema: updatedSchema, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', ctx.orgId)

    if (updateError) {
      logger.error('api-fields', 'db.update_failed', { error_code: updateError.code })
      return apiError('Failed to update block type', 'db/update-failed', 500)
    }

    const newField = updatedSchema.properties[parsed.data.name]
    return ok({ name: parsed.data.name, ...newField }, 201)
  })
)
