import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'
import { PERMISSIONS } from '@/lib/rbac/types'

const PatchRoleSchema = z.object({
  display_name: z.string().min(1).max(255).optional(),
  description: z.string().max(500).optional(),
  permissions: z.array(z.enum(PERMISSIONS)).min(1, 'At least one permission required').optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' })

/**
 * PATCH /api/roles/:id
 * Update a custom role. System roles cannot be modified.
 */
export const PATCH = withAuth(requirePermission(['manage_team'], async (req: NextRequest, ctx, params) => {
  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

  const parsed = PatchRoleSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const supabase = createServerClient()

  // Fetch existing role
  const { data: existing, error: fetchErr } = await supabase
    .from('roles')
    .select('id, is_system')
    .eq('id', params.id)
    .eq('org_id', ctx.orgId)
    .single()

  if (fetchErr || !existing) {
    return apiError('Role not found', 'roles/not-found', 404)
  }

  if (existing.is_system) {
    return apiError('System roles cannot be modified', 'roles/system-readonly', 403)
  }

  // Update role fields
  const updates: Record<string, unknown> = {}
  if (parsed.data.display_name !== undefined) updates.display_name = parsed.data.display_name
  if (parsed.data.description !== undefined) updates.description = parsed.data.description

  if (Object.keys(updates).length > 0) {
    const { error: updateErr } = await supabase
      .from('roles')
      .update(updates)
      .eq('id', params.id)

    if (updateErr) {
      logger.error('api-roles', 'db.update_failed', { error_code: updateErr.code })
      return apiError('Failed to update role', 'db/update-failed', 500)
    }
  }

  // Update permissions if provided (replace all)
  if (parsed.data.permissions) {
    // Delete existing
    await supabase
      .from('permission_groups')
      .delete()
      .eq('role_id', params.id)

    // Insert new
    const permRows = parsed.data.permissions.map((p) => ({
      role_id: params.id,
      permission: p,
    }))
    await supabase.from('permission_groups').insert(permRows)
  }

  // Fetch updated role
  const { data: updated } = await supabase
    .from('roles')
    .select('id, name, display_name, description, is_system')
    .eq('id', params.id)
    .single()

  const { data: perms } = await supabase
    .from('permission_groups')
    .select('permission')
    .eq('role_id', params.id)

  return ok({
    ...updated,
    permissions: (perms ?? []).map((p: { permission: string }) => p.permission),
  })
}))

/**
 * DELETE /api/roles/:id
 * Delete a custom role. System roles cannot be deleted.
 */
export const DELETE = withAuth(requirePermission(['manage_team'], async (_req, ctx, params) => {
  const supabase = createServerClient()

  const { data: existing, error: fetchErr } = await supabase
    .from('roles')
    .select('id, is_system')
    .eq('id', params.id)
    .eq('org_id', ctx.orgId)
    .single()

  if (fetchErr || !existing) {
    return apiError('Role not found', 'roles/not-found', 404)
  }

  if (existing.is_system) {
    return apiError('System roles cannot be deleted', 'roles/system-readonly', 403)
  }

  // Check if any users are assigned this role
  const { data: assignments } = await supabase
    .from('user_permissions')
    .select('id')
    .eq('role_id', params.id)
    .limit(1)

  if (assignments && assignments.length > 0) {
    return apiError(
      'Cannot delete role — it is assigned to one or more users. Reassign them first.',
      'roles/in-use',
      409
    )
  }

  const { error: deleteErr } = await supabase
    .from('roles')
    .delete()
    .eq('id', params.id)

  if (deleteErr) {
    logger.error('api-roles', 'db.delete_failed', { error_code: deleteErr.code })
    return apiError('Failed to delete role', 'db/delete-failed', 500)
  }

  return ok({ deleted: params.id })
}))
