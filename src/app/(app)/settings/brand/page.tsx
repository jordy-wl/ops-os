import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/auth/resolve-org'
import { PageContainer } from '@/components/shell/page-container'
import { BrandKitEditor } from '@/components/settings/brand-kit-editor'

export const metadata = { title: 'Brand Kit — Ops OS' }

export default async function BrandKitPage() {
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/org-setup')

  const internalOrgId = await resolveOrgId(orgId)
  if (!internalOrgId) redirect('/org-setup')

  const supabase = createServerClient()

  // Fetch existing brand kit block (one per org)
  const { data: brandKitBlock } = await supabase
    .from('blocks')
    .select('id, name, metadata, updated_at')
    .eq('org_id', internalOrgId)
    .eq('type', 'brand_kit')
    .limit(1)
    .single()

  return (
    <PageContainer maxWidth="md">
      <BrandKitEditor
        orgId={internalOrgId}
        existingBlock={brandKitBlock ?? undefined}
      />
    </PageContainer>
  )
}
