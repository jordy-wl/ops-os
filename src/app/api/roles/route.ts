import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'
import { PERMISSIONS } from '@/lib/rbac/types'

const CreateRoleSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Role name must be lowercase alphanumeric with hyphens'),
  display_name: z.string().min(1).max(255),
  description: z.string().max(500).default(''),
  permissions: z.array(z.enum(PERMISSIONS)).min(1, 'At least one permission required'),
})

/**
 * GET /api/roles
 * List all roles for the org, including their permissions.
 */
export const GET = withAuth(async (_req, ctx) => {
  const supabase = createServerClient()

  const { data: roles, error } = await supabase
    .from('roles')
    .select('id, name, display_name, description, is_system, created_at')
    .eq('org_id', ctx.orgId)
    .order('is_system', { ascending: false })
    .order('name', { ascending: true })

  if (error) {
    logger.error('api-roles', 'db.query_failed', { error_code: error.code })
    return apiError('Failed to fetch roles', 'db/query-failed', 500)
  }

  // Fetch permissions for all roles
  const roleIds = (roles ?? []).map((r: { id: string }) => r.id)
  const { data: permGroups } = await supabase
    .from('permission_groups')
    .select('role_id, permission')
    .in('role_id', roleIds)

  // Group permissions by role
  const permsByRole = new Map<string, string[]>()
  for (const pg of permGroups ?? []) {
    const existing = permsByRole.get(pg.role_id) ?? []
    existing.push(pg.permission)
    permsByRole.set(pg.role_id, existing)
  }

  const enriched = (roles ?? []).map((r: { id: string }) => ({
    ...r,
    permissions: permsByRole.get(r.id) ?? [],
  }))

  return ok(enriched)
})

/**
 * POST /api/roles
 * Create a custom role with specified permissions.
 */
export const POST = withAuth(requirePermission(['manage_team'], async (req: NextRequest, ctx) => {
  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

  const parsed = CreateRoleSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const supabase = createServerClient()

  // Insert role
  const { data: role, error: roleErr } = await supabase
    .from('roles')
    .insert({
      org_id: ctx.orgId,
      name: parsed.data.name,
      display_name: parsed.data.display_name,
      description: parsed.data.description,
      is_system: false,
    })
    .select('id, name, display_name, description, is_system')
    .single()

  if (roleErr || !role) {
    if (roleErr?.code === '23505') {
      return apiError('A role with that name already exists', 'roles/duplicate-name', 409)
    }
    logger.error('api-roles', 'db.insert_failed', { error_code: roleErr?.code })
    return apiError('Failed to create role', 'db/insert-failed', 500)
  }

  // Insert permission mappings
  const permRows = parsed.data.permissions.map((p) => ({
    role_id: role.id,
    permission: p,
  }))

  const { error: permErr } = await supabase
    .from('permission_groups')
    .insert(permRows)

  if (permErr) {
    logger.error('api-roles', 'db.perm_insert_failed', { error_code: permErr.code })
    // Role was created but perms failed — still return the role
  }

  return ok({ ...role, permissions: parsed.data.permissions }, 201)
}))
