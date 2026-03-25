import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/auth/resolve-org'
import { FormBuilderPage } from '@/components/form-builder/form-builder-page'
import type { FormQuestion } from '@/lib/form-types'

export const metadata = { title: 'Form Builder -- Ops OS' }

interface Props {
  params: Promise<{ id: string }>
}

export default async function FormBuilderRoute({ params }: Props) {
  const { id } = await params
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/org-setup')

  const internalOrgId = await resolveOrgId(orgId)
  if (!internalOrgId) redirect('/org-setup')

  const supabase = createServerClient()

  const { data: block } = await supabase
    .from('blocks')
    .select('id, name, metadata, state')
    .eq('id', id)
    .eq('org_id', internalOrgId)
    .eq('type', 'form_template')
    .single()

  if (!block) notFound()

  const blockMetadata = block.metadata as Record<string, unknown> | null
  const questions: FormQuestion[] = Array.isArray(blockMetadata?.questions)
    ? (blockMetadata!.questions as FormQuestion[])
    : []
  const formTitle = (typeof blockMetadata?.title === 'string' ? blockMetadata.title : null) ?? block.name

  return (
    <FormBuilderPage
      blockId={block.id}
      formName={block.name}
      formTitle={formTitle}
      initialQuestions={questions}
    />
  )
}
