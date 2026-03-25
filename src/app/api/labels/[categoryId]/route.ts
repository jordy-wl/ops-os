import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import type { Permission } from '@/lib/rbac/types'

const PatchCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
})

/**
 * GET /api/labels/[categoryId] — get a single label category with its values
 */
export const GET = withAuth(
  requirePermission(['manage_settings' as Permission], async (_req, ctx, params) => {
    const supabase = createServerClient()

    const { data: category, error } = await supabase
      .from('label_categories')
      .select('*, label_values(*)')
      .eq('id', params.categoryId)
      .eq('org_id', ctx.orgId)
      .single()

    if (error || !category) {
      return apiError('Label category not found', 'labels/category-not-found', 404)
    }

    // Sort label_values by sort_order
    const result = {
      ...category,
      label_values: ((category.label_values as Array<Record<string, unknown>>) ?? []).sort(
        (a, b) => ((a.sort_order as number) ?? 0) - ((b.sort_order as number) ?? 0)
      ),
    }

    return ok(result)
  })
)

/**
 * PATCH /api/labels/[categoryId] — update a label category
 * Slug changes are not allowed.
 */
export const PATCH = withAuth(
  requirePermission(['manage_settings' as Permission], async (req, ctx, params) => {
    const body = await req.json().catch(() => null)
    if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

    const parsed = PatchCategorySchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.issues)

    const supabase = createServerClient()

    // Verify category exists and belongs to this org
    const { data: existing, error: fetchError } = await supabase
      .from('label_categories')
      .select('id')
      .eq('id', params.categoryId)
      .eq('org_id', ctx.orgId)
      .single()

    if (fetchError || !existing) {
      return apiError('Label category not found', 'labels/category-not-found', 404)
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (parsed.data.name !== undefined) updatePayload.name = parsed.data.name
    if (parsed.data.description !== undefined) updatePayload.description = parsed.data.description
    if (parsed.data.color !== undefined) updatePayload.color = parsed.data.color

    const { data: category, error: updateError } = await supabase
      .from('label_categories')
      .update(updatePayload)
      .eq('id', params.categoryId)
      .select('*, label_values(*)')
      .single()

    if (updateError || !category) {
      logger.error('labels', 'label_category.update_failed', {
        org_id: ctx.orgId,
        category_id: params.categoryId,
        error_code: updateError?.code,
      })
      return apiError('Failed to update label category', 'labels/update-failed', 500)
    }

    logger.info('labels', 'label_category.updated', {
      org_id: ctx.orgId,
      category_id: params.categoryId,
      fields_updated: Object.keys(parsed.data),
    })

    return ok(category)
  })
)

/**
 * DELETE /api/labels/[categoryId] — delete a label category
 * Cascades to label_values and label_assignments via FK constraints.
 */
export const DELETE = withAuth(
  requirePermission(['manage_settings' as Permission], async (_req, ctx, params) => {
    const supabase = createServerClient()

    // Verify category exists and belongs to this org
    const { data: existing, error: fetchError } = await supabase
      .from('label_categories')
      .select('id, name, slug')
      .eq('id', params.categoryId)
      .eq('org_id', ctx.orgId)
      .single()

    if (fetchError || !existing) {
      return apiError('Label category not found', 'labels/category-not-found', 404)
    }

    const { error: deleteError } = await supabase
      .from('label_categories')
      .delete()
      .eq('id', params.categoryId)

    if (deleteError) {
      logger.error('labels', 'label_category.delete_failed', {
        org_id: ctx.orgId,
        category_id: params.categoryId,
        error_code: deleteError.code,
      })
      return apiError('Failed to delete label category', 'labels/delete-failed', 500)
    }

    logger.info('labels', 'label_category.deleted', {
      org_id: ctx.orgId,
      category_id: params.categoryId,
      slug: existing.slug,
    })

    return ok({ deleted: true })
  })
)
