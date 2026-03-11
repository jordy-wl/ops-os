import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/auth/resolve-org'
import { IntegrationListClient } from '@/components/integrations/integration-list-client'
import { logger } from '@/lib/logger'

export default async function IntegrationsPage() {
  const { userId, orgId } = await auth()

  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/org-setup')

  const internalOrgId = await resolveOrgId(orgId)
  const supabase = createServerClient()

  const { data: connectors, error } = await supabase
    .from('integration_connectors')
    .select('id, name, provider, direction, status, config, last_sync_at, created_at')
    .eq('org_id', internalOrgId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    logger.error('integrations-page', 'db.query_failed', {
      error_code: error.code,
      org_id: internalOrgId,
    })
  }

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-semibold text-foreground mb-6">Integrations</h1>
      <IntegrationListClient initialConnectors={error ? null : (connectors ?? [])} />
    </div>
  )
}
