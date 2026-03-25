import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import type { Permission } from '@/lib/rbac/types'

const CreateCategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
})

/**
 * GET /api/labels — list all label categories with their values for the org
 */
export const GET = withAuth(
  requirePermission(['manage_settings' as Permission], async (_req, ctx) => {
    const supabase = createServerClient()

    const { data: categories, error } = await supabase
      .from('label_categories')
      .select('*, label_values(*)')
      .eq('org_id', ctx.orgId)
      .order('name', { ascending: true })

    if (error) {
      logger.error('labels', 'label_category.list_failed', {
        org_id: ctx.orgId,
        error_code: error.code,
      })
      return apiError('Failed to list label categories', 'labels/list-failed', 500)
    }

    // Sort label_values by sort_order within each category
    const result = (categories ?? []).map((cat) => ({
      ...cat,
      label_values: ((cat.label_values as Array<Record<string, unknown>>) ?? []).sort(
        (a, b) => ((a.sort_order as number) ?? 0) - ((b.sort_order as number) ?? 0)
      ),
    }))

    return ok(result)
  })
)

/**
 * POST /api/labels — create a new label category
 */
export const POST = withAuth(
  requirePermission(['manage_settings' as Permission], async (req, ctx) => {
    const body = await req.json().catch(() => null)
    if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

    const parsed = CreateCategorySchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.issues)

    const { name, description, color } = parsed.data
    const slug =
      parsed.data.slug ??
      name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')

    const supabase = createServerClient()

    const { data: category, error } = await supabase
      .from('label_categories')
      .insert({
        org_id: ctx.orgId,
        name,
        slug,
        description: description ?? null,
        color: color ?? null,
      })
      .select('*')
      .single()

    if (error) {
      if (error.code === '23505') {
        return apiError(
          'A label category with this slug already exists',
          'labels/duplicate-slug',
          409
        )
      }
      logger.error('labels', 'label_category.create_failed', {
        org_id: ctx.orgId,
        error_code: error.code,
      })
      return apiError('Failed to create label category', 'labels/create-failed', 500)
    }

    logger.info('labels', 'label_category.created', {
      org_id: ctx.orgId,
      category_id: category.id,
      slug,
    })

    return ok(category, 201)
  })
)
