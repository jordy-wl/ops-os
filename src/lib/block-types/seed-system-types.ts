import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { SYSTEM_BLOCK_TYPES, SINGLETON_BLOCK_TYPES } from './system-types'

/**
 * Seeds system block type definitions for an org.
 * Idempotent — uses ON CONFLICT DO NOTHING so running twice is safe.
 * Called during org auto-provision in resolveOrgId().
 */
export async function seedSystemBlockTypes(orgId: string): Promise<void> {
  const supabase = createServerClient()

  const rows = SYSTEM_BLOCK_TYPES.map((t) => ({
    org_id: orgId,
    type_name: t.type_name,
    display_name: t.display_name,
    description: t.description,
    field_schema: t.field_schema,
    icon: t.icon,
    color: t.color,
    is_system: true,
  }))

  const { error } = await supabase
    .from('block_type_definitions')
    .upsert(rows, { onConflict: 'org_id,type_name', ignoreDuplicates: true })

  if (error) {
    // Non-blocking — org still works without type definitions
    logger.warn('seed-system-types', 'db.seed_failed', {
      org_id: orgId,
      error_code: error.code,
    })
  }
}

/**
 * Ensures the singleton organisation block exists for an org.
 * Lazy-creates it on first call. Idempotent — safe to call repeatedly.
 * Returns the org block ID if found/created, null on failure.
 */
export async function ensureOrgBlock(
  orgId: string,
  orgName?: string
): Promise<string | null> {
  const supabase = createServerClient()

  // Check if it already exists
  const { data: existing } = await supabase
    .from('blocks')
    .select('id')
    .eq('org_id', orgId)
    .eq('type', 'organisation')
    .limit(1)
    .single()

  if (existing) return existing.id

  // Create the singleton block
  const { data, error } = await supabase
    .from('blocks')
    .insert({
      org_id: orgId,
      type: 'organisation',
      name: orgName ?? 'Organisation',
      state: 'active',
      metadata: {},
    })
    .select('id')
    .single()

  if (error) {
    logger.warn('seed-system-types', 'org_block.create_failed', {
      org_id: orgId,
      error_code: error.code,
    })
    return null
  }

  return data.id
}

/**
 * Check if a block type is a singleton (only one instance allowed per org).
 */
export function isSingletonType(typeName: string): boolean {
  return SINGLETON_BLOCK_TYPES.has(typeName)
}
