import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/auth/resolve-org'
import { PageContainer } from '@/components/shell/page-container'
import { PageHeader } from '@/components/shell/page-header'
import { FieldManager } from '@/components/settings/field-manager'

interface BlockTypeDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function BlockTypeDetailPage({ params }: BlockTypeDetailPageProps) {
  const { id } = await params
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/org-setup')

  const internalOrgId = await resolveOrgId(orgId)
  if (!internalOrgId) redirect('/org-setup')

  const supabase = createServerClient()

  const { data: typeDef, error } = await supabase
    .from('block_type_definitions')
    .select('id, type_name, display_name, description, icon, color, is_system, field_schema')
    .eq('id', id)
    .eq('org_id', internalOrgId)
    .single()

  if (error || !typeDef) {
    notFound()
  }

  const fieldSchema = (typeDef.field_schema ?? {
    type: 'object',
    properties: {},
  }) as {
    type: string
    properties: Record<string, Record<string, unknown>>
    required?: string[]
    'x-field-groups'?: Array<{ id: string; label: string; order: number }>
  }

  // Fetch all block types for relation target selector
  const { data: allTypes } = await supabase
    .from('block_type_definitions')
    .select('type_name, display_name')
    .eq('org_id', internalOrgId)
    .order('display_name', { ascending: true })

  return (
    <PageContainer maxWidth="xl">
      <PageHeader
        title={typeDef.display_name}
        subtitle={typeDef.description ?? `Manage fields for the ${typeDef.display_name} block type.`}
        breadcrumbs={[
          { label: 'Settings', href: '/settings/brand' },
          { label: 'Block Types', href: '/settings/block-types' },
          { label: typeDef.display_name },
        ]}
      />

      <FieldManager
        blockTypeId={typeDef.id}
        blockTypeName={typeDef.type_name}
        fieldSchema={fieldSchema}
        requiredFields={fieldSchema.required ?? []}
        allBlockTypes={(allTypes ?? []).map((t) => ({
          type_name: t.type_name as string,
          display_name: t.display_name as string,
        }))}
      />
    </PageContainer>
  )
}
