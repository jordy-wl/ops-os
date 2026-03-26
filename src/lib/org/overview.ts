import type { SupabaseClient } from '@supabase/supabase-js'
import { getBlockHierarchy } from './block-hierarchy'

/**
 * Org overview data aggregation service.
 *
 * Fetches org details, hierarchy, team stats, block counts,
 * workflow stats, and recent events in parallel using Promise.all.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OrgDetails {
  id: string
  name: string
  slug: string | null
  org_level: string
  created_at: string
}

export interface HierarchyNode {
  id: string
  name: string
  level: string
  parent_org_id: string | null
}

export interface TeamStats {
  total: number
  by_role: Record<string, number>
  recent: { id: string; name: string; role: string }[]
}

export interface BlockStats {
  total: number
  by_type: Record<string, number>
}

export interface WorkflowStats {
  active: number
  completed: number
  total: number
}

export interface RecentEvent {
  id: string
  event_type: string
  created_at: string
  payload: Record<string, unknown>
}

export interface OrgOverview {
  org: OrgDetails
  hierarchy: HierarchyNode[]
  team: TeamStats
  blocks: BlockStats
  workflows: WorkflowStats
  recent_events: RecentEvent[]
}

// Block types excluded from the "blocks" count — system/internal types
const EXCLUDED_BLOCK_TYPES = [
  'workflow_template',
  'workflow_instance',
  'task_queue_item',
  'brand_kit',
  'document_template',
  'document',
  'team_member',
  'policy',
] as const

// ─── Fetch Helpers ───────────────────────────────────────────────────────────

async function fetchOrgDetails(
  supabase: SupabaseClient,
  orgId: string
): Promise<OrgDetails | null> {
  const { data, error } = await supabase
    .from('orgs')
    .select('id, name, slug, org_level, created_at')
    .eq('id', orgId)
    .single()

  if (error || !data) return null
  return data as OrgDetails
}

async function fetchHierarchy(
  supabase: SupabaseClient,
  orgId: string
): Promise<HierarchyNode[]> {
  // Try block-based hierarchy first (division/department/team blocks)
  const blockHierarchy = await getBlockHierarchy(supabase, orgId)
  if (blockHierarchy.length > 1) {
    // Has hierarchy blocks beyond just the org singleton — use block hierarchy
    return blockHierarchy.map((b) => ({
      id: b.id,
      name: b.name,
      level: b.block_type,
      parent_org_id: b.parent_id,
    }))
  }

  // Fall back to orgs table hierarchy (legacy)
  const { data, error } = await supabase.rpc('get_org_hierarchy', {
    root_org_id: orgId,
  })

  if (error || !data) return []

  return (data as { id: string; name: string; org_level: string; parent_org_id: string | null }[]).map(
    (row) => ({
      id: row.id,
      name: row.name,
      level: row.org_level,
      parent_org_id: row.parent_org_id,
    })
  )
}

async function fetchTeamStats(
  supabase: SupabaseClient,
  orgId: string
): Promise<TeamStats> {
  // Fetch all team_member blocks for this org
  const { data: members, error } = await supabase
    .from('blocks')
    .select('id, name, data')
    .eq('org_id', orgId)
    .eq('type', 'team_member')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error || !members) {
    return { total: 0, by_role: {}, recent: [] }
  }

  const typedMembers = members as { id: string; name: string; data: Record<string, unknown> }[]

  const by_role: Record<string, number> = {}
  for (const m of typedMembers) {
    const role = (m.data?.role as string) || 'unassigned'
    by_role[role] = (by_role[role] || 0) + 1
  }

  // Recent 5 team members
  const recent = typedMembers.slice(0, 5).map((m) => ({
    id: m.id,
    name: m.name,
    role: (m.data?.role as string) || 'unassigned',
  }))

  return { total: typedMembers.length, by_role, recent }
}

async function fetchBlockStats(
  supabase: SupabaseClient,
  orgId: string
): Promise<BlockStats> {
  // Fetch all non-excluded blocks for this org
  const { data: blocks, error } = await supabase
    .from('blocks')
    .select('type')
    .eq('org_id', orgId)
    .eq('status', 'active')

  if (error || !blocks) {
    return { total: 0, by_type: {} }
  }

  const typedBlocks = blocks as { type: string }[]
  const excludedSet = new Set<string>(EXCLUDED_BLOCK_TYPES)

  const by_type: Record<string, number> = {}
  let total = 0

  for (const b of typedBlocks) {
    if (excludedSet.has(b.type)) continue
    by_type[b.type] = (by_type[b.type] || 0) + 1
    total++
  }

  return { total, by_type }
}

async function fetchWorkflowStats(
  supabase: SupabaseClient,
  orgId: string
): Promise<WorkflowStats> {
  // Fetch workflow_instance blocks and group by metadata.status
  const { data: instances, error } = await supabase
    .from('blocks')
    .select('data')
    .eq('org_id', orgId)
    .eq('type', 'workflow_instance')

  if (error || !instances) {
    return { active: 0, completed: 0, total: 0 }
  }

  const typedInstances = instances as { data: Record<string, unknown> }[]
  let active = 0
  let completed = 0

  for (const inst of typedInstances) {
    const status = (inst.data?.status as string) || 'unknown'
    if (status === 'completed') {
      completed++
    } else if (status === 'running' || status === 'pending') {
      active++
    }
  }

  return { active, completed, total: typedInstances.length }
}

async function fetchRecentEvents(
  supabase: SupabaseClient,
  orgId: string,
  limit = 10
): Promise<RecentEvent[]> {
  const { data: events, error } = await supabase
    .from('events')
    .select('id, event_type, occurred_at, payload')
    .eq('org_id', orgId)
    .order('occurred_at', { ascending: false })
    .limit(limit)

  if (error || !events) return []

  return (events as { id: string; event_type: string; occurred_at: string; payload: Record<string, unknown> }[]).map(
    (e) => ({
      id: e.id,
      event_type: e.event_type,
      created_at: e.occurred_at,
      payload: e.payload,
    })
  )
}

// ─── Main Aggregation ────────────────────────────────────────────────────────

/**
 * getOrgOverview — aggregates org overview data using parallel Supabase queries.
 *
 * Returns null if the org is not found.
 */
export async function getOrgOverview(
  supabase: SupabaseClient,
  orgId: string
): Promise<OrgOverview | null> {
  const [org, hierarchy, team, blocks, workflows, recent_events] =
    await Promise.all([
      fetchOrgDetails(supabase, orgId),
      fetchHierarchy(supabase, orgId),
      fetchTeamStats(supabase, orgId),
      fetchBlockStats(supabase, orgId),
      fetchWorkflowStats(supabase, orgId),
      fetchRecentEvents(supabase, orgId),
    ])

  if (!org) return null

  return { org, hierarchy, team, blocks, workflows, recent_events }
}
