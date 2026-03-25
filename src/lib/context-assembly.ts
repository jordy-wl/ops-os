import OpenAI from 'openai'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Block = {
  id: string
  org_id: string
  type: string
  name: string
  state: string
  metadata: Record<string, unknown>
  owner_id: string | null
  created_at: string
  updated_at: string
}

export type Event = {
  id: string
  org_id: string
  block_id: string
  type: string
  actor_id: string
  actor_type: string
  payload: Record<string, unknown>
  occurred_at: string
}

export type Org = {
  id: string
  clerk_org_id: string
  name: string | null
  slug: string | null
  created_at: string
}

export type UserTaskSummary = {
  id: string
  name: string
  priority: string
  status: string
}

export type ContextObject = {
  block: Block | null
  events: Event[]          // chronologically recent events
  relevantEvents: Event[]  // semantically similar events (empty when no query provided)
  neighbours: Block[]
  org: Org | null
  userRole: string
  userPermissions?: string[]
  userTasks?: UserTaskSummary[]
  userRecentActivity?: string[]
  orgSummary?: string      // org-level factual summary (block counts, active workflows, recent events)
  graphContext?: string     // block-level relationship summary (neighbour names+types with direction)
  deltaContext?: string     // workflow delta summary (only for workflow_instance blocks)
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Used when no query is provided — backward-compatible recency-only path */
export const MAX_CONTEXT_EVENTS = 20
/** Recency slice when a query is provided */
export const MAX_RECENT_EVENTS = 10
/** Semantic results when a query is provided */
export const MAX_SEMANTIC_EVENTS = 5

const MAX_CONTEXT_CHARS = 32_000 // ~8000 tokens at 4 chars/token

const EMBEDDING_MODEL = 'text-embedding-3-small'

// ─── Semantic Search Helpers ──────────────────────────────────────────────────

type SemanticResults = {
  eventIds: string[]
  blockIds: string[]
}

/**
 * fetchSemanticResults — embeds a query string and returns IDs of the most
 * semantically similar events and blocks in the org via the match_embeddings() RPC.
 *
 * Always returns an object with empty arrays on failure — never throws.
 */
async function fetchSemanticResults(
  query: string,
  orgId: string,
  supabase: ReturnType<typeof createServerClient>
): Promise<SemanticResults> {
  const empty: SemanticResults = { eventIds: [], blockIds: [] }

  if (!process.env.OPENAI_API_KEY) {
    logger.warn('context-assembly', 'semantic.openai_key_missing', { org_id: orgId })
    return empty
  }

  let queryEmbedding: number[]
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: query,
    })
    queryEmbedding = response.data[0].embedding
  } catch (err) {
    logger.warn('context-assembly', 'semantic.embed_failed', {
      org_id: orgId,
      error: (err as Error).message?.slice(0, 100),
    })
    return empty
  }

  // Request more results to cover both types
  const { data, error } = await supabase.rpc('match_embeddings', {
    query_embedding: queryEmbedding,
    match_count: MAX_SEMANTIC_EVENTS + 3, // extra for block results
    filter_org_id: orgId,
  })

  if (error) {
    logger.warn('context-assembly', 'semantic.rpc_failed', {
      org_id: orgId,
      error_code: error.code,
    })
    return empty
  }

  const rows = (data ?? []) as Array<{ source_type: string; source_id: string }>
  return {
    eventIds: rows
      .filter((r) => r.source_type === 'event')
      .slice(0, MAX_SEMANTIC_EVENTS)
      .map((r) => r.source_id),
    blockIds: rows
      .filter((r) => r.source_type === 'block')
      .slice(0, 3)
      .map((r) => r.source_id),
  }
}

type SemanticEnrichment = {
  relevantEvents: Event[]
  relevantBlocks: Block[]
}

/**
 * fetchSemanticEnrichment — given a query, fetches semantically similar events
 * and blocks that are NOT already present in the provided context.
 *
 * Always returns an object with empty arrays — never throws.
 */
