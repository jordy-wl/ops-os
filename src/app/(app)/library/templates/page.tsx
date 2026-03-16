import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/auth/resolve-org'
import { TemplateLibraryBrowser } from '@/components/documents/template-library-browser'
import { PageHeader } from '@/components/shell/page-header'

export const metadata = { title: 'Template Library — Ops OS' }

export default async function TemplateLibraryPage() {
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/org-setup')

  const internalOrgId = await resolveOrgId(orgId)
  if (!internalOrgId) redirect('/org-setup')

  const supabase = createServerClient()

  const [templatesResult, brandKitResult] = await Promise.all([
    supabase
      .from('blocks')
      .select('id, name, type, state, metadata, created_at, updated_at')
      .eq('org_id', internalOrgId)
      .eq('type', 'document_template')
      .order('updated_at', { ascending: false })
      .limit(200),
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
      <PageHeader
        title="Template Library"
        subtitle="Upload reference documents for AI-powered document generation"
      />
      <TemplateLibraryBrowser
        templates={(templatesResult.data ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          metadata: (t.metadata ?? {}) as Record<string, unknown>,
          created_at: t.created_at,
          updated_at: t.updated_at,
        }))}
        hasBrandKit={!!brandKitResult.data}
      />
    </div>
  )
}
