import { createServerClient } from '@/lib/supabase/server'

/**
 * Translates a Clerk organisation ID to the internal Supabase org UUID.
 *
 * Server components must call this before querying any org-scoped table.
 * Those tables store the internal UUID (from the `orgs` row), not the Clerk
 * org ID — the same translation that `withAuth` performs for API routes.
 *
 * Returns null if the org has not yet been provisioned (first API call
 * via `withAuth` auto-provisions it; server components should redirect
 * to /org-setup if null is returned).
 */
export async function resolveOrgId(clerkOrgId: string): Promise<string | null> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('orgs')
    .select('id')
    .eq('clerk_org_id', clerkOrgId)
    .single()
  return data?.id ?? null
}
