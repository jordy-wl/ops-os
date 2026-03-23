import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/auth/resolve-org'
import { PageHeader } from '@/components/shell/page-header'
import { PortalBrowser } from '@/components/library/portal-browser'

export interface PortalListItem {
  id: string
  name: string
  client_block_id: string
  client_name: string
  is_active: boolean
  dashboard_enabled: boolean
  documents_enabled: boolean
  requests_enabled: boolean
  forms_enabled: boolean
  exposed_block_types: string[]
  portal_token: string | null
  created_at: string
  updated_at: string
}

export default async function PortalsPage() {
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/org-setup')
  const internalOrgId = await resolveOrgId(orgId)
  if (!internalOrgId) redirect('/org-setup')

  const supabase = createServerClient()

  const { data: configs } = await supabase
    .from('portal_configurations')
    .select(`
      id, name, client_block_id, is_active,
      dashboard_enabled, documents_enabled, requests_enabled, forms_enabled,
      exposed_block_types, created_at, updated_at,
      shared_links!portal_configurations_shared_link_id_fkey(token),
      blocks!portal_configurations_client_block_id_fkey(name)
    `)
    .eq('org_id', internalOrgId)
    .order('updated_at', { ascending: false })

  const portals: PortalListItem[] = (configs ?? []).map((c) => {
    const link = c.shared_links as unknown as { token: string } | { token: string }[] | null
    const block = c.blocks as unknown as { name: string } | { name: string }[] | null
    const linkObj = Array.isArray(link) ? link[0] : link
    const blockObj = Array.isArray(block) ? block[0] : block
    return {
      id: c.id,
      name: c.name,
      client_block_id: c.client_block_id,
      client_name: blockObj?.name ?? 'Unknown Client',
      is_active: c.is_active,
      dashboard_enabled: c.dashboard_enabled,
      documents_enabled: c.documents_enabled,
      requests_enabled: c.requests_enabled,
      forms_enabled: c.forms_enabled,
      exposed_block_types: c.exposed_block_types ?? [],
      portal_token: linkObj?.token ?? null,
      created_at: c.created_at,
      updated_at: c.updated_at,
    }
  })

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <PageHeader title="Portals" subtitle="Manage client portal access and configuration" />
      <PortalBrowser portals={portals} />
    </div>
  )
}
