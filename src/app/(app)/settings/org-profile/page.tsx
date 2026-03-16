import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/auth/resolve-org'
import { OrgProfileForm } from '@/components/settings/org-profile-form'

export const metadata = { title: 'Org Profile — Settings — Ops OS' }

export default async function OrgProfilePage() {
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/org-setup')

  const internalOrgId = await resolveOrgId(orgId)
  if (!internalOrgId) redirect('/org-setup')

  const supabase = createServerClient()

  const { data: org } = await supabase
    .from('orgs')
    .select('id, name, slug, org_level, created_at')
    .eq('id', internalOrgId)
    .single()

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground mb-1">Organisation Profile</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Basic details about your organisation.
      </p>
      <OrgProfileForm org={org ?? { id: internalOrgId, name: '', slug: '', org_level: 'org', created_at: '' }} />
    </div>
  )
}
