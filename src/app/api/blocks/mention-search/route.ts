import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

const SERVICE = 'api-mention-search'

/**
 * Query param schema — stage determines which additional params are required.
 */
const StageEnum = z.enum(['type', 'field', 'value'])

/**
 * Prettify a snake_case field name to Title Case.
 * e.g. "contact_email" -> "Contact Email"
 */
function prettifyFieldName(field: string): string {
  return field
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * GET /api/blocks/mention-search
 *
 * 3-stage hierarchical mention search for the chat @mention picker.
 *
 * Stage 1 (type):  List block types matching query, with block counts.
 * Stage 2 (field): List fields for a given block type matching query.
 * Stage 3 (value): List distinct metadata values for a given type+field matching query.
 */
export const GET = withAuth(async (req: NextRequest, ctx) => {
  // Permission check — require view_blocks
  if (!ctx.permissions.has('view_blocks')) {
    return apiError('Insufficient permissions', 'auth/forbidden', 403)
  }

  const { searchParams } = new URL(req.url)
  const rawStage = searchParams.get('stage')
  const q = searchParams.get('q') ?? ''
  const type = searchParams.get('type')
  const field = searchParams.get('field')

  // --- Validate stage ---
  const stageParsed = StageEnum.safeParse(rawStage)
  if (!stageParsed.success) {
    return apiError(
      'Missing or invalid "stage" parameter. Must be one of: type, field, value',
      'validation/invalid-stage',
      400
    )
  }
  const stage = stageParsed.data

  // --- Validate stage-dependent params ---
  if ((stage === 'field' || stage === 'value') && !type) {
    return apiError(
      '"type" parameter is required when stage is "field" or "value"',
      'validation/missing-type',
      400
    )
  }
  if (stage === 'value' && !field) {
    return apiError(
      '"field" parameter is required when stage is "value"',
      'validation/missing-field',
      400
    )
  }

  const supabase = createServerClient()

  try {
    // ===== STAGE 1: TYPE =====
    if (stage === 'type') {
      // Fetch block type definitions for this org (including system types with org_id = null)
      let typeQuery = supabase
        .from('block_type_definitions')
        .select('type_name, display_name, icon')
        .or(`org_id.eq.${ctx.orgId},org_id.is.null`)

      if (q) {
        typeQuery = typeQuery.ilike('display_name', `%${q}%`)
      }

      const { data: types, error: typeError } = await typeQuery

      if (typeError) {
        logger.error(SERVICE, 'stage.type.query_failed', { error_code: typeError.code })
        return apiError('Failed to fetch block types', 'db/query-failed', 500)
      }

      if (!types || types.length === 0) {
        return ok([])
      }

      // Count blocks per type for this org (single query, not N+1)
      const typeNames = types.map((t) => t.type_name)
      const { data: counts, error: countError } = await supabase
        .from('blocks')
        .select('type')
        .eq('org_id', ctx.orgId)
        .in('type', typeNames)

      if (countError) {
        logger.error(SERVICE, 'stage.type.count_failed', { error_code: countError.code })
        return apiError('Failed to count blocks', 'db/query-failed', 500)
      }

      // Build a count map
      const countMap: Record<string, number> = {}
      for (const row of counts ?? []) {
        countMap[row.type] = (countMap[row.type] ?? 0) + 1
      }

      const result = types.map((t) => ({
        type_name: t.type_name,
        display_name: t.display_name,
        icon: t.icon,
        block_count: countMap[t.type_name] ?? 0,
      }))

      return ok(result)
    }

    // ===== STAGE 2: FIELD =====
    if (stage === 'field') {
      // Fetch the field_schema for the requested type
      const { data: typeDef, error: typeError } = await supabase
        .from('block_type_definitions')
        .select('field_schema')
        .eq('type_name', type!)
        .or(`org_id.eq.${ctx.orgId},org_id.is.null`)
        .limit(1)
        .maybeSingle()

      if (typeError) {
        logger.error(SERVICE, 'stage.field.query_failed', { error_code: typeError.code })
        return apiError('Failed to fetch type definition', 'db/query-failed', 500)
      }

      if (!typeDef || !typeDef.field_schema) {
        return ok([])
      }

      // Extract properties from JSON schema
      const schema = typeDef.field_schema as {
        properties?: Record<string, { type?: string; [key: string]: unknown }>
      }
      const properties = schema.properties ?? {}

      const fields = Object.entries(properties)
        .map(([key, def]) => ({
          field: key,
          label: prettifyFieldName(key),
          field_type: (def.type as string) ?? 'unknown',
        }))
        .filter((f) => {
          if (!q) return true
          return f.field.toLowerCase().includes(q.toLowerCase()) ||
            f.label.toLowerCase().includes(q.toLowerCase())
        })

      return ok(fields)
    }

    // ===== STAGE 3: VALUE =====
    if (stage === 'value') {
      // First, validate the field exists in the type's schema (prevent injection)
      const { data: typeDef, error: typeError } = await supabase
        .from('block_type_definitions')
        .select('field_schema')
        .eq('type_name', type!)
        .or(`org_id.eq.${ctx.orgId},org_id.is.null`)
        .limit(1)
        .maybeSingle()

      if (typeError) {
        logger.error(SERVICE, 'stage.value.schema_query_failed', { error_code: typeError.code })
        return apiError('Failed to fetch type definition', 'db/query-failed', 500)
      }

      if (!typeDef || !typeDef.field_schema) {
        return apiError('Block type not found or has no field schema', 'validation/unknown-type', 400)
      }

      const schema = typeDef.field_schema as {
        properties?: Record<string, unknown>
      }
      const properties = schema.properties ?? {}

      if (!(field! in properties)) {
        return apiError(
          `Field "${field}" does not exist on block type "${type}"`,
          'validation/unknown-field',
          400
        )
      }

      // Query distinct values from block metadata using Supabase's ->> operator
      // We use an RPC or raw filter to get distinct values with counts.
      // Supabase JS client doesn't directly support DISTINCT + GROUP BY on JSONB fields,
      // so we fetch matching blocks and aggregate in code. This is bounded by the
      // org's block count for that type, which is manageable at prototype scale.
      const blocksQuery = supabase
        .from('blocks')
        .select('metadata')
        .eq('org_id', ctx.orgId)
        .eq('type', type!)
        .not('metadata', 'is', null)

      const { data: blocks, error: blocksError } = await blocksQuery

      if (blocksError) {
        logger.error(SERVICE, 'stage.value.blocks_query_failed', { error_code: blocksError.code })
        return apiError('Failed to fetch block values', 'db/query-failed', 500)
      }

      // Aggregate distinct values with counts
      const valueCounts: Record<string, number> = {}
      const fieldKey = field!
      const lowerQ = q.toLowerCase()

      for (const block of blocks ?? []) {
        const meta = block.metadata as Record<string, unknown> | null
        if (!meta) continue
        const rawValue = meta[fieldKey]
        if (rawValue == null) continue
        const strValue = String(rawValue)
        if (q && !strValue.toLowerCase().includes(lowerQ)) continue
        valueCounts[strValue] = (valueCounts[strValue] ?? 0) + 1
      }

      // Sort by count descending, limit to 10
      const result = Object.entries(valueCounts)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      return ok(result)
    }

    // Should be unreachable due to enum validation above
    return apiError('Invalid stage', 'validation/invalid-stage', 400)
  } catch (err) {
    logger.error(SERVICE, 'mention_search.unhandled_error', {
      stage,
      error_message: err instanceof Error ? err.message : 'unknown',
    })
    return apiError('Internal server error', 'internal/unhandled', 500)
  }
})
