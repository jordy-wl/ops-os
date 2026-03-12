import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/auth/resolve-org'
import { PageContainer } from '@/components/shell/page-container'
import { PageHeader } from '@/components/shell/page-header'
import { TeamMemberList } from '@/components/team/team-member-list'
import { OrgHierarchyTree } from '@/components/team/org-hierarchy-tree'

export const metadata = { title: 'Team — Ops OS' }

export default async function TeamSettingsPage() {
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/org-setup')

  const internalOrgId = await resolveOrgId(orgId)
  if (!internalOrgId) redirect('/org-setup')

  const supabase = createServerClient()

  // Fetch team members and org hierarchy in parallel
  const [membersResult, hierarchyResult] = await Promise.all([
    supabase
      .from('blocks')
      .select('id, name, metadata')
      .eq('org_id', internalOrgId)
      .eq('type', 'team_member')
      .order('name', { ascending: true }),
    supabase.rpc('get_org_hierarchy', { root_org_id: internalOrgId }),
  ])

  const members = membersResult.data ?? []
  const hierarchyRows = hierarchyResult.data ?? []

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
    <PageContainer maxWidth="xl">
      <PageHeader
        title="Team"
        subtitle="Manage team members, roles, and org hierarchy."
        breadcrumbs={[
          { label: 'Settings', href: '/settings/brand' },
          { label: 'Team' },
        ]}
        actions={
          <Link
            href="/settings/team/new"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Add Member
          </Link>
        }
      />

      {membersResult.error && (
        <div
          className="mb-6 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400"
          role="alert"
        >
          Failed to load team members. Please refresh the page.
        </div>
      )}

      <div className="space-y-8">
        {/* Team member list */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">Team Members</h2>
          <TeamMemberList members={members} departments={departments} />
        </section>

        {/* Org hierarchy */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">Organisation Hierarchy</h2>
          <OrgHierarchyTree tree={tree} />
        </section>
      </div>
    </PageContainer>
  )
}