async function fetchSemanticEnrichment(
  query: string,
  orgId: string,
  recentEvents: Event[],
  neighbours: Block[],
  supabase: ReturnType<typeof createServerClient>
): Promise<SemanticEnrichment> {
  const results = await fetchSemanticResults(query, orgId, supabase)
  const enrichment: SemanticEnrichment = { relevantEvents: [], relevantBlocks: [] }

  // Deduplicate events: exclude those already in the recency list
  const recentEventSet = new Set(recentEvents.map((e) => e.id))
  const newEventIds = results.eventIds.filter((id) => !recentEventSet.has(id))
  if (newEventIds.length > 0) {
    const { data: semEvents } = await supabase
      .from('events')
      .select('*')
      .in('id', newEventIds)
      .eq('org_id', orgId)
    enrichment.relevantEvents = (semEvents as Event[]) ?? []
  }

  // Deduplicate blocks: exclude those already in neighbours
  const neighbourSet = new Set(neighbours.map((b) => b.id))
  const newBlockIds = results.blockIds.filter((id) => !neighbourSet.has(id))
  if (newBlockIds.length > 0) {
    const { data: semBlocks } = await supabase
      .from('blocks')
      .select('*')
      .in('id', newBlockIds)
      .eq('org_id', orgId)
    enrichment.relevantBlocks = (semBlocks as Block[]) ?? []
  }

  return enrichment
}

// ─── Context Assembly ─────────────────────────────────────────────────────────

/**
 * assembleContext — given a blockId (or null for org-level scope), orgId,
 * userId, and an optional user query, fetches all relevant context for Claude.
 *
 * Memory types assembled:
 *   - Working memory:  current block data + status
 *   - Episodic memory: last N chronological events (recency)
 *   - Semantic memory: top M events similar to the query (Sprint 2 addition)
 *   - Graph context:   directly connected blocks (one hop via block_edges)
 *   - Org context:     org name + user role
 *
 * When query is provided: MAX_RECENT_EVENTS + MAX_SEMANTIC_EVENTS (deduped) ≤ 15 events
 * When query is absent:   MAX_CONTEXT_EVENTS (20) recent events — no regression
 */
