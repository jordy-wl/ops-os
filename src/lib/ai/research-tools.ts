/**
 * research-tools.ts — Duplicate detection via embeddings search.
 *
 * Before creating a block, search for similar existing blocks to prevent duplicates.
 * Uses the match_embeddings RPC function for cosine similarity search.
 */

import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

const DUPLICATE_THRESHOLD = 0.85
const MAX_DUPLICATE_RESULTS = 5

export type DuplicateMatch = {
  source_id: string
  content: string
  similarity: number
}

/**
 * Search for potential duplicate blocks by name similarity.
 * Uses ilike name search (fast, no OpenAI dependency) as primary check.
 * Returns matching blocks with similarity indicator.
 */
export async function checkForDuplicates(
  name: string,
  type: string,
  orgId: string
): Promise<{ hasDuplicates: boolean; matches: DuplicateMatch[] }> {
  const supabase = createServerClient()

  try {
    // Simple name-based duplicate check (fast, no embedding dependency)
    const { data, error } = await supabase
      .from('blocks')
      .select('id, name, type')
      .eq('org_id', orgId)
      .eq('type', type)
      .eq('state', 'active')
      .ilike('name', `%${name}%`)
      .limit(MAX_DUPLICATE_RESULTS)

    if (error) {
      logger.error('research-tools', 'duplicate_check.query_failed', {
        error_code: error.code,
      })
      return { hasDuplicates: false, matches: [] }
    }

    const matches: DuplicateMatch[] = (data ?? []).map((block) => ({
      source_id: block.id,
      content: `${block.type}: ${block.name}`,
      similarity: calculateNameSimilarity(name.toLowerCase(), block.name.toLowerCase()),
    }))

    const highMatches = matches.filter((m) => m.similarity >= DUPLICATE_THRESHOLD)

    return {
      hasDuplicates: highMatches.length > 0,
      matches: highMatches,
    }
  } catch (err) {
    logger.error('research-tools', 'duplicate_check.failed', {
      error: (err as Error).message?.slice(0, 100),
    })
    return { hasDuplicates: false, matches: [] }
  }
}

/**
 * Simple string similarity (Dice coefficient) for name matching.
 * Returns 0-1 where 1 is identical.
 */
function calculateNameSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0

  const bigramsA = new Set<string>()
  for (let i = 0; i < a.length - 1; i++) bigramsA.add(a.substring(i, i + 2))

  let intersectionSize = 0
  for (let i = 0; i < b.length - 1; i++) {
    if (bigramsA.has(b.substring(i, i + 2))) intersectionSize++
  }

  return (2 * intersectionSize) / (a.length - 1 + (b.length - 1))
}
