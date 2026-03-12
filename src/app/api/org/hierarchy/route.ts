import { withAuth } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

interface OrgNode {
  id: string
  name: string
  slug: string | null
  level: string
  children: OrgNode[]
}

/**
 * GET /api/org/hierarchy
 * Returns the full org tree from root to all leaves as a nested JSON structure.
 * Uses the get_org_hierarchy() RPC function (recursive CTE) from the DB.
 */
export const GET = withAuth(async (_req, ctx) => {
  const supabase = createServerClient()

  // Use the DB RPC that walks the tree via recursive CTE
  const { data: rows, error } = await supabase.rpc('get_org_hierarchy', {
    root_org_id: ctx.orgId,
  })

  if (error) {
    logger.error('api-org', 'db.hierarchy_query_failed', { error_code: error.code })
    return apiError('Failed to fetch org hierarchy', 'db/query-failed', 500)
  }

  if (!rows || rows.length === 0) {
    return apiError('Organisation not found', 'org/not-found', 404)
  }

  // Build nested tree from flat rows (already ordered by depth, name)
  const nodeMap = new Map<string, OrgNode>()

  for (const row of rows) {
    nodeMap.set(row.id, {
      id: row.id,
      name: row.name,
      slug: row.slug,
      level: row.org_level,
      children: [],
    })
  }

  let root: OrgNode | null = null

  for (const row of rows) {
    const node = nodeMap.get(row.id)!
    if (row.parent_org_id && nodeMap.has(row.parent_org_id)) {
      nodeMap.get(row.parent_org_id)!.children.push(node)
    } else {
      root = node
    }
  }

  return ok(root)
})
