import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/auth/resolve-org'
import { PageContainer } from '@/components/shell/page-container'
import { PageHeader } from '@/components/shell/page-header'
import { RoleList } from '@/components/roles/role-list'

export const metadata = { title: 'Roles — Ops OS' }

export default async function RolesSettingsPage() {
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/org-setup')

  const internalOrgId = await resolveOrgId(orgId)
  if (!internalOrgId) redirect('/org-setup')

  const supabase = createServerClient()

  // Fetch roles
  const { data: roles, error } = await supabase
    .from('roles')
    .select('id, name, display_name, description, is_system, created_at')
    .eq('org_id', internalOrgId)
    .order('is_system', { ascending: false })
    .order('name', { ascending: true })

  const roleIds = (roles ?? []).map((r: { id: string }) => r.id)

  // Fetch permissions for all roles
  const { data: permGroups } = roleIds.length > 0
    ? await supabase
        .from('permission_groups')
        .select('role_id, permission')
        .in('role_id', roleIds)
    : { data: [] }

  // Group permissions by role
  const permsByRole = new Map<string, string[]>()
  for (const pg of permGroups ?? []) {
    const existing = permsByRole.get(pg.role_id) ?? []
    existing.push(pg.permission)
    permsByRole.set(pg.role_id, existing)
  }

  const enriched = (roles ?? []).map((r: { id: string; name: string; display_name: string; description: string; is_system: boolean }) => ({
    ...r,
    permissions: permsByRole.get(r.id) ?? [],
  }))

  return (
    <PageContainer maxWidth="xl">
      <PageHeader
        title="Roles & Permissions"
        subtitle="Manage roles and their permission levels."
        breadcrumbs={[
          { label: 'Settings', href: '/settings/brand' },
          { label: 'Roles' },
        ]}
        actions={
          <Link
            href="/settings/roles/new"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Create Role
          </Link>
        }
      />

      {error && (
        <div
          className="mb-6 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400"
          role="alert"
        >
          Failed to load roles. Please refresh the page.
        </div>
      )}

      <RoleList roles={enriched} />
    </PageContainer>
  )
}
