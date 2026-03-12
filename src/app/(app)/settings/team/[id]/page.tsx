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

  // Fetch the team member
  const { data: member, error } = await supabase
    .from('blocks')
    .select('id, name, metadata')
    .eq('id', id)
    .eq('org_id', internalOrgId)
    .eq('type', 'team_member')
    .single()

  if (error || !member) notFound()

  // Fetch other active team members for reporting-to picker
  const { data: members } = await supabase
    .from('blocks')
    .select('id, name, metadata')
    .eq('org_id', internalOrgId)
    .eq('type', 'team_member')
    .order('name', { ascending: true })

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
      />
    </PageContainer>
  )
}
