import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/auth/resolve-org'
import { TeamMemberList } from '@/components/team/team-member-list'
import { OrgHierarchyTree } from '@/components/team/org-hierarchy-tree'

export const metadata = { title: 'Team — Settings — Ops OS' }

export default async function TeamSettingsPage() {
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/org-setup')

  const internalOrgId = await resolveOrgId(orgId)
  if (!internalOrgId) redirect('/org-setup')

  const supabase = createServerClient()

  // Fetch team members, org hierarchy, and roles in parallel
  const [membersResult, hierarchyResult, rolesResult] = await Promise.all([
    supabase
      .from('blocks')
      .select('id, name, metadata')
      .eq('org_id', internalOrgId)
      .eq('type', 'team_member')
      .order('name', { ascending: true }),
    supabase.rpc('get_org_hierarchy', { root_org_id: internalOrgId }),
    supabase
      .from('roles')
      .select('id, name, display_name')
      .eq('org_id', internalOrgId),
  ])

  const members = membersResult.data ?? []
  const hierarchyRows = hierarchyResult.data ?? []
  const rolesMap = new Map((rolesResult.data ?? []).map((r: { id: string; display_name: string }) => [r.id, r.display_name]))

  // Bulk-fetch role assignments for members with linked Clerk users
  const clerkUserIds = members
    .map((m: { metadata: { clerk_user_id?: string | null } }) => m.metadata?.clerk_user_id)
    .filter((id): id is string => !!id)

  const roleAssignments = new Map<string, string>()
  if (clerkUserIds.length > 0) {
    const { data: assignments } = await supabase
      .from('user_permissions')
      .select('user_id, role_id')
      .eq('org_id', internalOrgId)
      .in('user_id', clerkUserIds)
    for (const a of assignments ?? []) {
      roleAssignments.set(a.user_id, rolesMap.get(a.role_id) ?? 'Unknown')
    }
  }

  // Enrich members with system role display name
  type MemberMeta = { email: string | null; role_title: string | null; department: string | null; status: string; reporting_to: string | null; clerk_user_id?: string | null }
  const enrichedMembers = members.map((m: { id: string; name: string; metadata: MemberMeta }) => {
    const clerkId = m.metadata?.clerk_user_id
    return {
      ...m,
      metadata: {
        ...m.metadata,
        system_role: clerkId ? (roleAssignments.get(clerkId) ?? null) : null,
      },
    }
  })

  // Build hierarchy tree from flat rows
  type OrgNode = { id: string; name: string; slug: string | null; level: string; children: OrgNode[] }
  const nodeMap = new Map<string, OrgNode>()
  for (const row of hierarchyRows) {
    nodeMap.set(row.id, { id: row.id, name: row.name, slug: row.slug, level: row.org_level, children: [] })
  }
  let tree: OrgNode | null = null
  for (const row of hierarchyRows) {
    const node = nodeMap.get(row.id)!
    if (row.parent_org_id && nodeMap.has(row.parent_org_id)) {
      nodeMap.get(row.parent_org_id)!.children.push(node)
    } else {
      tree = node
    }
  }

  // Extract unique departments for filter
  const departments = [...new Set(
    members
      .map((m: { metadata: { department?: string | null } }) => m.metadata?.department)
      .filter((d): d is string => !!d)
  )].sort()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Team</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Manage team members and org hierarchy.</p>
        </div>
        <Link
          href="/settings/team/new"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Add Member
        </Link>
      </div>

      {membersResult.error && (
        <div
          className="mb-6 rounded-md bg-destructive/5 border border-destructive/20 px-4 py-3 text-[13px] text-destructive"
          role="alert"
        >
          Failed to load team members. Please refresh the page.
        </div>
      )}

      <div className="space-y-8">
        <section>
          <h3 className="text-base font-semibold text-foreground mb-3">Team Members</h3>
          <TeamMemberList members={enrichedMembers} departments={departments} />
        </section>

        <section>
          <h3 className="text-base font-semibold text-foreground mb-3">Organisation Hierarchy</h3>
          <OrgHierarchyTree tree={tree} />
        </section>
      </div>
    </div>
  )
}
