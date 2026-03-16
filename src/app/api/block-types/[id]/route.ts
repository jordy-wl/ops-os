import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { isValidJsonSchema } from '@/lib/validation/json-schema'
import { logger } from '@/lib/logger'

const UpdateBlockTypeSchema = z
  .object({
    display_name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    field_schema: z.record(z.unknown()).optional(),
    icon: z.string().max(50).optional(),
    color: z.string().max(20).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  })

/** PATCH /api/block-types/[id] — update a block type definition (ops-admin only) */
export const PATCH = withAuth(
  requirePermission(['manage_blocks'], async (req: NextRequest, ctx, params) => {
    const { id } = params
    const body = await req.json().catch(() => null)
    if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

    const parsed = UpdateBlockTypeSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.issues)

    // Validate field_schema if provided
    if (parsed.data.field_schema) {
      const schema = parsed.data.field_schema
      if (Object.keys(schema).length > 0 && !isValidJsonSchema(schema)) {
        return apiError(
          'field_schema is not a valid JSON Schema',
          'validation/invalid-field-schema',
          400
        )
      }
    }

    const supabase = createServerClient()

    // Verify the type exists and belongs to this org
    const { data: existing, error: fetchError } = await supabase
      .from('block_type_definitions')
      .select('id, is_system')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') return apiError('Block type not found', 'block-types/not-found', 404)
      logger.error('api-block-types', 'db.query_failed', { error_code: fetchError.code })
      return apiError('Failed to fetch block type', 'db/query-failed', 500)
    }
    if (!existing) return apiError('Block type not found', 'block-types/not-found', 404)

    const { data: updated, error: updateError } = await supabase
      .from('block_type_definitions')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .select()
      .single()

    if (updateError || !updated) {
      logger.error('api-block-types', 'db.update_failed', { error_code: updateError?.code })
      return apiError('Failed to update block type', 'db/update-failed', 500)
    }

    return ok(updated)
  })
)

/** DELETE /api/block-types/[id] — delete a block type definition (ops-admin only) */
export const DELETE = withAuth(
  requirePermission(['manage_blocks'], async (_req: NextRequest, ctx, params) => {
    const { id } = params
    const supabase = createServerClient()

    // Fetch the type to get its type_name
    const { data: typeDef, error: fetchError } = await supabase
      .from('block_type_definitions')
      .select('id, type_name, is_system')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') return apiError('Block type not found', 'block-types/not-found', 404)
      logger.error('api-block-types', 'db.query_failed', { error_code: fetchError.code })
      return apiError('Failed to fetch block type', 'db/query-failed', 500)
    }
    if (!typeDef) return apiError('Block type not found', 'block-types/not-found', 404)

    // Prevent deletion of system types
    if (typeDef.is_system) {
      return apiError('Cannot delete a system block type', 'block-types/system-protected', 403)
    }

    // Check if any blocks use this type
    const { count, error: countError } = await supabase
      .from('blocks')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', ctx.orgId)
      .eq('type', typeDef.type_name)

    if (countError) {
      logger.error('api-block-types', 'db.count_failed', { error_code: countError.code })
      return apiError('Failed to check block usage', 'db/query-failed', 500)
    }

    if (count && count > 0) {
      return apiError(
        `Cannot delete: ${count} block(s) use type "${typeDef.type_name}"`,
        'block-types/in-use',
        409
      )
    }

    const { error: deleteError } = await supabase
      .from('block_type_definitions')
      .delete()
      .eq('id', id)
      .eq('org_id', ctx.orgId)

    if (deleteError) {
      logger.error('api-block-types', 'db.delete_failed', { error_code: deleteError.code })
      return apiError('Failed to delete block type', 'db/delete-failed', 500)
    }

    return ok({ deleted: true })
  })
)