export async function assembleContext(
  blockId: string | null,
  orgId: string,
  userId: string,
  query?: string,
  permissions?: string[]
): Promise<ContextObject> {
  const supabase = createServerClient()

  // Fetch org
  const { data: org } = await supabase
    .from('orgs')
    .select('*')
    .eq('id', orgId)
    .single()

  const recentLimit = query ? MAX_RECENT_EVENTS : MAX_CONTEXT_EVENTS

  // ── User context: role, tasks, recent activity (parallel) ──────────
  let userRole = 'member'
  let userTasks: UserTaskSummary[] = []
  let userRecentActivity: string[] = []

  try {
    const [roleResult, tasksResult, activityResult] = await Promise.all([
      supabase
        .from('user_roles')
        .select('role')
        .eq('org_id', orgId)
        .eq('user_id', userId)
        .single(),
      supabase
        .from('blocks')
        .select('id, name, metadata')
        .eq('org_id', orgId)
        .eq('type', 'task_queue_item')
        .or(`metadata->>assigned_to.eq.${userId},metadata->>assignee.eq.${userId}`)
        .in('state', ['open', 'claimed', 'active'])
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('events')
        .select('type, occurred_at, payload')
        .eq('org_id', orgId)
        .eq('actor_id', userId)
        .order('occurred_at', { ascending: false })
        .limit(3),
    ])

    if (roleResult.data?.role) userRole = roleResult.data.role

    userTasks = (tasksResult.data ?? []).map(
      (t: { id: string; name: string; metadata: Record<string, unknown> }) => ({
        id: t.id,
        name: t.name,
        priority: (t.metadata?.priority as string) ?? 'medium',
        status: (t.metadata?.status as string) ?? 'open',
      })
    )

    userRecentActivity = (activityResult.data ?? []).map(
      (e: { type: string; occurred_at: string }) => {
        const ago = formatTimeAgo(new Date(e.occurred_at))
        return `${e.type} (${ago})`
      }
    )
  } catch {
    // Non-critical — fall back to defaults
  }

  if (!blockId) {
    // Org-level context: recent events + org summary (parallel)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const [eventsResult, blocksResult, activeJobsResult, dayEventsResult] = await Promise.all([
      supabase.from('events').select('*').eq('org_id', orgId)
        .order('occurred_at', { ascending: false }).limit(recentLimit),
      supabase.from('blocks').select('type').eq('org_id', orgId),
      supabase.from('workflow_jobs').select('id').eq('org_id', orgId).in('status', ['pending', 'running']),
      supabase.from('events').select('id').eq('org_id', orgId).gte('occurred_at', twentyFourHoursAgo),
    ])

    const recentEvents = (eventsResult.data as Event[]) ?? []

    // Build org summary — graceful on failure
    let orgSummary: string | undefined
    try {
      const blocks = (blocksResult.data as { type: string }[]) ?? []
      const typeCounts: Record<string, number> = {}
      for (const b of blocks) {
        typeCounts[b.type] = (typeCounts[b.type] ?? 0) + 1
      }
      const typeBreakdown = Object.entries(typeCounts)
        .map(([t, c]) => `${c} ${t}`)
        .join(', ')
      const activeJobs = activeJobsResult.data?.length ?? 0
      const dayEvents = dayEventsResult.data?.length ?? 0

      orgSummary = `Organisation summary: ${blocks.length} blocks total`
        + (typeBreakdown ? ` (${typeBreakdown})` : '')
        + `, ${activeJobs} active workflows, ${dayEvents} events in the last 24 hours.`
    } catch (err) {
      logger.warn('context-assembly', 'semantic.org_summary_failed', {
        org_id: orgId,
        error: (err as Error).message?.slice(0, 100),
      })
    }

    let relevantEvents: Event[] = []
    if (query) {
      const enrichment = await fetchSemanticEnrichment(query, orgId, recentEvents, [], supabase)
      relevantEvents = enrichment.relevantEvents
    }

    return {
      block: null,
      events: recentEvents,
      relevantEvents,
      neighbours: [],
      org: org ?? null,
      userRole,
      userPermissions: permissions,
      userTasks,
      userRecentActivity,
      orgSummary,
    }
  }

  // Block-level context
  const { data: block } = await supabase
    .from('blocks')
    .select('*')
    .eq('id', blockId)
    .eq('org_id', orgId)
    .single()

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('block_id', blockId)
    .eq('org_id', orgId)
    .order('occurred_at', { ascending: false })
    .limit(recentLimit)

  const recentEvents = (events as Event[]) ?? []

  // Fetch directly connected blocks via block_edges (one hop)
  const { data: edges } = await supabase
    .from('block_edges')
    .select('from_block_id, to_block_id')
    .eq('org_id', orgId)
    .or(`from_block_id.eq.${blockId},to_block_id.eq.${blockId}`)

  let neighbours: Block[] = []
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
    const { data: neighbourBlocks } = await supabase
      .from('blocks')
      .select('*')
      .in('id', neighbourIds)
      .eq('org_id', orgId)

    neighbours = (neighbourBlocks as Block[]) ?? []
  }

  // Build graph context summary with direction labels
  let graphContext: string | undefined
  try {
    if (neighbours.length > 0 && edges) {
      const neighbourMap = new Map(neighbours.map((n) => [n.id, n]))
      const parts: string[] = []
      for (const edge of edges as { from_block_id: string; to_block_id: string }[]) {
        if (edge.from_block_id === blockId) {
          const child = neighbourMap.get(edge.to_block_id)
          if (child) parts.push(`this block → ${child.name} (${child.type})`)
        } else {
          const parent = neighbourMap.get(edge.from_block_id)
          if (parent) parts.push(`${parent.name} (${parent.type}) → this block`)
        }
      }
      graphContext = parts.length > 0
        ? `Block relationships: ${parts.join('; ')}`
        : 'Block relationships: none recorded'
    } else {
      graphContext = 'Block relationships: none recorded'
    }
  } catch (err) {
    logger.warn('context-assembly', 'semantic.graph_context_failed', {
      org_id: orgId,
      block_id: blockId,
      error: (err as Error).message?.slice(0, 100),
    })
  }

  // Semantic search enrichment — runs after all synchronous context is assembled
  let relevantEvents: Event[] = []
  let semanticBlockContext: string | undefined
  if (query) {
    const enrichment = await fetchSemanticEnrichment(query, orgId, recentEvents, neighbours, supabase)
    relevantEvents = enrichment.relevantEvents
    if (enrichment.relevantBlocks.length > 0) {
      semanticBlockContext = 'Semantically relevant blocks: ' +
        enrichment.relevantBlocks.map((b) => `"${b.name}" (${b.type})`).join(', ')
    }
  }

  return {
    block: (block as Block) ?? null,
    events: recentEvents,
    relevantEvents,
    neighbours,
    org: (org as Org) ?? null,
    userRole,
    userPermissions: permissions,
    userTasks,
    userRecentActivity,
    graphContext: [graphContext, semanticBlockContext].filter(Boolean).join('\n') || graphContext,
  }
}

