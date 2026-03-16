import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/auth/resolve-org'
import { BlockListClient } from '@/components/blocks/block-list-client'
import type { Block } from '@/lib/context-assembly'

export default async function BlockListPage() {
  const { userId, orgId } = await auth()

  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/org-setup')

  const internalOrgId = await resolveOrgId(orgId)
  if (!internalOrgId) return <BlockListClient blocks={[]} />

  const supabase = createServerClient()

  const { data: blocks } = await supabase
    .from('blocks')
    .select('*')
    .eq('org_id', internalOrgId)
    .order('updated_at', { ascending: false })

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold text-foreground mb-6">Blocks</h1>
      <BlockListClient blocks={(blocks ?? []) as Block[]} />
    </div>
  )
}
