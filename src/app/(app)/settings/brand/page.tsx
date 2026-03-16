import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/auth/resolve-org'
import { BrandKitEditor } from '@/components/settings/brand-kit-editor'

export const metadata = { title: 'Brand Kit — Settings — Ops OS' }

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
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Brand Kit</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Logo, colours, and brand identity for documents.</p>
      </div>
      <BrandKitEditor
        orgId={internalOrgId}
        existingBlock={brandKitBlock ?? undefined}
      />
    </div>
  )
}
