import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/auth/resolve-org'
import { PageContainer } from '@/components/shell/page-container'
import { PageHeader } from '@/components/shell/page-header'
import { TeamMemberForm } from '@/components/team/team-member-form'

export const metadata = { title: 'Edit Team Member — Ops OS' }

export default async function EditTeamMemberPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/org-setup')

  const internalOrgId = await resolveOrgId(orgId)
  if (!internalOrgId) redirect('/org-setup')

  const supabase = createServerClient()

  // Fetch the team member, other members, and roles in parallel
  const [memberResult, membersResult, rolesResult] = await Promise.all([
    supabase
      .from('blocks')
      .select('id, name, metadata')
      .eq('id', id)
      .eq('org_id', internalOrgId)
      .eq('type', 'team_member')
      .single(),
    supabase
      .from('blocks')
      .select('id, name, metadata')
      .eq('org_id', internalOrgId)
      .eq('type', 'team_member')
      .order('name', { ascending: true }),
    supabase
      .from('roles')
      .select('id, name, display_name, is_system')
      .eq('org_id', internalOrgId)
      .order('is_system', { ascending: false })
      .order('display_name', { ascending: true }),
  ])

  const member = memberResult.data
  if (memberResult.error || !member) notFound()

  const members = membersResult.data
  const roles = rolesResult.data ?? []

  // Fetch current role assignment if this member has a linked Clerk user
  let currentRoleId: string | null = null
  const clerkUserId = (member.metadata as { clerk_user_id?: string | null })?.clerk_user_id
  if (clerkUserId) {
    const { data: assignment } = await supabase
      .from('user_permissions')
      .select('role_id')
      .eq('org_id', internalOrgId)
      .eq('user_id', clerkUserId)
      .maybeSingle()
    currentRoleId = assignment?.role_id ?? null
  }

  const activeMembers = (members ?? [])
    .filter((m: { id: string; metadata: { status?: string } }) => m.metadata?.status === 'active')
    .map((m: { id: string; name: string }) => ({ id: m.id, name: m.name }))

  const departments = [...new Set(
    (members ?? [])
      .map((m: { metadata: { department?: string | null } }) => m.metadata?.department)
      .filter((d): d is string => !!d)
  )].sort()

  return (
    <PageContainer maxWidth="lg">
      <PageHeader
        title={`Edit: ${member.name}`}
        breadcrumbs={[
          { label: 'Settings', href: '/settings/brand' },
          { label: 'Team', href: '/settings/team' },
          { label: member.name },
        ]}
      />
      <TeamMemberForm
        initialData={member}
        teamMembers={activeMembers}
        departments={departments}
        roles={roles}
        currentRoleId={currentRoleId}
      />
    </PageContainer>
  )
}
