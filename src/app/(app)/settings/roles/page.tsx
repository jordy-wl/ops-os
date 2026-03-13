import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/auth/resolve-org'
import { RoleList } from '@/components/roles/role-list'

export const metadata = { title: 'Roles — Settings — Ops OS' }

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
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Roles & Permissions</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Manage roles and their permission levels.</p>
        </div>
        <Link
          href="/settings/roles/new"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Create Role
        </Link>
      </div>

      {error && (
        <div
          className="mb-6 rounded-md bg-destructive/5 border border-destructive/20 px-4 py-3 text-[13px] text-destructive"
          role="alert"
        >
          Failed to load roles. Please refresh the page.
        </div>
      )}

      <RoleList roles={enriched} />
    </div>
  )
}
