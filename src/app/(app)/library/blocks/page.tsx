import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/auth/resolve-org'
import { BlockBrowser } from '@/components/library/block-browser'

export const metadata = { title: 'Block Library — Ops OS' }

export default async function BlockLibraryPage() {
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/org-setup')

  const internalOrgId = await resolveOrgId(orgId)
  if (!internalOrgId) redirect('/org-setup')

  const supabase = createServerClient()

  const [blocksResult, typesResult] = await Promise.all([
    supabase
      .from('blocks')
      .select('id, name, type, state, metadata, created_at, updated_at')
      .eq('org_id', internalOrgId)
      .not('type', 'in', '(workflow_template,workflow_instance)')
      .order('updated_at', { ascending: false })
      .limit(200),
    supabase
      .from('block_type_definitions')
      .select('type_name, label, icon, color, field_schema')
      .eq('org_id', internalOrgId),
  ])

  return (
    <div className="p-6 lg:p-8">
      <BlockBrowser
        blocks={blocksResult.data ?? []}
        typeDefinitions={typesResult.data ?? []}
      />
    </div>
  )
}
