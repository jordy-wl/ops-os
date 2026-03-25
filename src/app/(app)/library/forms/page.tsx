import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/auth/resolve-org'
import { PageHeader } from '@/components/shell/page-header'
import Link from 'next/link'
import { FileText, Plus } from 'lucide-react'

export const metadata = { title: 'Forms -- Ops OS' }

interface FormBlock {
  id: string
  name: string
  state: string | null
  metadata: Record<string, unknown> | null
  updated_at: string
}

function getQuestionCount(metadata: Record<string, unknown> | null): number {
  if (!metadata) return 0
  const questions = metadata.questions
  return Array.isArray(questions) ? questions.length : 0
}

function getStatusLabel(block: FormBlock): string {
  const metaStatus = (block.metadata as Record<string, unknown> | null)?.status
  if (typeof metaStatus === 'string' && metaStatus.length > 0) return metaStatus
  if (typeof block.state === 'string' && block.state.length > 0) return block.state
  return 'draft'
}

function StatusBadge({ status }: { status: string }) {
  const colorClass =
    status === 'published' || status === 'active'
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      : status === 'archived'
        ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
      {status}
    </span>
  )
}

export default async function FormsLibraryPage() {
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/org-setup')

  const internalOrgId = await resolveOrgId(orgId)
  if (!internalOrgId) redirect('/org-setup')

  const supabase = createServerClient()

  const { data: forms } = await supabase
    .from('blocks')
    .select('id, name, state, metadata, updated_at')
    .eq('org_id', internalOrgId)
    .eq('type', 'form_template')
    .order('updated_at', { ascending: false })

  const formList: FormBlock[] = (forms ?? []) as FormBlock[]

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Forms"
        subtitle="Create and manage form templates for portals and workflows"
        actions={
          <Link
            href="/blocks/new?type=form_template"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create Form
          </Link>
        }
      />

      {formList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" aria-hidden="true" />
          <h2 className="text-lg font-medium text-foreground mb-1">No forms yet</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Create a form template to get started. Forms can be used in portals
            and workflows to collect structured information.
          </p>
          <Link
            href="/blocks/new?type=form_template"
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create Form
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {formList.map((form) => {
            const questionCount = getQuestionCount(form.metadata)
            const status = getStatusLabel(form)
            return (
              <div
                key={form.id}
                className="rounded-lg border bg-card p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-medium text-foreground truncate">{form.name}</h3>
                  <StatusBadge status={status} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {questionCount} {questionCount === 1 ? 'question' : 'questions'}
                </p>
                <div className="mt-auto pt-2 border-t">
                  <Link
                    href={`/library/forms/${form.id}/builder`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Edit in Builder
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
