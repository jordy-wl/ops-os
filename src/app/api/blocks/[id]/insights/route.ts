import { NextRequest } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'
import { calculateDelta } from '@/lib/ai/delta-engine'
import type {
  DeltaInstanceMeta,
  DeltaTemplateStep,
  DeltaEvent,
} from '@/lib/ai/delta-types'

/**
 * GET /api/blocks/[id]/insights
 * Returns delta calculation + AI insights for a workflow_instance block.
 */
async function handler(
  _req: NextRequest,
  ctx: AuthContext,
  params: Record<string, string>
) {
  const id = params.id
  const supabase = createServerClient()

  // 1. Fetch the block
  const { data: block, error: blockError } = await supabase
    .from('blocks')
    .select('id, type, name, metadata')
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .single()

  if (blockError || !block) {
    return apiError('Block not found', 'blocks/not-found', 404)
  }

  // Only workflow_instance blocks have insights
  if (block.type !== 'workflow_instance') {
    return apiError('Insights only available for workflow instances', 'blocks/not-workflow-instance', 404)
  }

  const meta = block.metadata as DeltaInstanceMeta
  if (!meta?.template_id) {
    return apiError('Missing template_id in instance metadata', 'blocks/invalid-metadata', 400)
  }

  // 2. Fetch the template
  const { data: template } = await supabase
    .from('blocks')
    .select('metadata')
    .eq('id', meta.template_id)
    .eq('type', 'workflow_template')
    .single()

  if (!template) {
    return apiError('Workflow template not found', 'blocks/template-not-found', 404)
  }

  const templateMeta = template.metadata as { steps: DeltaTemplateStep[] }
  const steps: DeltaTemplateStep[] = templateMeta?.steps ?? []

  // 3. Fetch events for this instance
  const { data: events } = await supabase
    .from('events')
    .select('id, type, occurred_at, payload')
    .eq('block_id', id)
    .eq('org_id', ctx.orgId)
    .order('occurred_at', { ascending: false })
    .limit(50)

  const deltaEvents: DeltaEvent[] = (events ?? []).map((e) => ({
    id: e.id,
    type: e.type,
    occurred_at: e.occurred_at,
    payload: (e.payload ?? {}) as Record<string, unknown>,
  }))

  // 4. Calculate delta
  const delta = calculateDelta(id, meta, steps, deltaEvents)

  // 5. Try to generate AI insights (optional — gracefully falls back)
  let insights = null
  try {
    const { generateInsights } = await import('@/lib/ai/insights-generator')
    const lastEventId = deltaEvents[0]?.id ?? 'none'
    insights = await generateInsights(delta, {
      blockId: id,
      blockName: block.name,
      blockType: block.type,
      lastEventId,
    })
  } catch (err) {
    logger.warn('api-insights', 'insights.generation_skipped', {
      block_id: id,
      error: err instanceof Error ? err.message : 'Unknown',
    })
  }

  logger.info('api-insights', 'insights.served', {
    block_id: id,
    health_score: delta.healthScore.score,
    from_cache: insights?.fromCache ?? false,
  })

  return ok({ delta, insights })
}

export const GET = withAuth(handler)
