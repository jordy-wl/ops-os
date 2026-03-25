import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/auth/resolve-org'
import { PageHeader } from '@/components/shell/page-header'
import { PortalWizard } from '@/components/portal-wizard'

export const metadata = { title: 'Create Portal — Ops OS' }

export default async function NewPortalPage() {
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/org-setup')
  const internalOrgId = await resolveOrgId(orgId)
  if (!internalOrgId) redirect('/org-setup')

  const supabase = createServerClient()

  const [formTemplatesResult, workflowTemplatesResult, clientsResult, documentTemplatesResult] =
    await Promise.all([
      supabase
        .from('blocks')
        .select('id, name, metadata, state')
        .eq('org_id', internalOrgId)
        .eq('type', 'form_template')
        .order('name'),
      supabase
        .from('blocks')
        .select('id, name, metadata')
        .eq('org_id', internalOrgId)
        .eq('type', 'workflow_template')
        .order('name')
        .limit(100),
      supabase
        .from('blocks')
        .select('id, name')
        .eq('org_id', internalOrgId)
        .eq('type', 'client')
        .eq('state', 'active')
        .order('name')
        .limit(200),
      supabase
        .from('blocks')
        .select('id, name, metadata')
        .eq('org_id', internalOrgId)
        .eq('type', 'document_template')
        .order('name')
        .limit(100),
    ])

  const formTemplates = formTemplatesResult.data
  const workflowTemplates = workflowTemplatesResult.data
  const clients = clientsResult.data
  const documentTemplates = documentTemplatesResult.data

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <PageHeader
        title="Create Portal"
        subtitle="Set up a client portal in 5 steps — configure what clients see, which forms to include, and how requests work."
      />
      <PortalWizard
        formTemplates={(formTemplates ?? []).map((f) => {
          const meta = (f.metadata ?? {}) as Record<string, unknown>
          const questions = Array.isArray(meta.questions) ? meta.questions : []
          return {
            id: f.id,
            name: f.name,
            questionCount: questions.length,
            status: (f.state as string) ?? 'draft',
          }
        })}
        clients={(clients ?? []).map((c) => ({ id: c.id, name: c.name }))}
        workflowTemplates={(workflowTemplates ?? []).map((w) => ({
          id: w.id,
          name: w.name,
          description: ((w.metadata as Record<string, unknown>)?.description as string) ?? '',
        }))}
        documentTemplates={(documentTemplates ?? []).map((d) => ({
          id: d.id,
          name: d.name,
          category: ((d.metadata as Record<string, unknown>)?.category as string) ?? '',
        }))}
      />
    </div>
  )
}
