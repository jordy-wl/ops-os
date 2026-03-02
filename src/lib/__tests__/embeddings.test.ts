import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildEmbeddingContent, embedEvent } from '@/lib/embeddings'
import type { Event } from '@/lib/context-assembly'

// ─── Mock OpenAI ─────────────────────────────────────────────────────────────
const mockCreateEmbedding = vi.fn()

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    embeddings: {
      create: mockCreateEmbedding,
    },
  })),
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const FAKE_EMBEDDING = Array(1536).fill(0.1)

const MOCK_EVENT: Event = {
  id: 'evt-001',
  org_id: 'org-001',
  block_id: 'blk-001',
  type: 'compliance.review.required',
  actor_id: 'user-001',
  actor_type: 'system',
  payload: { reason: 'PEP check required for senior management' },
  occurred_at: '2026-03-01T10:00:00Z',
}

const MOCK_BLOCK = { type: 'client', name: 'Thornfield Capital Partners' }

// ─── Supabase mock ────────────────────────────────────────────────────────────

// For insert chain: from().insert() resolves directly
function makeFullSupabaseMock(blockData: unknown, insertError: unknown = null) {
  const blockChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: blockData, error: null }),
  }
  // insert() needs to be awaitable
  const insertFn = vi.fn().mockResolvedValue({ error: insertError })

  const fromFn = vi.fn().mockImplementation((table: string) => {
    if (table === 'blocks') return blockChain
    if (table === 'embeddings') return { insert: insertFn }
    return {}
  })

  return { from: fromFn, _insertFn: insertFn }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildEmbeddingContent', () => {
  it('formats content string correctly', () => {
    const result = buildEmbeddingContent(MOCK_EVENT, MOCK_BLOCK)
    expect(result).toBe(
      `compliance.review.required on client 'Thornfield Capital Partners': ${JSON.stringify(MOCK_EVENT.payload)}`
    )
  })

  it('truncates payload to 200 chars', () => {
    const longPayload = { data: 'x'.repeat(300) }
    const event = { ...MOCK_EVENT, payload: longPayload }
    const result = buildEmbeddingContent(event, MOCK_BLOCK)
    const payloadPart = result.split(': ')[1]
    expect(payloadPart.length).toBeLessThanOrEqual(200)
  })
})

describe('embedEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.OPENAI_API_KEY = 'sk-test-key'
    mockCreateEmbedding.mockResolvedValue({
      data: [{ embedding: FAKE_EMBEDDING }],
    })
  })

  it('happy path: fetches block, generates embedding, stores in DB', async () => {
    const { from, _insertFn } = makeFullSupabaseMock(MOCK_BLOCK)
    const supabase = { from } as unknown as ReturnType<typeof import('@/lib/supabase/server').createServerClient>

    await embedEvent(MOCK_EVENT, supabase)

    expect(mockCreateEmbedding).toHaveBeenCalledWith({
      model: 'text-embedding-3-small',
      input: expect.stringContaining('compliance.review.required'),
    })

    expect(_insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: MOCK_EVENT.org_id,
        source_type: 'event',
        source_id: MOCK_EVENT.id,
        content: expect.stringContaining('Thornfield Capital Partners'),
        embedding: FAKE_EMBEDDING,
      })
    )
  })

  it('does NOT throw when block fetch fails', async () => {
    const blockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
    }
    const supabase = {
      from: vi.fn().mockReturnValue(blockChain),
    } as unknown as ReturnType<typeof import('@/lib/supabase/server').createServerClient>

    await expect(embedEvent(MOCK_EVENT, supabase)).resolves.toBeUndefined()
    expect(mockCreateEmbedding).not.toHaveBeenCalled()
  })

  it('does NOT throw when OpenAI call fails', async () => {
    mockCreateEmbedding.mockRejectedValue(new Error('OpenAI rate limit'))

    const blockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: MOCK_BLOCK, error: null }),
    }
    const insertFn = vi.fn()
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'blocks') return blockChain
        return { insert: insertFn }
      }),
    } as unknown as ReturnType<typeof import('@/lib/supabase/server').createServerClient>

    await expect(embedEvent(MOCK_EVENT, supabase)).resolves.toBeUndefined()
    expect(insertFn).not.toHaveBeenCalled()
  })

  it('does NOT throw when DB insert fails', async () => {
    const blockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: MOCK_BLOCK, error: null }),
    }
    const insertFn = vi.fn().mockResolvedValue({ error: { code: 'XX000', message: 'DB error' } })
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'blocks') return blockChain
        return { insert: insertFn }
      }),
    } as unknown as ReturnType<typeof import('@/lib/supabase/server').createServerClient>

    await expect(embedEvent(MOCK_EVENT, supabase)).resolves.toBeUndefined()
  })
})
