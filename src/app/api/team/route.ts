import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'
import { validateReportingDepth } from '@/lib/team/validation'

const CreateTeamMemberSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().optional(),
  role_title: z.string().max(255).optional(),
  department: z.string().max(255).optional(),
  reporting_to: z.string().uuid().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
  clerk_user_id: z.string().max(255).optional(),
})

/**
 * GET /api/team
 * List team members for the org. Filters: ?status=active, ?department=X
 */
export const GET = withAuth(async (req: NextRequest, ctx) => {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const department = searchParams.get('department')

  const supabase = createServerClient()

  let query = supabase
    .from('blocks')
    .select('*')
    .eq('org_id', ctx.orgId)
    .eq('type', 'team_member')
    .order('name', { ascending: true })

  if (status) {
    query = query.eq('metadata->>status', status)
  }
  if (department) {
    query = query.eq('metadata->>department', department)
  }

  const { data, error } = await query

  if (error) {
    logger.error('api-team', 'db.query_failed', { error_code: error.code })
    return apiError('Failed to fetch team members', 'db/query-failed', 500)
  }

  return ok(data)
})

/**
 * POST /api/team
 * Create a new team member block.
 */
export const POST = withAuth(requirePermission(['manage_team'], async (req: NextRequest, ctx) => {
  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

  const parsed = CreateTeamMemberSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const supabase = createServerClient()

  // Validate reporting-to hierarchy if provided
  if (parsed.data.reporting_to) {
    const depthError = await validateReportingDepth(
      supabase, ctx.orgId, parsed.data.reporting_to
    )
    if (depthError) {
      return apiError(depthError, 'team/invalid-hierarchy', 400)
    }
  }

  // Create the team member block
  const metadata: Record<string, unknown> = {
    email: parsed.data.email ?? null,
    role_title: parsed.data.role_title ?? null,
    department: parsed.data.department ?? null,
    reporting_to: parsed.data.reporting_to ?? null,
    start_date: parsed.data.start_date ?? null,
    status: 'active',
    clerk_user_id: parsed.data.clerk_user_id ?? null,
  }

  const { data: block, error: insertError } = await supabase
    .from('blocks')
    .insert({
      org_id: ctx.orgId,
      type: 'team_member',
      name: parsed.data.name,
      metadata,
    })
    .select()
    .single()

  if (insertError || !block) {
    logger.error('api-team', 'db.insert_failed', { error_code: insertError?.code })
    return apiError('Failed to create team member', 'db/insert-failed', 500)
  }

  // Create reporting-to edge if specified
  if (parsed.data.reporting_to) {
    await supabase.from('block_edges').insert({
      org_id: ctx.orgId,
      from_block_id: block.id,
      to_block_id: parsed.data.reporting_to,
      edge_type: 'reports_to',
    })
  }

  // Emit creation event
  await supabase.from('events').insert({
    org_id: ctx.orgId,
    block_id: block.id,
    type: 'team_member.created',
    actor_id: ctx.userId,
    actor_type: 'human',
    payload: { name: parsed.data.name },
  })

  return ok(block, 201)
}))
