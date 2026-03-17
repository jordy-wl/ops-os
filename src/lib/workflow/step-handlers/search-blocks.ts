import { logger } from '@/lib/logger'
import type { StepHandler } from './types'

/**
 * search_blocks handler — queries blocks by type, name pattern, and metadata filters.
 *
 * Step config:
 * - search_type: block type to filter by (optional)
 * - search_name: substring match on block name (optional)
 * - search_filters: key/value pairs to match on metadata (optional)
 * - search_limit: max results (default 10, max 50)
 */
const handler: StepHandler = async (step, meta, orgId, supabase) => {
  const now = new Date().toISOString()
  const stepAny = step as Record<string, unknown>

  const searchType = stepAny.search_type as string | undefined
  const searchName = stepAny.search_name as string | undefined
  const searchFilters = stepAny.search_filters as Record<string, unknown> | undefined
  const searchLimit = Math.min(Math.max((stepAny.search_limit as number) ?? 10, 1), 50)

  // Build query
  let query = supabase
    .from('blocks')
    .select('id, name, type, metadata, status, created_at')
    .eq('org_id', orgId)

  if (searchType) {
    query = query.eq('type', searchType)
  }

  if (searchName) {
    query = query.ilike('name', `%${searchName}%`)
  }

  query = query.order('created_at', { ascending: false }).limit(searchLimit)

  const { data: blocks, error } = await query

  if (error) {
    logger.error('step-engine', 'step.search_blocks_failed', { error_code: error.code })
    return { step_name: step.name, step_type: step.type, status: 'failed', error: error.message, executed_at: now }
  }

  // Apply metadata filters client-side (Supabase doesn't support deep JSON filtering easily)
  let results = blocks ?? []
  if (searchFilters && Object.keys(searchFilters).length > 0) {
    results = results.filter((block) => {
      const metadata = (block.metadata ?? {}) as Record<string, unknown>
      return Object.entries(searchFilters).every(([key, val]) => metadata[key] === val)
    })
  }

  logger.info('step-engine', 'step.search_blocks_completed', {
    type: searchType,
    name_pattern: searchName,
    result_count: results.length,
  })

  return {
    step_name: step.name,
    step_type: step.type,
    status: 'completed',
    output: {
      results: results.map((b) => ({ id: b.id, name: b.name, type: b.type })),
      count: results.length,
      search_type: searchType,
      search_name: searchName,
    },
    executed_at: now,
  }
}

export default handler
