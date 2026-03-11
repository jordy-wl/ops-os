import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { apiError, validationError } from '@/lib/api/responses'

const QuerySchema = z.object({
  path: z.string().min(1),
  blockId: z.string().uuid().optional(),
})

export type PageContext = {
  pageType: 'dashboard' | 'block_detail' | 'workflow_builder' | 'workflows' | 'library' | 'other'
  block?: {
    id: string
    name: string
    type: string
    state: string
    metadata: Record<string, unknown>
  }
  recentEvents?: Array<{
    type: string
    occurred_at: string
    actor_type: string
    payload: Record<string, unknown>
  }>
  relatedBlocks?: Array<{
    id: string
    name: string
    type: string
  }>
  workflowTemplate?: {
    id: string
    name: string
    steps: number
  }
}

function detectPageType(path: string): PageContext['pageType'] {
  if (path === '/' || path === '/dashboard') return 'dashboard'
  if (/^\/blocks\/[^/]+$/.test(path) || /^\/library\/blocks\/[^/]+$/.test(path)) return 'block_detail'
  if (/^\/workflows\/[^/]+\/builder/.test(path)) return 'workflow_builder'
  if (path === '/workflows' || path.startsWith('/workflows')) return 'workflows'
  if (path.startsWith('/library')) return 'library'
  return 'other'
}

const MAX_RECENT_EVENTS = 5
const MAX_RELATED_BLOCKS = 10

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const url = new URL(req.url)
  const raw = {
    path: url.searchParams.get('path') ?? '',
    blockId: url.searchParams.get('blockId') ?? undefined,
  }

  const parsed = QuerySchema.safeParse(raw)
  if (!parsed.success) return validationError(parsed.error.issues)

  const { path: routePath, blockId } = parsed.data
  const pageType = detectPageType(routePath)

  const result: PageContext = { pageType }

  // For block detail pages, fetch the block + events + related
  if (blockId && (pageType === 'block_detail' || pageType === 'workflow_builder')) {
    const supabase = createServerClient()

    const { data: block } = await supabase
      .from('blocks')
      .select('id, name, type, state, metadata')
      .eq('id', blockId)
      .eq('org_id', ctx.orgId)
      .single()

    if (block) {
      result.block = block as PageContext['block']

      // Recent events for this block
      const { data: events } = await supabase
        .from('events')
        .select('type, occurred_at, actor_type, payload')
        .eq('block_id', blockId)
        .eq('org_id', ctx.orgId)
        .order('occurred_at', { ascending: false })
        .limit(MAX_RECENT_EVENTS)

      result.recentEvents = (events ?? []) as PageContext['recentEvents']

      // Related blocks via edges
      const { data: edges } = await supabase
        .from('block_edges')
        .select('from_block_id, to_block_id')
        .eq('org_id', ctx.orgId)
        .or(`from_block_id.eq.${blockId},to_block_id.eq.${blockId}`)
        .limit(MAX_RELATED_BLOCKS)

      if (edges && edges.length > 0) {
        const neighbourIds = [
          ...new Set(
            edges
              .flatMap((e: { from_block_id: string; to_block_id: string }) => [
                e.from_block_id,
                e.to_block_id,
              ])
              .filter((id: string) => id !== blockId)
          ),
        ]

        if (neighbourIds.length > 0) {
          const { data: related } = await supabase
            .from('blocks')
            .select('id, name, type')
            .in('id', neighbourIds)
            .eq('org_id', ctx.orgId)

          result.relatedBlocks = (related ?? []) as PageContext['relatedBlocks']
        }
      }

      // For workflow builder, add step count
      if (pageType === 'workflow_builder' && block.type === 'workflow_template') {
        const meta = block.metadata as Record<string, unknown>
        const steps = Array.isArray(meta?.steps) ? meta.steps.length : 0
        result.workflowTemplate = { id: block.id, name: block.name, steps }
      }
    }
  }

  return NextResponse.json({ data: result })
})
