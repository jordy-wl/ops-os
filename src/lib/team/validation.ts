import type { SupabaseClient } from '@supabase/supabase-js'

const MAX_REPORTING_DEPTH = 4

/**
 * Validate that a reporting_to chain does not exceed MAX_REPORTING_DEPTH levels.
 * Returns null if valid, or an error message if invalid.
 */
export async function validateReportingDepth(
  supabase: SupabaseClient,
  orgId: string,
  reportingToId: string,
  /** The block being assigned (exclude from cycle check) */
  selfId?: string
): Promise<string | null> {
  let currentId = reportingToId
  let depth = 1

  while (currentId) {
    if (depth > MAX_REPORTING_DEPTH) {
      return `Reporting hierarchy would exceed ${MAX_REPORTING_DEPTH} levels`
    }

    if (selfId && currentId === selfId) {
      return 'Reporting hierarchy contains a cycle'
    }

    const { data: block } = await supabase
      .from('blocks')
      .select('id, metadata')
      .eq('id', currentId)
      .eq('org_id', orgId)
      .eq('type', 'team_member')
      .single()

    if (!block) {
      return `Reporting-to team member not found: ${currentId}`
    }

    const meta = block.metadata as Record<string, unknown> | null
    const parentId = meta?.reporting_to as string | undefined
    if (!parentId) break

    currentId = parentId
    depth++
  }

  return null
}

/** Valid status transitions for team members. */
const VALID_TRANSITIONS: Record<string, string[]> = {
  active: ['on_leave', 'offboarding'],
  on_leave: ['active', 'offboarding'],
  offboarding: ['inactive'],
  inactive: [], // terminal
}

/**
 * Check if a status transition is allowed.
 */
export function isValidStatusTransition(from: string, to: string): boolean {
  if (from === to) return true
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}
