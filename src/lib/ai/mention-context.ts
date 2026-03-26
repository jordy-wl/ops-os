/**
 * mention-context.ts — Server-side resolution of @mention tokens into
 * contextual data strings for injection into the AI system prompt.
 *
 * Each MentionResolution kind maps to a specific database query that
 * fetches real block data scoped to the authenticated org.
 *
 * Security: field names are validated against the block_type_definitions
 * field_schema before being used in queries to prevent JSONB path injection.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { logger } from '@/lib/logger'

const SERVICE = 'mention-context'

// ─── Validation Schema ───────────────────────────────────────────────────────

export const MentionInputSchema = z.array(
  z.object({
    kind: z.enum(['block', 'type_query', 'field_query', 'value_query']),
    blockId: z.string().uuid().optional(),
    blockName: z.string().max(200).optional(),
    blockType: z.string().max(100).optional(),
    type: z.string().max(100).optional(),
    field: z.string().max(100).optional(),
    value: z.string().max(500).optional(),
    displayName: z.string().max(300).optional(),
  })
).max(10) // Limit to 10 mentions per message to bound query cost

export type MentionInput = z.infer<typeof MentionInputSchema>[number]

// ─── Field Validation ────────────────────────────────────────────────────────

/**
 * Validate that a field name exists in the block_type_definitions field_schema
 * for the given type. Returns true if the field is valid, false otherwise.
 *
 * This prevents JSONB path injection by ensuring only known field names are
 * used in metadata queries.
 */
async function isValidField(
  supabase: SupabaseClient,
  orgId: string,
  typeName: string,
  fieldName: string
): Promise<boolean> {
  const { data: typeDef } = await supabase
    .from('block_type_definitions')
    .select('field_schema')
    .eq('type_name', typeName)
    .or(`org_id.eq.${orgId},org_id.is.null`)
    .limit(1)
    .maybeSingle()

  if (!typeDef?.field_schema) return false

  const schema = typeDef.field_schema as {
    properties?: Record<string, unknown>
  }
  const properties = schema.properties ?? {}
  return fieldName in properties
}

// ─── Per-Kind Resolvers ──────────────────────────────────────────────────────

async function resolveBlock(
  supabase: SupabaseClient,
  orgId: string,
  mention: MentionInput
): Promise<string | null> {
  if (!mention.blockId) return null

  const { data: block, error } = await supabase
    .from('blocks')
    .select('id, name, type, state, metadata, created_at, updated_at, owner_id')
    .eq('id', mention.blockId)
    .eq('org_id', orgId)
    .single()

  if (error || !block) {
    logger.warn(SERVICE, 'resolve.block_not_found', {
      block_id: mention.blockId,
      org_id: orgId,
    })
    return null
  }

  const lines: string[] = [
    `[Block: "${block.name}" (${block.type})]`,
    `  ID: ${block.id}`,
    `  State: ${block.state}`,
    `  Created: ${block.created_at}`,
    `  Updated: ${block.updated_at}`,
  ]

  if (block.owner_id) {
    lines.push(`  Owner ID: ${block.owner_id}`)
  }

  // Format metadata fields as key-value pairs
  const metadata = block.metadata as Record<string, unknown> | null
  if (metadata && Object.keys(metadata).length > 0) {
    lines.push('  Metadata:')
    for (const [key, value] of Object.entries(metadata)) {
      const displayValue = value === null || value === undefined
        ? '(empty)'
        : typeof value === 'object'
          ? JSON.stringify(value).slice(0, 200)
          : String(value).slice(0, 200)
      lines.push(`    ${key}: ${displayValue}`)
    }
  }

  return lines.join('\n')
}

