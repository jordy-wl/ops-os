import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'
import { validateReportingDepth, isValidStatusTransition } from '@/lib/team/validation'

const UpdateTeamMemberSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    email: z.string().email().optional(),
    role_title: z.string().max(255).optional(),
    department: z.string().max(255).optional(),
    reporting_to: z.string().uuid().nullable().optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
    status: z.enum(['active', 'on_leave', 'offboarding', 'inactive']).optional(),
    clerk_user_id: z.string().max(255).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  })

/**
 * GET /api/team/[id]
 * Get a single team member.
 */
export const GET = withAuth(async (_req: NextRequest, ctx, params) => {
  const { id } = params
  const supabase = createServerClient()

  const { data: block, error } = await supabase
    .from('blocks')
    .select('*')
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .eq('type', 'team_member')
    .single()

  if (error) {
    if (error.code === 'PGRST116') return apiError('Team member not found', 'team/not-found', 404)
    logger.error('api-team', 'db.query_failed', { error_code: error.code })
    return apiError('Failed to fetch team member', 'db/query-failed', 500)
  }

  return ok(block)
})

/**
 * PATCH /api/team/[id]
 * Update team member fields.
 */
export const PATCH = withAuth(requirePermission(['manage_team'], async (req: NextRequest, ctx, params) => {
  const { id } = params
  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

  const parsed = UpdateTeamMemberSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const supabase = createServerClient()

  // Fetch existing team member
  const { data: existing, error: fetchError } = await supabase
    .from('blocks')
    .select('*')
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .eq('type', 'team_member')
    .single()

  if (fetchError) {
    if (fetchError.code === 'PGRST116') return apiError('Team member not found', 'team/not-found', 404)
    logger.error('api-team', 'db.query_failed', { error_code: fetchError.code })
    return apiError('Failed to fetch team member', 'db/query-failed', 500)
  }

  const existingMeta = (existing.metadata ?? {}) as Record<string, unknown>

  // Validate status transition
  if (parsed.data.status) {
    const currentStatus = (existingMeta.status as string) ?? 'active'
    if (!isValidStatusTransition(currentStatus, parsed.data.status)) {
      return apiError(
        `Invalid status transition: ${currentStatus} → ${parsed.data.status}`,
        'team/invalid-status-transition',
        400
      )
    }
  }

  // Validate reporting-to hierarchy
  if (parsed.data.reporting_to !== undefined && parsed.data.reporting_to !== null) {
    const depthError = await validateReportingDepth(
      supabase, ctx.orgId, parsed.data.reporting_to, id
    )
    if (depthError) {
      return apiError(depthError, 'team/invalid-hierarchy', 400)
    }
  }

  // Build updated metadata
  const updatedMeta = { ...existingMeta }
  if (parsed.data.email !== undefined) updatedMeta.email = parsed.data.email
  if (parsed.data.role_title !== undefined) updatedMeta.role_title = parsed.data.role_title
  if (parsed.data.department !== undefined) updatedMeta.department = parsed.data.department
  if (parsed.data.reporting_to !== undefined) updatedMeta.reporting_to = parsed.data.reporting_to
  if (parsed.data.start_date !== undefined) updatedMeta.start_date = parsed.data.start_date
  if (parsed.data.status !== undefined) updatedMeta.status = parsed.data.status
  if (parsed.data.clerk_user_id !== undefined) updatedMeta.clerk_user_id = parsed.data.clerk_user_id

  const updateFields: Record<string, unknown> = {
    metadata: updatedMeta,
    updated_at: new Date().toISOString(),
  }
  if (parsed.data.name !== undefined) updateFields.name = parsed.data.name

  const { data: updated, error: updateError } = await supabase
    .from('blocks')
    .update(updateFields)
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .select()
    .single()

  if (updateError || !updated) {
    logger.error('api-team', 'db.update_failed', { error_code: updateError?.code })
    return apiError('Failed to update team member', 'db/update-failed', 500)
  }

  // Update reporting-to edge if changed
  if (parsed.data.reporting_to !== undefined) {
    // Remove existing reports_to edge
    await supabase
      .from('block_edges')
      .delete()
      .eq('from_block_id', id)
      .eq('edge_type', 'reports_to')

    // Create new edge if not null
    if (parsed.data.reporting_to) {
      await supabase.from('block_edges').insert({
        org_id: ctx.orgId,
        from_block_id: id,
        to_block_id: parsed.data.reporting_to,
        edge_type: 'reports_to',
      })
    }
  }

  return ok(updated)
}))

/**
 * DELETE /api/team/[id]
 * Soft-deactivate: sets status to 'inactive'.
 */
export const DELETE = withAuth(requirePermission(['manage_team'], async (_req: NextRequest, ctx, params) => {
  const { id } = params
  const supabase = createServerClient()

  const { data: existing, error: fetchError } = await supabase
    .from('blocks')
    .select('id, metadata')
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .eq('type', 'team_member')
    .single()

  if (fetchError) {
    if (fetchError.code === 'PGRST116') return apiError('Team member not found', 'team/not-found', 404)
    logger.error('api-team', 'db.query_failed', { error_code: fetchError.code })
    return apiError('Failed to fetch team member', 'db/query-failed', 500)
  }

  const existingMeta = (existing.metadata ?? {}) as Record<string, unknown>
  if (existingMeta.status === 'inactive') {
    return apiError('Team member is already inactive', 'team/already-inactive', 409)
  }

  const { data: updated, error: updateError } = await supabase
    .from('blocks')
    .update({
      metadata: { ...existingMeta, status: 'inactive' },
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .select()
    .single()

  if (updateError || !updated) {
    logger.error('api-team', 'db.update_failed', { error_code: updateError?.code })
    return apiError('Failed to deactivate team member', 'db/update-failed', 500)
  }

  await supabase.from('events').insert({
    org_id: ctx.orgId,
    block_id: id,
    type: 'team_member.deactivated',
    actor_id: ctx.userId,
    actor_type: 'human',
    payload: { previous_status: existingMeta.status ?? 'active' },
  })

  return ok({ id: updated.id, status: 'inactive' })
}))
