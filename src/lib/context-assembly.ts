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

export type ContextObject = {
  block: Block | null
  events: Event[]          // chronologically recent events
  relevantEvents: Event[]  // semantically similar events (empty when no query provided)
  neighbours: Block[]
  org: Org | null
  userRole: string
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

// ─── Lazy OpenAI singleton ────────────────────────────────────────────────────

let _openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set — required for semantic search')
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _openai
}

// ─── Semantic Search Helpers ──────────────────────────────────────────────────

/**
 * fetchSemanticEventIds — embeds a query string and returns IDs of the most
 * semantically similar events in the org via the match_embeddings() RPC.
 *
 * Always returns an array (empty on any failure) — never throws.
 * Failures are logged at warn level so degraded search is detectable.
 */
async function fetchSemanticEventIds(
  query: string,
  orgId: string,
  supabase: ReturnType<typeof createServerClient>
): Promise<string[]> {
  if (!process.env.OPENAI_API_KEY) {
    logger.warn('context-assembly', 'semantic.openai_key_missing', { org_id: orgId })
    return []
  }

  let queryEmbedding: number[]
  try {
    const response = await getOpenAI().embeddings.create({
      model: EMBEDDING_MODEL,
      input: query,
    })
    queryEmbedding = response.data[0].embedding
  } catch (err) {
    logger.warn('context-assembly', 'semantic.embed_failed', {
      org_id: orgId,
      error: (err as Error).message?.slice(0, 100),
    })
    return []
  }

  const { data, error } = await supabase.rpc('match_embeddings', {
    query_embedding: queryEmbedding,
    match_count: MAX_SEMANTIC_EVENTS,
    filter_org_id: orgId,
  })

  if (error) {
    logger.warn('context-assembly', 'semantic.rpc_failed', {
      org_id: orgId,
      error_code: error.code,
    })
    return []
  }

  // Filter to event-type embeddings only; source_id is the events.id FK
  return (data ?? [])
    .filter((row: { source_type: string }) => row.source_type === 'event')
    .map((row: { source_id: string }) => row.source_id)
}

/**
 * fetchRelevantEvents — given a query, fetches semantically similar events
 * that are NOT already present in the provided recentEvents list.
 *
 * Always returns an array — never throws.
 */
async function fetchRelevantEvents(
  query: string,
  orgId: string,
  recentEvents: Event[],
  supabase: ReturnType<typeof createServerClient>
): Promise<Event[]> {
  const semanticIds = await fetchSemanticEventIds(query, orgId, supabase)
  if (semanticIds.length === 0) return []

  // Deduplicate: exclude events already in the recency list
  const recentSet = new Set(recentEvents.map((e) => e.id))
  const newIds = semanticIds.filter((id) => !recentSet.has(id))
  if (newIds.length === 0) return []

  const { data: semEvents } = await supabase
    .from('events')
    .select('*')
    .in('id', newIds)
    .eq('org_id', orgId)

  return (semEvents as Event[]) ?? []
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
  // userId reserved for Phase 2 role resolution
  _userId: string,
  query?: string
): Promise<ContextObject> {
  const supabase = createServerClient()

  // Fetch org
  const { data: org } = await supabase
    .from('orgs')
    .select('*')
    .eq('id', orgId)
    .single()

  const recentLimit = query ? MAX_RECENT_EVENTS : MAX_CONTEXT_EVENTS

  if (!blockId) {
    // Org-level context: recent events across all blocks in org
    const { data: events } = await supabase
      .from('events')
      .select('*')
      .eq('org_id', orgId)
      .order('occurred_at', { ascending: false })
      .limit(recentLimit)

    const recentEvents = (events as Event[]) ?? []

    let relevantEvents: Event[] = []
    if (query) {
      relevantEvents = await fetchRelevantEvents(query, orgId, recentEvents, supabase)
    }

    return {
      block: null,
      events: recentEvents,
      relevantEvents,
      neighbours: [],
      org: org ?? null,
      userRole: 'member', // Phase 2: resolve from org membership table
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

  let relevantEvents: Event[] = []
  if (query) {
    relevantEvents = await fetchRelevantEvents(query, orgId, recentEvents, supabase)
  }

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

  return {
    block: (block as Block) ?? null,
    events: recentEvents,
    relevantEvents,
    neighbours,
    org: (org as Org) ?? null,
    userRole: 'member',
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
  lines.push('')

  if (block) {
    const jurisdiction = block.metadata?.jurisdiction ?? 'unset'
    lines.push(`Block: "${block.name}" (type: ${block.type}, jurisdiction: ${jurisdiction})`)

    if (neighbours.length > 0) {
      const connected = neighbours.map((n) => `"${n.name}" (${n.type})`).join(', ')
      lines.push(`Connected to: ${connected}`)
    } else {
      lines.push('Connected to: (none)')
    }
  } else {
    lines.push('Scope: org-level (no specific block)')
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
