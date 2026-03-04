import { createServerClient } from '@/lib/supabase/server'
import { seedSystemBlockTypes } from '@/lib/block-types/seed-system-types'

/**
 * Translates a Clerk organisation ID to the internal Supabase org UUID.
 * Auto-provisions the Supabase org row on first call if it does not exist,
 * matching the lazy-init behaviour of withAuth for API routes.
 *
 * On new org provision, seeds the 5 system block types automatically.
 *
 * Returns null only on an unexpected DB error — callers should treat null
 * as a transient failure, not a signal to redirect to /org-setup.
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

  if (newOrg?.id) {
    // Seed system block types for the new org (non-blocking)
    await seedSystemBlockTypes(newOrg.id)
  }

  return newOrg?.id ?? null
}
