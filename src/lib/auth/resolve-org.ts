import { createServerClient } from '@/lib/supabase/server'

/**
 * Translates a Clerk organisation ID to the internal Supabase org UUID.
 * Auto-provisions the Supabase org row on first call if it does not exist,
 * matching the lazy-init behaviour of withAuth for API routes.
 *
 * Returns null only on an unexpected DB error — callers should treat null
 * as a transient failure, not a signal to redirect to /org-setup.
 * Redirect to /org-setup only when Clerk itself has no orgId (handled by
 * AppLayout, which already guards the entire (app) route group).
 */
export async function resolveOrgId(clerkOrgId: string): Promise<string | null> {
  const supabase = createServerClient()

  const { data: existing } = await supabase
    .from('orgs')
    .select('id')
    .eq('clerk_org_id', clerkOrgId)
    .single()

  if (existing?.id) return existing.id

  // Org not yet in Supabase — provision it now (same as withAuth does for API routes)
  const { data: newOrg } = await supabase
    .from('orgs')
    .insert({ clerk_org_id: clerkOrgId })
    .select('id')
    .single()

  return newOrg?.id ?? null
}