// ─── Context Formatting ───────────────────────────────────────────────────────

/**
 * contextToPromptString — formats a ContextObject into a string for injection
 * into Claude's system prompt.
 *
 * When relevantEvents is non-empty, a separate "Relevant events" section is
 * appended after the recent events section, labelling the two groups clearly.
 */
export function contextToPromptString(context: ContextObject): string {
  const { block, events, neighbours, org, userRole } = context
  const relevantEvents = context.relevantEvents ?? []

  const lines: string[] = ['[CONTEXT]']

  lines.push(`Org: ${org?.name ?? 'Unknown Org'}`)
  lines.push(`User role: ${userRole}`)

  if (context.userPermissions && context.userPermissions.length > 0) {
    lines.push(`User permissions: ${context.userPermissions.join(', ')}`)
  }

  if (context.userTasks && context.userTasks.length > 0) {
    lines.push(`User's open tasks (${context.userTasks.length}):`)
    for (const task of context.userTasks) {
      lines.push(`  - "${task.name}" [${task.priority}] (${task.status})`)
    }
  }

  if (context.userRecentActivity && context.userRecentActivity.length > 0) {
    lines.push(`User's recent actions: ${context.userRecentActivity.join(', ')}`)
  }

  if (context.orgSummary) {
    lines.push(context.orgSummary)
  }

  lines.push('')

  if (block) {
    const jurisdiction = block.metadata?.jurisdiction ?? 'unset'
    lines.push(`Block: "${block.name}" (type: ${block.type}, jurisdiction: ${jurisdiction})`)

    if (context.graphContext) {
      lines.push(context.graphContext)
    } else if (neighbours.length > 0) {
      const connected = neighbours.map((n) => `"${n.name}" (${n.type})`).join(', ')
      lines.push(`Connected to: ${connected}`)
    } else {
      lines.push('Connected to: (none)')
    }
  } else {
    lines.push('Scope: org-level (no specific block)')
  }

  if (context.deltaContext) {
    lines.push('')
    lines.push(context.deltaContext)
  }

  lines.push('')
  lines.push(`Recent events (last ${events.length}, newest first):`)

  for (const event of events) {
    const payloadStr = JSON.stringify(event.payload).slice(0, 100)
    lines.push(
      `- [${event.occurred_at}] ${event.type} — actor: ${event.actor_type}/${event.actor_id} — ${payloadStr}`
    )
  }

  if (relevantEvents.length > 0) {
    lines.push('')
    lines.push(`Relevant events (semantically matched, ${relevantEvents.length}):`)

    for (const event of relevantEvents) {
      const payloadStr = JSON.stringify(event.payload).slice(0, 100)
      lines.push(
        `- [${event.occurred_at}] ${event.type} — actor: ${event.actor_type}/${event.actor_id} — ${payloadStr}`
      )
    }
  }

  lines.push('[END CONTEXT]')

  const result = lines.join('\n')

  // Guard: truncate if over token budget (~8000 tokens at 4 chars/token)
  if (result.length > MAX_CONTEXT_CHARS) {
    return result.slice(0, MAX_CONTEXT_CHARS) + '\n... (context truncated)\n[END CONTEXT]'
  }

  return result
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