async function resolveTypeQuery(
  supabase: SupabaseClient,
  orgId: string,
  mention: MentionInput
): Promise<string | null> {
  if (!mention.type) return null

  // Run count and recent names in parallel
  const [countResult, recentResult] = await Promise.all([
    supabase
      .from('blocks')
      .select('id', { count: 'exact', head: true })
      .eq('type', mention.type)
      .eq('org_id', orgId),
    supabase
      .from('blocks')
      .select('name')
      .eq('type', mention.type)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const total = countResult.count ?? 0
  const recentNames = (recentResult.data ?? []).map(
    (b: { name: string }) => b.name
  )

  const displayName = mention.displayName ?? mention.type
  const lines: string[] = [
    `[Type Query: ${displayName}]`,
    `  Total ${mention.type} blocks: ${total}`,
  ]

  if (recentNames.length > 0) {
    lines.push(`  Most recent: ${recentNames.join(', ')}`)
  } else {
    lines.push('  No blocks of this type found.')
  }

  return lines.join('\n')
}

async function resolveFieldQuery(
  supabase: SupabaseClient,
  orgId: string,
  mention: MentionInput
): Promise<string | null> {
  if (!mention.type || !mention.field) return null

  // Validate field against schema
  const valid = await isValidField(supabase, orgId, mention.type, mention.field)
  if (!valid) {
    logger.warn(SERVICE, 'resolve.invalid_field', {
      type: mention.type,
      field: mention.field,
      org_id: orgId,
    })
    return null
  }

  // Fetch blocks of this type and aggregate field values in code.
  // Supabase JS doesn't support DISTINCT + GROUP BY on JSONB easily,
  // and at prototype scale the block count per type per org is bounded.
  const { data: blocks, error } = await supabase
    .from('blocks')
    .select('metadata')
    .eq('org_id', orgId)
    .eq('type', mention.type)
    .not('metadata', 'is', null)

  if (error) {
    logger.warn(SERVICE, 'resolve.field_query_failed', {
      type: mention.type,
      field: mention.field,
      error_code: error.code,
    })
    return null
  }

  // Aggregate value distribution
  const fieldKey = mention.field!
  const valueCounts: Record<string, number> = {}
  for (const block of blocks ?? []) {
    const meta = block.metadata as Record<string, unknown> | null
    if (!meta) continue
    const rawValue = meta[fieldKey]
    if (rawValue == null) continue
    const strValue = String(rawValue)
    valueCounts[strValue] = (valueCounts[strValue] ?? 0) + 1
  }

  // Sort by count descending, take top 10
  const sorted = Object.entries(valueCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)

  const displayName = mention.displayName ?? `${mention.type}/${mention.field}`
  const lines: string[] = [
    `[Field Query: ${displayName}]`,
    `  Distribution of "${mention.field}" values across ${mention.type} blocks:`,
  ]

  if (sorted.length > 0) {
    for (const [value, count] of sorted) {
      lines.push(`    ${value}: ${count}`)
    }
  } else {
    lines.push('    No values found for this field.')
  }

  return lines.join('\n')
}

async function resolveValueQuery(
  supabase: SupabaseClient,
  orgId: string,
  mention: MentionInput
): Promise<string | null> {
  if (!mention.type || !mention.field || !mention.value) return null

  // Validate field against schema
  const valid = await isValidField(supabase, orgId, mention.type, mention.field)
  if (!valid) {
    logger.warn(SERVICE, 'resolve.invalid_field_for_value', {
      type: mention.type,
      field: mention.field,
      org_id: orgId,
    })
    return null
  }

  // Fetch blocks matching this type + field value.
  // We filter in code because Supabase JS JSONB filtering via ->> in .eq()
  // requires a specific pattern. Fetching all of the type and filtering
  // in-memory is bounded at prototype scale.
  const { data: blocks, error } = await supabase
    .from('blocks')
    .select('name, metadata')
    .eq('org_id', orgId)
    .eq('type', mention.type)
    .not('metadata', 'is', null)
    .order('name', { ascending: true })

  if (error) {
    logger.warn(SERVICE, 'resolve.value_query_failed', {
      type: mention.type,
      field: mention.field,
      value: mention.value,
      error_code: error.code,
    })
    return null
  }

  // Filter blocks where metadata[field] === value
  const matching = (blocks ?? [])
    .filter((b: { metadata: Record<string, unknown> | null }) => {
      const meta = b.metadata
      if (!meta) return false
      return String(meta[mention.field!]) === mention.value
    })
    .slice(0, 10)

  const displayName = mention.displayName
    ?? `${mention.type}/${mention.field}/${mention.value}`
  const matchingNames = matching.map((b: { name: string }) => b.name)

  const lines: string[] = [
    `[Value Query: ${displayName}]`,
    `  ${mention.type} blocks where ${mention.field} = "${mention.value}":`,
  ]

  if (matchingNames.length > 0) {
    lines.push(`  Matches (${matchingNames.length}): ${matchingNames.join(', ')}`)
  } else {
    lines.push('  No matching blocks found.')
  }

  return lines.join('\n')
}

// ─── Main Resolution Function ────────────────────────────────────────────────

/**
 * Resolve an array of mention inputs into a formatted context string.
 *
 * Each mention is resolved independently. Failed resolutions are silently
 * skipped (logged at warn level). The result is a single string ready for
 * injection into the system prompt between <MENTION_CONTEXT> tags.
 *
 * Returns null if no mentions could be resolved.
 */
export async function resolveMentionContext(
  supabase: SupabaseClient,
  orgId: string,
  mentions: MentionInput[]
): Promise<string | null> {
  if (!mentions || mentions.length === 0) return null

  const resolvedParts: string[] = []

  // Resolve all mentions in parallel for performance
  const results = await Promise.all(
    mentions.map(async (mention) => {
      try {
        switch (mention.kind) {
          case 'block':
            return await resolveBlock(supabase, orgId, mention)
          case 'type_query':
            return await resolveTypeQuery(supabase, orgId, mention)
          case 'field_query':
            return await resolveFieldQuery(supabase, orgId, mention)
          case 'value_query':
            return await resolveValueQuery(supabase, orgId, mention)
          default:
            return null
        }
      } catch (err) {
        logger.warn(SERVICE, 'resolve.mention_failed', {
          kind: mention.kind,
          org_id: orgId,
          error: (err as Error).message?.slice(0, 100),
        })
        return null
      }
    })
  )

  for (const result of results) {
    if (result) resolvedParts.push(result)
  }

  if (resolvedParts.length === 0) return null

  return resolvedParts.join('\n\n')
}
