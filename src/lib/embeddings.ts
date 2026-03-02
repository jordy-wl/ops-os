/**
 * lib/embeddings.ts — pgvector Embedding Pipeline
 *
 * Generates text embeddings for events using OpenAI text-embedding-3-small
 * (1536 dims matching the embeddings table schema).
 *
 * Claude API does not provide embeddings — OpenAI is used for this purpose.
 * Env required: OPENAI_API_KEY
 *
 * Fire-and-forget: embedEvent() failures are logged but never propagate —
 * event creation must never fail because of an embedding service outage.
 */

import OpenAI from 'openai'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Event } from '@/lib/context-assembly'
import { logger } from '@/lib/logger'

const EMBEDDING_MODEL = 'text-embedding-3-small'

let _openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set — required for embedding pipeline')
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _openai
}

/**
 * Builds the plain-text content string that gets embedded.
 * Format: "[event_type] on [block.type] '[block.name]': [payload summary]"
 */
export function buildEmbeddingContent(
  event: Pick<Event, 'type' | 'payload'>,
  block: { type: string; name: string }
): string {
  const payloadStr = JSON.stringify(event.payload).slice(0, 200)
  return `${event.type} on ${block.type} '${block.name}': ${payloadStr}`
}

/**
 * Generates and stores a vector embedding for an event.
 *
 * Designed to be called fire-and-forget after event creation:
 *   embedEvent(event, supabase).catch(() => {}) // failures never block the response
 *
 * @param event - The event row returned from the DB after insert
 * @param supabase - Supabase client (service role, has RLS bypass)
 */
export async function embedEvent(
  event: Event,
  supabase: SupabaseClient
): Promise<void> {
  // Fetch the associated block for content construction
  const { data: block, error: blockErr } = await supabase
    .from('blocks')
    .select('type, name')
    .eq('id', event.block_id)
    .single()

  if (blockErr || !block) {
    logger.warn('embeddings', 'embed.block_not_found', {
      event_id: event.id,
      block_id: event.block_id,
      error_code: blockErr?.code,
    })
    return
  }

  const content = buildEmbeddingContent(event, block as { type: string; name: string })

  // Generate embedding via OpenAI
  let embedding: number[]
  try {
    const response = await getOpenAI().embeddings.create({
      model: EMBEDDING_MODEL,
      input: content,
    })
    embedding = response.data[0].embedding
  } catch (err) {
    logger.error('embeddings', 'embed.openai_failed', {
      event_id: event.id,
      error: (err as Error).message?.slice(0, 100),
    })
    return
  }

  // Store in embeddings table
  const { error: insertErr } = await supabase.from('embeddings').insert({
    org_id: event.org_id,
    source_type: 'event',
    source_id: event.id,
    content,
    embedding,
  })

  if (insertErr) {
    logger.error('embeddings', 'embed.store_failed', {
      event_id: event.id,
      error_code: insertErr.code,
    })
    return
  }

  logger.info('embeddings', 'embed.stored', {
    event_id: event.id,
    content_length: content.length,
  })
}
