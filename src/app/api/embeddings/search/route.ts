import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { withAuth } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

const EMBEDDING_MODEL = 'text-embedding-3-small'

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10', 10), 50)

  if (!q) {
    return apiError('Query parameter "q" is required', 'validation/missing-param', 400)
  }
  if (!process.env.OPENAI_API_KEY) {
    logger.error('api-embeddings-search', 'config.missing_key', {})
    return apiError('Embedding search is not configured', 'embeddings/not-configured', 503)
  }

  // Generate embedding for the search query
  let queryEmbedding: number[]
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const response = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: q })
    queryEmbedding = response.data[0].embedding
  } catch (err) {
    logger.error('api-embeddings-search', 'embed.openai_failed', {
      error: (err as Error).message?.slice(0, 100),
    })
    return apiError('Failed to generate query embedding', 'embeddings/openai-failed', 503)
  }

  // Cosine similarity search via Postgres function
  const supabase = createServerClient()
  const { data, error } = await supabase.rpc('match_embeddings', {
    query_embedding: queryEmbedding,
    match_count: limit,
    filter_org_id: ctx.orgId,
  })

  if (error) {
    logger.error('api-embeddings-search', 'db.rpc_failed', { error_code: error.code })
    return apiError('Similarity search failed', 'db/rpc-failed', 500)
  }

  return ok({ results: data ?? [], query: q, limit })
})
