import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/auth/resolve-org'
import { DocumentBrowser } from '@/components/library/document-browser'

export const metadata = { title: 'Document Library — Ops OS' }

export default async function DocumentLibraryPage() {
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/org-setup')

  const internalOrgId = await resolveOrgId(orgId)
  if (!internalOrgId) redirect('/org-setup')

  const supabase = createServerClient()

  // Fetch document templates and brand kit in parallel
  const [templatesResult, brandKitResult] = await Promise.all([
    supabase
      .from('blocks')
      .select('id, name, type, state, metadata, created_at, updated_at')
      .eq('org_id', internalOrgId)
      .eq('type', 'document_template')
      .order('updated_at', { ascending: false })
      .limit(100),
    supabase
      .from('blocks')
      .select('id, name, metadata')
      .eq('org_id', internalOrgId)
      .eq('type', 'brand_kit')
      .limit(1)
      .single(),
  ])

  return (
    <div className="p-6 lg:p-8">
      <DocumentBrowser
        templates={templatesResult.data ?? []}
        hasBrandKit={!!brandKitResult.data}
      />
    </div>
  )
}
