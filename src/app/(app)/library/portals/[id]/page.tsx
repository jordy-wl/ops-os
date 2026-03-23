import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/auth/resolve-org'
import { PortalDetailView } from '@/components/library/portal-detail-view'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PortalDetailPage({ params }: Props) {
  const { id } = await params
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/org-setup')
  const internalOrgId = await resolveOrgId(orgId)
  if (!internalOrgId) redirect('/org-setup')

  const supabase = createServerClient()

  const [configResult, formsResult] = await Promise.all([
    supabase
      .from('portal_configurations')
      .select(`
        *,
        shared_links!portal_configurations_shared_link_id_fkey(token),
        blocks!portal_configurations_client_block_id_fkey(id, name, type, metadata)
      `)
      .eq('id', id)
      .eq('org_id', internalOrgId)
      .single(),
    supabase
      .from('blocks')
      .select('id, name, metadata, state')
      .eq('org_id', internalOrgId)
      .eq('type', 'form_template')
      .order('updated_at', { ascending: false }),
  ])

  if (configResult.error || !configResult.data) notFound()

  const config = configResult.data
  const rawLink = config.shared_links as unknown as { token: string } | { token: string }[] | null
  const link = Array.isArray(rawLink) ? rawLink[0] : rawLink
  const rawClient = config.blocks as unknown as {
    id: string
    name: string
    type: string
    metadata: Record<string, unknown>
  } | {
    id: string
    name: string
    type: string
    metadata: Record<string, unknown>
  }[] | null
  const client = Array.isArray(rawClient) ? rawClient[0] : rawClient

  return (
    <PortalDetailView
      config={{
        id: config.id,
        org_id: config.org_id,
        client_block_id: config.client_block_id,
        name: config.name,
        dashboard_enabled: config.dashboard_enabled,
        documents_enabled: config.documents_enabled,
        requests_enabled: config.requests_enabled,
        forms_enabled: config.forms_enabled,
        exposed_block_types: config.exposed_block_types ?? [],
        exposed_block_ids: config.exposed_block_ids,
        branding_overrides: config.branding_overrides,
        is_active: config.is_active,
        portal_token: link?.token ?? null,
        created_at: config.created_at,
        updated_at: config.updated_at,
      }}
      clientName={client?.name ?? 'Unknown Client'}
      clientId={client?.id ?? config.client_block_id}
      formTemplates={(formsResult.data ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        questionCount: Array.isArray(
          (f.metadata as Record<string, unknown>)?.questions
        )
          ? (
              (f.metadata as Record<string, unknown>)
                .questions as unknown[]
            ).length
          : 0,
        status: (f.state as string) ?? 'draft',
      }))}
    />
  )
}
