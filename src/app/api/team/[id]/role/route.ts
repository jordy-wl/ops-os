import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

const AssignRoleSchema = z.object({
  role_id: z.string().uuid('role_id must be a valid UUID'),
})

/**
 * GET /api/team/[id]/role
 * Get the current RBAC role assignment for a team member.
 */
export const GET = withAuth(async (_req: NextRequest, ctx, params) => {
  const { id } = params
  const supabase = createServerClient()

  const { data: member, error: memberErr } = await supabase
    .from('blocks')
    .select('id, metadata')
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .eq('type', 'team_member')
    .single()

  if (memberErr) {
    if (memberErr.code === 'PGRST116') return apiError('Team member not found', 'team/not-found', 404)
    logger.error('api-team-role', 'db.query_failed', { error_code: memberErr.code })
    return apiError('Failed to fetch team member', 'db/query-failed', 500)
  }

  const clerkUserId = (member.metadata as Record<string, unknown>)?.clerk_user_id as string | null
  if (!clerkUserId) {
    return ok({ role: null, message: 'No linked Clerk user' })
  }

  const { data: assignment } = await supabase
    .from('user_permissions')
    .select('role_id, assigned_by, assigned_at')
    .eq('user_id', clerkUserId)
    .eq('org_id', ctx.orgId)
    .maybeSingle()

  if (!assignment) {
    return ok({ role: null, message: 'No role assigned' })
  }

  const { data: role } = await supabase
    .from('roles')
    .select('id, name, display_name, is_system')
    .eq('id', assignment.role_id)
    .single()

  return ok({
    role_id: role?.id ?? assignment.role_id,
    role_name: role?.name ?? 'unknown',
    role_display_name: role?.display_name ?? 'Unknown',
    is_system: role?.is_system ?? false,
    assigned_by: assignment.assigned_by,
    assigned_at: assignment.assigned_at,
  })
})

/**
 * PUT /api/team/[id]/role
 * Assign or change the RBAC role for a team member.
 * The team member must have a clerk_user_id in metadata.
 */
export const PUT = withAuth(requirePermission(['manage_team'], async (req: NextRequest, ctx, params) => {
  const { id } = params
  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

  const parsed = AssignRoleSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const supabase = createServerClient()

  // 1. Fetch team member to get clerk_user_id
  const { data: member, error: memberErr } = await supabase
    .from('blocks')
    .select('id, name, metadata')
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .eq('type', 'team_member')
    .single()

  if (memberErr) {
    if (memberErr.code === 'PGRST116') return apiError('Team member not found', 'team/not-found', 404)
    logger.error('api-team-role', 'db.query_failed', { error_code: memberErr.code })
    return apiError('Failed to fetch team member', 'db/query-failed', 500)
  }

  const clerkUserId = (member.metadata as Record<string, unknown>)?.clerk_user_id as string | null
  if (!clerkUserId) {
    return apiError(
      'Team member has no linked Clerk user ID. Link a user account first.',
      'team/no-clerk-user',
      400
    )
  }

  // 2. Verify role exists in this org
  const { data: role, error: roleErr } = await supabase
    .from('roles')
    .select('id, name, display_name')
    .eq('id', parsed.data.role_id)
    .eq('org_id', ctx.orgId)
    .single()

  if (roleErr || !role) {
    return apiError('Role not found', 'roles/not-found', 404)
  }

  // 3. Prevent self-demotion from ops-admin
  if (clerkUserId === ctx.userId && ctx.role === 'ops-admin' && role.name !== 'ops-admin') {
    return apiError(
      'You cannot remove your own admin role. Ask another admin to change your role.',
      'team/self-demotion',
      403
    )
  }

  // 4. Upsert user_permissions
  const { error: upsertErr } = await supabase
    .from('user_permissions')
    .upsert(
      {
        user_id: clerkUserId,
        org_id: ctx.orgId,
        role_id: parsed.data.role_id,
        assigned_by: ctx.userId,
        assigned_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,org_id' }
    )

  if (upsertErr) {
    logger.error('api-team-role', 'db.upsert_failed', { error_code: upsertErr.code })
    return apiError('Failed to assign role', 'db/upsert-failed', 500)
  }

  // 5. Audit event
  await supabase.from('events').insert({
    org_id: ctx.orgId,
    block_id: id,
    type: 'team_member.role_assigned',
    actor_id: ctx.userId,
    actor_type: 'human',
    payload: {
      clerk_user_id: clerkUserId,
      role_id: parsed.data.role_id,
      role_name: role.name,
      role_display_name: role.display_name,
    },
  })

  return ok({
    team_member_id: id,
    clerk_user_id: clerkUserId,
    role_id: role.id,
    role_name: role.name,
    role_display_name: role.display_name,
    assigned_by: ctx.userId,
  })
}))
