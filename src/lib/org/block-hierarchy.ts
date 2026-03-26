import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Block hierarchy data layer.
 *
 * Fetches the org structure tree using the get_block_hierarchy() RPC
 * (recursive CTE over block_edges with edge_type = 'part_of'),
 * then enriches each node with head/lead names and member counts.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type HierarchyBlockType = 'organisation' | 'division' | 'department' | 'team'

export interface HierarchyBlock {
  id: string
  name: string
  block_type: HierarchyBlockType
  metadata: Record<string, unknown>
  parent_id: string | null
  depth: number
  head_name?: string
  member_count?: number
}

// ─── Main Function ───────────────────────────────────────────────────────────

/**
 * getBlockHierarchy — fetches the org hierarchy tree from blocks + edges.
 *
 * 1. Calls get_block_hierarchy(orgId) RPC
 * 2. Fetches has_head / has_lead / has_deputy edges → resolves head names
 * 3. Counts has_member edges per team block
 * 4. Returns enriched flat list ordered by depth, name
 */
export async function getBlockHierarchy(
  supabase: SupabaseClient,
  orgId: string
): Promise<HierarchyBlock[]> {
  // 1. Get raw hierarchy from RPC
  const { data: rawHierarchy, error } = await supabase.rpc('get_block_hierarchy', {
    p_org_id: orgId,
  })

  if (error || !rawHierarchy || rawHierarchy.length === 0) {
    return []
  }

  const blocks = rawHierarchy as {
    id: string
    name: string
    block_type: string
    metadata: Record<string, unknown>
    parent_id: string | null
    depth: number
  }[]

  const blockIds = blocks.map((b) => b.id)

  // 2. Fetch head/lead edges for these blocks
  const headEdgeTypes = ['has_head', 'has_lead', 'has_deputy']
  const { data: headEdges } = await supabase
    .from('block_edges')
    .select('from_block_id, to_block_id, edge_type')
    .eq('org_id', orgId)
    .in('from_block_id', blockIds)
    .in('edge_type', headEdgeTypes)

  // Resolve team member names for heads/leads
  const headMemberIds = (headEdges ?? []).map((e) => e.to_block_id)
  const headNameMap = new Map<string, string>()

  if (headMemberIds.length > 0) {
    const { data: members } = await supabase
      .from('blocks')
      .select('id, name')
      .in('id', headMemberIds)

    for (const m of members ?? []) {
      headNameMap.set(m.id, m.name)
    }
  }

  // Build a map: block_id → head name (prefer has_head over has_lead)
  const blockHeadMap = new Map<string, string>()
  for (const edge of headEdges ?? []) {
    const name = headNameMap.get(edge.to_block_id)
    if (!name) continue
    // Only set if not already set (has_head takes priority)
    if (!blockHeadMap.has(edge.from_block_id) || edge.edge_type === 'has_head') {
      blockHeadMap.set(edge.from_block_id, name)
    }
  }

  // 3. Count has_member edges per team block
  const teamIds = blocks.filter((b) => b.block_type === 'team').map((b) => b.id)
  const memberCountMap = new Map<string, number>()

  if (teamIds.length > 0) {
    const { data: memberEdges } = await supabase
      .from('block_edges')
      .select('from_block_id')
      .eq('org_id', orgId)
      .in('from_block_id', teamIds)
      .eq('edge_type', 'has_member')

    for (const edge of memberEdges ?? []) {
      memberCountMap.set(
        edge.from_block_id,
        (memberCountMap.get(edge.from_block_id) ?? 0) + 1
      )
    }
  }

  // 4. Assemble enriched results
  return blocks.map((b) => ({
    id: b.id,
    name: b.name,
    block_type: b.block_type as HierarchyBlockType,
    metadata: b.metadata ?? {},
    parent_id: b.parent_id,
    depth: b.depth,
    head_name: blockHeadMap.get(b.id),
    member_count: b.block_type === 'team' ? (memberCountMap.get(b.id) ?? 0) : undefined,
  }))
}
