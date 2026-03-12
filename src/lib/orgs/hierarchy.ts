import { createServerClient } from '@/lib/supabase/server'

export type OrgLevel = 'org' | 'suborg' | 'department' | 'team'

export interface OrgNode {
  id: string
  name: string | null
  slug: string | null
  org_level: OrgLevel
  parent_org_id: string | null
  depth: number
  children?: OrgNode[]
}

/**
 * Returns the full org hierarchy tree rooted at the given org.
 * Uses the `get_org_hierarchy` Postgres function (recursive CTE).
 */
export async function getOrgHierarchy(rootOrgId: string): Promise<OrgNode | null> {
  const supabase = createServerClient()

  const { data, error } = await supabase.rpc('get_org_hierarchy', {
    root_org_id: rootOrgId,
  })

  if (error || !data || data.length === 0) return null

  // Build tree from flat list
  const nodeMap = new Map<string, OrgNode>()
  for (const row of data as OrgNode[]) {
    nodeMap.set(row.id, { ...row, children: [] })
  }

  let root: OrgNode | null = null
  for (const node of nodeMap.values()) {
    if (node.parent_org_id && nodeMap.has(node.parent_org_id)) {
      nodeMap.get(node.parent_org_id)!.children!.push(node)
    }
    if (node.id === rootOrgId) {
      root = node
    }
  }

  return root
}

/**
 * Returns the ancestor chain from the given org up to the root.
 * Result is ordered [self, parent, grandparent, ..., root].
 */
export async function getOrgAncestors(orgId: string): Promise<OrgNode[]> {
  const supabase = createServerClient()
  const ancestors: OrgNode[] = []
  let currentId: string | null = orgId

  while (currentId) {
    const { data }: { data: { id: string; name: string | null; slug: string | null; org_level: string; parent_org_id: string | null } | null } = await supabase
      .from('orgs')
      .select('id, name, slug, org_level, parent_org_id')
      .eq('id', currentId)
      .single()

    if (!data) break
    ancestors.push({ ...data, depth: ancestors.length } as OrgNode)
    currentId = data.parent_org_id
  }

  return ancestors
}

/**
 * Validates that adding a child under the given parent would not
 * exceed the 4-level max depth. Returns true if the insert is safe.
 */
export async function validateOrgDepth(parentOrgId: string): Promise<boolean> {
  const ancestors = await getOrgAncestors(parentOrgId)
  // ancestors includes the parent itself; max 4 levels means parent can be at depth 2 (0-indexed)
  // org(0) → suborg(1) → department(2) → team(3)
  return ancestors.length < 4
}
