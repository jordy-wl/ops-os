import { clerkClient } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { seedSystemBlockTypes } from '@/lib/block-types/seed-system-types'

/**
 * Fetches the org name from Clerk by org ID.
 * Returns null on failure — callers should not block on this.
 */
async function fetchClerkOrgName(clerkOrgId: string): Promise<{ name: string; slug: string } | null> {
  try {
    const client = await clerkClient()
    const org = await client.organizations.getOrganization({ organizationId: clerkOrgId })
    return { name: org.name, slug: org.slug ?? '' }
  } catch {
    logger.warn('resolve-org', 'clerk.org_fetch_failed', { clerk_org_id: clerkOrgId })
    return null
  }
}

/**
 * Translates a Clerk organisation ID to the internal Supabase org UUID.
 * Auto-provisions the Supabase org row on first call if it does not exist,
 * matching the lazy-init behaviour of withAuth for API routes.
 *
 * Also syncs org name/slug from Clerk on first provision and backfills
 * existing orgs where name is null. On new org provision, seeds the
 * 5 system block types automatically.
 *
 * Returns null only on an unexpected DB error — callers should treat null
 * as a transient failure, not a signal to redirect to /org-setup.
 */
export async function resolveOrgId(clerkOrgId: string): Promise<string | null> {
  const supabase = createServerClient()

  const { data: existing } = await supabase
    .from('orgs')
    .select('id, name')
    .eq('clerk_org_id', clerkOrgId)
    .single()

  if (existing?.id) {
    // Backfill name if missing
    if (!existing.name) {
      const clerkOrg = await fetchClerkOrgName(clerkOrgId)
      if (clerkOrg) {
        await supabase
          .from('orgs')
          .update({ name: clerkOrg.name, slug: clerkOrg.slug })
          .eq('id', existing.id)
      }
    }
    return existing.id
  }

  // Org not yet in Supabase — provision with name from Clerk
  const clerkOrg = await fetchClerkOrgName(clerkOrgId)
  const { data: newOrg } = await supabase
    .from('orgs')
    .insert({
      clerk_org_id: clerkOrgId,
      ...(clerkOrg ? { name: clerkOrg.name, slug: clerkOrg.slug } : {}),
    })
    .select('id')
    .single()

  if (newOrg?.id) {
    await seedSystemBlockTypes(newOrg.id)
  }

  return newOrg?.id ?? null
}