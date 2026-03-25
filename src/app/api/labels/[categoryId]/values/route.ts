import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import type { Permission } from '@/lib/rbac/types'

const CreateValueSchema = z.object({
  value: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).optional(),
  sort_order: z.number().int().default(0),
})

const PatchValueSchema = z.object({
  value_id: z.string().uuid(),
  value: z.string().min(1).max(100).optional(),
  sort_order: z.number().int().optional(),
})

/**
 * POST /api/labels/[categoryId]/values — create a label value in the category
 */
export const POST = withAuth(
  requirePermission(['manage_settings' as Permission], async (req, ctx, params) => {
    const body = await req.json().catch(() => null)
    if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

    const parsed = CreateValueSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.issues)

    const supabase = createServerClient()

    // Verify category exists and belongs to this org
    const { data: category, error: catError } = await supabase
      .from('label_categories')
      .select('id')
      .eq('id', params.categoryId)
      .eq('org_id', ctx.orgId)
      .single()

    if (catError || !category) {
      return apiError('Label category not found', 'labels/category-not-found', 404)
    }

    const { value, sort_order } = parsed.data
    const slug =
      parsed.data.slug ??
      value
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')

    const { data: labelValue, error } = await supabase
      .from('label_values')
      .insert({
        category_id: params.categoryId,
        org_id: ctx.orgId,
        value,
        slug,
        sort_order,
      })
      .select('*')
      .single()

    if (error) {
      if (error.code === '23505') {
        return apiError(
          'A label value with this slug already exists in the category',
          'labels/duplicate-value-slug',
          409
        )
      }
      logger.error('labels', 'label_value.create_failed', {
        org_id: ctx.orgId,
        category_id: params.categoryId,
        error_code: error.code,
      })
      return apiError('Failed to create label value', 'labels/value-create-failed', 500)
    }

    logger.info('labels', 'label_value.created', {
      org_id: ctx.orgId,
      category_id: params.categoryId,
      value_id: labelValue.id,
      slug,
    })

    return ok(labelValue, 201)
  })
)

/**
 * PATCH /api/labels/[categoryId]/values — update a label value
 * Requires value_id in the request body.
 */
export const PATCH = withAuth(
  requirePermission(['manage_settings' as Permission], async (req, ctx, params) => {
    const body = await req.json().catch(() => null)
    if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

    const parsed = PatchValueSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.issues)

    const supabase = createServerClient()

    // Verify the value belongs to this category and org
    const { data: existing, error: fetchError } = await supabase
      .from('label_values')
      .select('id, category_id')
      .eq('id', parsed.data.value_id)
      .eq('category_id', params.categoryId)
      .eq('org_id', ctx.orgId)
      .single()

    if (fetchError || !existing) {
      return apiError('Label value not found', 'labels/value-not-found', 404)
    }

    const updatePayload: Record<string, unknown> = {}
    if (parsed.data.value !== undefined) updatePayload.value = parsed.data.value
    if (parsed.data.sort_order !== undefined) updatePayload.sort_order = parsed.data.sort_order

    if (Object.keys(updatePayload).length === 0) {
      return apiError('No fields to update', 'validation/empty-update', 400)
    }

    const { data: labelValue, error: updateError } = await supabase
      .from('label_values')
      .update(updatePayload)
      .eq('id', parsed.data.value_id)
      .select('*')
      .single()

    if (updateError || !labelValue) {
      logger.error('labels', 'label_value.update_failed', {
        org_id: ctx.orgId,
        value_id: parsed.data.value_id,
        error_code: updateError?.code,
      })
      return apiError('Failed to update label value', 'labels/value-update-failed', 500)
    }

    logger.info('labels', 'label_value.updated', {
      org_id: ctx.orgId,
      category_id: params.categoryId,
      value_id: parsed.data.value_id,
      fields_updated: Object.keys(updatePayload),
    })

    return ok(labelValue)
  })
)

/**
 * DELETE /api/labels/[categoryId]/values?value_id=<uuid> — delete a label value
 * Cascades to label_assignments via FK constraints.
 */
export const DELETE = withAuth(
  requirePermission(['manage_settings' as Permission], async (req, ctx, params) => {
    const url = new URL(req.url)
    const valueId = url.searchParams.get('value_id')

    if (!valueId) {
      return apiError('Missing required query parameter: value_id', 'validation/missing-param', 400)
    }

    const supabase = createServerClient()

    // Verify the value belongs to this category and org
    const { data: existing, error: fetchError } = await supabase
      .from('label_values')
      .select('id, value, slug')
      .eq('id', valueId)
      .eq('category_id', params.categoryId)
      .eq('org_id', ctx.orgId)
      .single()

    if (fetchError || !existing) {
      return apiError('Label value not found', 'labels/value-not-found', 404)
    }

    const { error: deleteError } = await supabase
      .from('label_values')
      .delete()
      .eq('id', valueId)

    if (deleteError) {
      logger.error('labels', 'label_value.delete_failed', {
        org_id: ctx.orgId,
        value_id: valueId,
        error_code: deleteError.code,
      })
      return apiError('Failed to delete label value', 'labels/value-delete-failed', 500)
    }

    logger.info('labels', 'label_value.deleted', {
      org_id: ctx.orgId,
      category_id: params.categoryId,
      value_id: valueId,
      slug: existing.slug,
    })

    return ok({ deleted: true })
  })
)
