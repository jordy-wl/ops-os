import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { isValidJsonSchema } from '@/lib/validation/json-schema'
import { logger } from '@/lib/logger'
import {
  updateFieldInSchema,
  removeFieldFromSchema,
  type BuiltSchema,
} from '@/lib/block-types/field-schema-builder'
import { VALID_EDGE_TYPE_VALUES } from '@/lib/block-types/field-types'

const UpdateFieldSchema = z
  .object({
    description: z.string().max(200).optional(),
    required: z.boolean().optional(),
    placeholder: z.string().max(200).optional(),
    display_order: z.number().int().min(0).optional(),
    config: z.record(z.unknown()).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  })

/** Helper to fetch type and validate field exists */
async function fetchTypeAndField(
  supabase: ReturnType<typeof createServerClient>,
  orgId: string,
  typeId: string,
  fieldName: string
) {
  const { data: typeDef, error } = await supabase
    .from('block_type_definitions')
    .select('id, type_name, field_schema')
    .eq('id', typeId)
    .eq('org_id', orgId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return { error: 'not-found' as const }
    return { error: 'db-error' as const, code: error.code }
  }

  const schema = (typeDef.field_schema ?? { type: 'object', properties: {} }) as BuiltSchema
  if (!schema.properties) schema.properties = {}

  const field = schema.properties[fieldName]
  if (!field) return { error: 'field-not-found' as const }

  return { typeDef, schema, field }
}

/** PATCH /api/block-types/[id]/fields/[fieldName] — update field properties (ops-admin only) */
export const PATCH = withAuth(
  requirePermission(['manage_blocks'], async (req: NextRequest, ctx, params) => {
    const { id, fieldName } = params
    const body = await req.json().catch(() => null)
    if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

    const parsed = UpdateFieldSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.issues)

    const supabase = createServerClient()
    const result = await fetchTypeAndField(supabase, ctx.orgId, id, fieldName)

    if ('error' in result) {
      if (result.error === 'not-found') return apiError('Block type not found', 'block-types/not-found', 404)
      if (result.error === 'field-not-found') return apiError(`Field "${fieldName}" not found`, 'fields/not-found', 404)
      logger.error('api-fields', 'db.query_failed', { error_code: result.code })
      return apiError('Failed to fetch block type', 'db/query-failed', 500)
    }

    const { schema, field } = result

    // Check system field
    if (field['x-is-system']) {
      return apiError(
        `Field "${fieldName}" is a system field and cannot be modified`,
        'fields/system-protected',
        403
      )
    }

    // Validate edge type if provided in config
    const edgeType = parsed.data.config?.['x-relation-edge-type'] as string | undefined
    if (edgeType && !(VALID_EDGE_TYPE_VALUES as readonly string[]).includes(edgeType)) {
      return apiError(
        `Invalid edge type: ${edgeType}`,
        'validation/invalid-edge-type',
        400
      )
    }

    // Apply updates
    let updatedSchema: BuiltSchema
    try {
      updatedSchema = updateFieldInSchema(schema, fieldName, {
        description: parsed.data.description,
        placeholder: parsed.data.placeholder,
        displayOrder: parsed.data.display_order,
        required: parsed.data.required,
        config: parsed.data.config,
      })
    } catch (e) {
      return apiError((e as Error).message, 'fields/update-failed', 400)
    }

    if (!isValidJsonSchema(updatedSchema)) {
      return apiError('Resulting schema is invalid', 'validation/invalid-schema-result', 400)
    }

    const { error: updateError } = await supabase
      .from('block_type_definitions')
      .update({ field_schema: updatedSchema, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', ctx.orgId)

    if (updateError) {
      logger.error('api-fields', 'db.update_failed', { error_code: updateError.code })
      return apiError('Failed to update block type', 'db/update-failed', 500)
    }

    return ok({ name: fieldName, ...updatedSchema.properties[fieldName] })
  })
)

/** DELETE /api/block-types/[id]/fields/[fieldName] — remove a field (ops-admin only) */
export const DELETE = withAuth(
  requirePermission(['manage_blocks'], async (_req: NextRequest, ctx, params) => {
    const { id, fieldName } = params
    const supabase = createServerClient()
    const result = await fetchTypeAndField(supabase, ctx.orgId, id, fieldName)

    if ('error' in result) {
      if (result.error === 'not-found') return apiError('Block type not found', 'block-types/not-found', 404)
      if (result.error === 'field-not-found') return apiError(`Field "${fieldName}" not found`, 'fields/not-found', 404)
      logger.error('api-fields', 'db.query_failed', { error_code: result.code })
      return apiError('Failed to fetch block type', 'db/query-failed', 500)
    }

    const { schema, field } = result

    if (field['x-is-system']) {
      return apiError(
        `Field "${fieldName}" is a system field and cannot be removed`,
        'fields/system-protected',
        403
      )
    }

    let updatedSchema: BuiltSchema
    try {
      updatedSchema = removeFieldFromSchema(schema, fieldName)
    } catch (e) {
      return apiError((e as Error).message, 'fields/remove-failed', 400)
    }

    const { error: updateError } = await supabase
      .from('block_type_definitions')
      .update({ field_schema: updatedSchema, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', ctx.orgId)

    if (updateError) {
      logger.error('api-fields', 'db.update_failed', { error_code: updateError.code })
      return apiError('Failed to update block type', 'db/update-failed', 500)
    }

    return ok({ deleted: true, field: fieldName })
  })
)
