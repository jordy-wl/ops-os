/**
 * Delta Context Loader — fetches workflow instance data and computes a delta
 * context string for injection into the chat system prompt.
 *
 * Extracted from the insights API route pattern so it can be reused by chat.
 * Returns null on any failure — never throws.
 */

import { createServerClient } from '@/lib/supabase/server'
import { calculateDelta } from '@/lib/ai/delta-engine'
import { buildDeltaContextString } from '@/lib/ai/delta-context'
import { logger } from '@/lib/logger'
import type {
  DeltaInstanceMeta,
  DeltaTemplateStep,
  DeltaEvent,
} from '@/lib/ai/delta-types'

/**
 * Load delta context for a workflow_instance block.
 * Returns a formatted string or null if the block isn't a valid workflow instance.
 */
export async function loadDeltaContext(
  blockId: string,
  orgId: string
): Promise<string | null> {
  try {
    const supabase = createServerClient()

    // Fetch the block metadata
    const { data: block } = await supabase
      .from('blocks')
      .select('id, type, metadata')
      .eq('id', blockId)
      .eq('org_id', orgId)
      .single()

    if (!block || block.type !== 'workflow_instance') return null

    const meta = block.metadata as DeltaInstanceMeta
    if (!meta?.template_id) return null

    // Fetch template steps and events in parallel
    const [templateResult, eventsResult] = await Promise.all([
      supabase
        .from('blocks')
        .select('metadata')
        .eq('id', meta.template_id)
        .eq('type', 'workflow_template')
        .single(),
      supabase
        .from('events')
        .select('id, type, occurred_at, payload')
        .eq('block_id', blockId)
        .eq('org_id', orgId)
        .order('occurred_at', { ascending: false })
        .limit(50),
    ])

    if (!templateResult.data) return null

    const templateMeta = templateResult.data.metadata as { steps: DeltaTemplateStep[] }
    const steps: DeltaTemplateStep[] = templateMeta?.steps ?? []

    const deltaEvents: DeltaEvent[] = (eventsResult.data ?? []).map(
      (e: { id: string; type: string; occurred_at: string; payload: Record<string, unknown> }) => ({
        id: e.id,
        type: e.type,
        occurred_at: e.occurred_at,
        payload: (e.payload ?? {}) as Record<string, unknown>,
      })
    )

    const delta = calculateDelta(blockId, meta, steps, deltaEvents)
    return buildDeltaContextString(delta)
  } catch (err) {
    logger.warn('delta-context-loader', 'delta.load_failed', {
      block_id: blockId,
      error: (err as Error).message?.slice(0, 100),
    })
    return null
  }
}
