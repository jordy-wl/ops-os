import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

const ORG_LEVELS = ['org', 'suborg', 'department', 'team'] as const

const PatchOrgSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  org_level: z.enum(ORG_LEVELS).optional(),
  parent_org_id: z.string().uuid().nullable().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' })

/**
 * GET /api/org/:id
 * Get a single org node.
 */
export const GET = withAuth(async (_req, ctx, params) => {
  const supabase = createServerClient()

  const { data: org, error } = await supabase
    .from('orgs')
    .select('id, name, slug, org_level, parent_org_id, created_at')
    .eq('id', params.id)
    .single()

  if (error || !org) {
    return apiError('Organisation not found', 'org/not-found', 404)
  }

  return ok(org)
})

/**
 * PATCH /api/org/:id
 * Update org name, level, or parent. The DB trigger enforces depth constraints
 * and prevents cycles on reparent.
 */
export const PATCH = withAuth(requirePermission(['manage_settings'], async (req: NextRequest, ctx, params) => {
  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

  const parsed = PatchOrgSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const supabase = createServerClient()

  // Verify org exists
  const { data: existing, error: fetchErr } = await supabase
    .from('orgs')
    .select('id, org_level, parent_org_id')
    .eq('id', params.id)
    .single()

  if (fetchErr || !existing) {
    return apiError('Organisation not found', 'org/not-found', 404)
  }

  // Prevent reparenting to self
  if (parsed.data.parent_org_id === params.id) {
    return apiError('Cannot set an org as its own parent', 'org/self-reference', 400)
  }

  // Prevent reparenting to a descendant (cycle detection)
  if (parsed.data.parent_org_id) {
    const { data: descendants } = await supabase.rpc('get_org_hierarchy', {
      root_org_id: params.id,
    })
    if (descendants?.some((d: { id: string }) => d.id === parsed.data.parent_org_id)) {
      return apiError('Cannot reparent to a descendant — this would create a cycle', 'org/cycle-detected', 400)
    }
  }

  // Build update payload
  const updates: Record<string, unknown> = {}
  if (parsed.data.name !== undefined) updates.name = parsed.data.name
  if (parsed.data.org_level !== undefined) updates.org_level = parsed.data.org_level
  if (parsed.data.parent_org_id !== undefined) updates.parent_org_id = parsed.data.parent_org_id

  const { data: updated, error: updateErr } = await supabase
    .from('orgs')
    .update(updates)
    .eq('id', params.id)
    .select('id, name, slug, org_level, parent_org_id')
    .single()

  if (updateErr) {
    if (updateErr.message?.includes('exceed')) {
      return apiError('Organisation hierarchy cannot exceed 4 levels', 'org/depth-exceeded', 400)
    }
    logger.error('api-org', 'db.update_failed', { error_code: updateErr.code })
    return apiError('Failed to update org', 'db/update-failed', 500)
  }

  return ok(updated)
}))

/**
 * DELETE /api/org/:id
 * Delete a sub-org. Must have no children (returns 409 if it does).
 * Cannot delete the root org.
 */
export const DELETE = withAuth(requirePermission(['manage_settings'], async (_req, ctx, params) => {
  const supabase = createServerClient()

  // Verify org exists
  const { data: existing, error: fetchErr } = await supabase
    .from('orgs')
    .select('id, parent_org_id')
    .eq('id', params.id)
    .single()

  if (fetchErr || !existing) {
    return apiError('Organisation not found', 'org/not-found', 404)
  }

  // Cannot delete the root org
  if (!existing.parent_org_id) {
    return apiError('Cannot delete the root organisation', 'org/cannot-delete-root', 400)
  }

  // Check for children
  const { data: children } = await supabase
    .from('orgs')
    .select('id')
    .eq('parent_org_id', params.id)
    .limit(1)

  if (children && children.length > 0) {
    return apiError(
      'Cannot delete org with children — reassign or delete children first',
      'org/has-children',
      409
    )
  }

  const { error: deleteErr } = await supabase
    .from('orgs')
    .delete()
    .eq('id', params.id)

  if (deleteErr) {
    logger.error('api-org', 'db.delete_failed', { error_code: deleteErr.code })
    return apiError('Failed to delete org', 'db/delete-failed', 500)
  }

  return ok({ deleted: params.id })
}))
