import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/auth/resolve-org'
import { PageContainer } from '@/components/shell/page-container'
import { PageHeader } from '@/components/shell/page-header'
import { TeamMemberForm } from '@/components/team/team-member-form'

export const metadata = { title: 'Add Team Member — Ops OS' }

export default async function NewTeamMemberPage() {
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/org-setup')

  const internalOrgId = await resolveOrgId(orgId)
  if (!internalOrgId) redirect('/org-setup')

  const supabase = createServerClient()

  // Fetch active team members for reporting-to picker
  const { data: members } = await supabase
    .from('blocks')
    .select('id, name, metadata')
    .eq('org_id', internalOrgId)
    .eq('type', 'team_member')
    .order('name', { ascending: true })

  const activeMembers = (members ?? [])
    .filter((m: { metadata: { status?: string } }) => m.metadata?.status === 'active')
    .map((m: { id: string; name: string }) => ({ id: m.id, name: m.name }))

  const departments = [...new Set(
    (members ?? [])
      .map((m: { metadata: { department?: string | null } }) => m.metadata?.department)
      .filter((d): d is string => !!d)
  )].sort()

  return (
    <PageContainer maxWidth="lg">
      <PageHeader
        title="Add Team Member"
        breadcrumbs={[
          { label: 'Settings', href: '/settings/brand' },
          { label: 'Team', href: '/settings/team' },
          { label: 'New' },
        ]}
      />
      <TeamMemberForm teamMembers={activeMembers} departments={departments} />
    </PageContainer>
  )
}
