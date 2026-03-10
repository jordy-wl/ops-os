import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/auth/resolve-org'
import { stepsToCanvas, type CanvasLayout } from '@/lib/workflow/canvas-layout'
import type { WorkflowTemplate } from '@/lib/workflow/template-schema'
import { WorkflowBuilderClient } from './builder-client'

interface Props {
  params: Promise<{ id: string }>
}

export default async function WorkflowBuilderPage({ params }: Props) {
  const { id } = await params
  const { userId, orgId } = await auth()

  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/org-setup')

  const internalOrgId = await resolveOrgId(orgId)
  if (!internalOrgId) redirect('/org-setup')

  const supabase = createServerClient()

  const { data: block, error } = await supabase
    .from('blocks')
    .select('id, name, metadata')
    .eq('id', id)
    .eq('org_id', internalOrgId)
    .eq('type', 'workflow_template')
    .single()

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <p className="text-4xl font-bold text-gray-200 mb-4" aria-hidden="true">404</p>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Template not found</h1>
        <p className="text-sm text-gray-500 mb-6">
          This workflow template may have been deleted or the link is incorrect.
        </p>
        <Link
          href="/workflows"
          className="text-sm font-medium text-gray-900 underline hover:no-underline"
        >
          &larr; Back to workflows
        </Link>
      </div>
    )
  }

  const metadata = block.metadata as Record<string, unknown>
  const template = metadata as unknown as WorkflowTemplate

  // Use saved canvas_layout if present, otherwise generate from steps
  const savedLayout = metadata.canvas_layout as CanvasLayout | undefined
  const initialLayout = savedLayout ?? stepsToCanvas(template)

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <WorkflowBuilderClient
        templateId={block.id}
        templateName={block.name}
        initialLayout={initialLayout}
      />
    </div>
  )
}
