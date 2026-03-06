import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { SYSTEM_BLOCK_TYPES } from './system-types'

/**
 * Seeds the 5 canonical system block types for an org.
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
