import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/auth/resolve-org'
import { IntegrationCatalog } from '@/components/library/integration-catalog'

export const metadata = { title: 'Integration Library — Ops OS' }

export default async function IntegrationLibraryPage() {
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/org-setup')

  const internalOrgId = await resolveOrgId(orgId)
  if (!internalOrgId) redirect('/org-setup')

  const supabase = createServerClient()

  const { data: connectors } = await supabase
    .from('integration_connectors')
    .select('id, name, provider, direction, status, config, last_sync_at, created_at')
    .eq('org_id', internalOrgId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="p-6 lg:p-8">
      <IntegrationCatalog connectors={connectors ?? []} />
    </div>
  )
}
