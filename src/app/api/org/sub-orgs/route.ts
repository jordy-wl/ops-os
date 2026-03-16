import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

const ORG_LEVELS = ['org', 'suborg', 'department', 'team'] as const

const CreateSubOrgSchema = z.object({
  name: z.string().min(1).max(255),
  parent_id: z.string().uuid(),
  org_level: z.enum(ORG_LEVELS),
})

/**
 * POST /api/org/sub-orgs
 * Create a sub-org under a parent. The DB trigger enforces max 4-level depth.
 */
export const POST = withAuth(requirePermission(['manage_settings'], async (req: NextRequest, ctx) => {
  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

  const parsed = CreateSubOrgSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const supabase = createServerClient()

  // Verify parent belongs to this org tree
  const { data: parent, error: parentErr } = await supabase
    .from('orgs')
    .select('id, org_level')
    .eq('id', parsed.data.parent_id)
    .single()

  if (parentErr || !parent) {
    return apiError('Parent org not found', 'org/parent-not-found', 404)
  }

  // Validate level ordering: parent level must be above child level
  const parentIdx = ORG_LEVELS.indexOf(parent.org_level as typeof ORG_LEVELS[number])
  const childIdx = ORG_LEVELS.indexOf(parsed.data.org_level)
  if (childIdx <= parentIdx) {
    return apiError(
      `A '${parsed.data.org_level}' cannot be nested under a '${parent.org_level}'`,
      'org/invalid-level-ordering',
      400
    )
  }

  // Insert — the DB trigger check_org_depth() will enforce max 4 levels
  const { data: newOrg, error: insertError } = await supabase
    .from('orgs')
    .insert({
      name: parsed.data.name,
      slug: parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      clerk_org_id: ctx.clerkOrgId,
      parent_org_id: parsed.data.parent_id,
      org_level: parsed.data.org_level,
    })
    .select('id, name, slug, org_level, parent_org_id')
    .single()

  if (insertError) {
    // DB trigger raises exception if depth exceeds 4 levels
    if (insertError.message?.includes('exceed')) {
      return apiError(
        'Organisation hierarchy cannot exceed 4 levels',
        'org/depth-exceeded',
        400
      )
    }
    logger.error('api-org', 'db.insert_failed', { error_code: insertError.code })
    return apiError('Failed to create sub-org', 'db/insert-failed', 500)
  }

  return ok(newOrg, 201)
}))
