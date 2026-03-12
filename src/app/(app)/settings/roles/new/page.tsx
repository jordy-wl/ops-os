import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { PageContainer } from '@/components/shell/page-container'
import { PageHeader } from '@/components/shell/page-header'
import { RoleForm } from '@/components/roles/role-form'

export const metadata = { title: 'Create Role — Ops OS' }

export default async function NewRolePage() {
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/org-setup')

  return (
    <PageContainer maxWidth="lg">
      <PageHeader
        title="Create Custom Role"
        subtitle="Define a new role with specific permissions for your team."
        breadcrumbs={[
          { label: 'Settings', href: '/settings/brand' },
          { label: 'Roles', href: '/settings/roles' },
          { label: 'New' },
        ]}
      />
      <RoleForm />
    </PageContainer>
  )
}
