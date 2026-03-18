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

/** Keys that may contain PII — stripped from payloads before embedding. */
const PII_KEYS = new Set([
  'email', 'phone', 'mobile', 'address', 'ssn', 'tax_id',
  'date_of_birth', 'dob', 'first_name', 'last_name', 'full_name',
  'password', 'secret', 'token', 'credit_card', 'bank_account',
])

/** Removes keys that may contain PII from an event payload. */
export function sanitizePayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') return {}
  const clean: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (PII_KEYS.has(key.toLowerCase())) continue
    clean[key] = value
  }
  return clean
}

/**
 * Builds the plain-text content string that gets embedded for events.
 * Format: "[event_type] on [block.type] '[block.name]' [YYYY-MM-DD]: [payload summary]"
 * PII keys are stripped from the payload before embedding.
 */
export function buildEmbeddingContent(
  event: Pick<Event, 'type' | 'payload' | 'occurred_at'>,
  block: { type: string; name: string }
): string {
  const sanitized = sanitizePayload(event.payload)
  const payloadStr = JSON.stringify(sanitized).slice(0, 200)
  const date = event.occurred_at ? event.occurred_at.split('T')[0] : ''
  const dateSuffix = date ? ` [${date}]` : ''
  return `${event.type} on ${block.type} '${block.name}'${dateSuffix}: ${payloadStr}`
}

/**
 * Builds the plain-text content string for block embeddings.
 * Format: "[block_type] '[block_name]': [sanitized metadata summary]"
 */
export function buildBlockEmbeddingContent(
  block: { type: string; name: string; metadata?: Record<string, unknown> }
): string {
  const sanitized = sanitizePayload(block.metadata ?? {})
  const metaStr = JSON.stringify(sanitized).slice(0, 300)
  return `${block.type} '${block.name}': ${metaStr}`
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

/**
 * Generates and stores a vector embedding for a block.
 *
 * Fire-and-forget pattern — same as embedEvent. Call after block creation/update.
 * Uses source_type='block' in the embeddings table.
 */
export async function embedBlock(
  block: { id: string; org_id: string; type: string; name: string; metadata?: Record<string, unknown> },
  supabase: SupabaseClient
): Promise<void> {
  const content = buildBlockEmbeddingContent(block)

  let embedding: number[]
  try {
    const response = await getOpenAI().embeddings.create({
      model: EMBEDDING_MODEL,
      input: content,
    })
    embedding = response.data[0].embedding
  } catch (err) {
    logger.error('embeddings', 'embed_block.openai_failed', {
      block_id: block.id,
      error: (err as Error).message?.slice(0, 100),
    })
    return
  }

  // Upsert: delete existing embedding for this block then insert new one
  // This handles block updates replacing the previous embedding
  await supabase
    .from('embeddings')
    .delete()
    .eq('source_type', 'block')
    .eq('source_id', block.id)

  const { error: insertErr } = await supabase.from('embeddings').insert({
    org_id: block.org_id,
    source_type: 'block',
    source_id: block.id,
    content,
    embedding,
  })

  if (insertErr) {
    logger.error('embeddings', 'embed_block.store_failed', {
      block_id: block.id,
      error_code: insertErr.code,
    })
    return
  }

  logger.info('embeddings', 'embed_block.stored', {
    block_id: block.id,
    content_length: content.length,
  })
}
