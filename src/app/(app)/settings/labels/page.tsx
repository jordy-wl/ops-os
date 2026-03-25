import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { resolveOrgId } from '@/lib/auth/resolve-org'
import { LabelsManager } from '@/components/settings/labels-manager'

export const metadata = { title: 'Labels — Settings — Ops OS' }

export default async function LabelsPage() {
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/org-setup')

  const internalOrgId = await resolveOrgId(orgId)
  if (!internalOrgId) redirect('/org-setup')

  return <LabelsManager />
}
