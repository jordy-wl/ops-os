import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mocks ──────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  mockResult: { data: null as unknown, error: null as unknown },
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              ilike: () => ({
                limit: () => Promise.resolve(mocks.mockResult),
              }),
            }),
          }),
        }),
      }),
    }),
  }),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

import { checkForDuplicates } from '../research-tools'
import { logger } from '@/lib/logger'

// ─── Fixtures ────────────────────────────────────────────────────────────────
const TEST_ORG_ID = 'org-test-001'
const TEST_TYPE = 'client'

function makeBlock(id: string, name: string, type: string = TEST_TYPE) {
  return { id, name, type }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('checkForDuplicates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.mockResult = { data: null, error: null }
  })

  it('returns no duplicates when no blocks match', async () => {
    mocks.mockResult = { data: [], error: null }

    const result = await checkForDuplicates('Acme Corp', TEST_TYPE, TEST_ORG_ID)

    expect(result.hasDuplicates).toBe(false)
    expect(result.matches).toEqual([])
  })

  it('returns duplicates when exact name match found (similarity = 1.0)', async () => {
    mocks.mockResult = {
      data: [makeBlock('b-1', 'Thornfield Capital')],
      error: null,
    }

    const result = await checkForDuplicates('Thornfield Capital', TEST_TYPE, TEST_ORG_ID)

    expect(result.hasDuplicates).toBe(true)
    expect(result.matches).toHaveLength(1)
    expect(result.matches[0].similarity).toBe(1.0)
  })

  it('returns duplicates when similar name found (similarity >= 0.85)', async () => {
    // "Thornfield Capital" vs "Thornfield Capitals" -- high bigram overlap
    mocks.mockResult = {
      data: [makeBlock('b-2', 'Thornfield Capitals')],
      error: null,
    }

    const result = await checkForDuplicates('Thornfield Capital', TEST_TYPE, TEST_ORG_ID)

    expect(result.hasDuplicates).toBe(true)
    expect(result.matches).toHaveLength(1)
    expect(result.matches[0].similarity).toBeGreaterThanOrEqual(0.85)
  })

  it('filters out low similarity matches (below 0.85 threshold)', async () => {
    // "Thornfield Capital" vs "Acme Holdings" -- very different strings
    mocks.mockResult = {
      data: [makeBlock('b-3', 'Acme Holdings')],
      error: null,
    }

    const result = await checkForDuplicates('Thornfield Capital', TEST_TYPE, TEST_ORG_ID)

    expect(result.hasDuplicates).toBe(false)
    expect(result.matches).toEqual([])
  })

  it('returns no duplicates on DB error (graceful degradation)', async () => {
    mocks.mockResult = {
      data: null,
      error: { code: 'PGRST301', message: 'connection failed' },
    }

    const result = await checkForDuplicates('Acme Corp', TEST_TYPE, TEST_ORG_ID)

    expect(result.hasDuplicates).toBe(false)
    expect(result.matches).toEqual([])
    expect(logger.error).toHaveBeenCalledWith(
      'research-tools',
      'duplicate_check.query_failed',
      expect.objectContaining({ error_code: 'PGRST301' })
    )
  })

  it('returns no duplicates when data is null', async () => {
    mocks.mockResult = { data: null, error: null }

    const result = await checkForDuplicates('Acme Corp', TEST_TYPE, TEST_ORG_ID)

    expect(result.hasDuplicates).toBe(false)
    expect(result.matches).toEqual([])
  })

  it('maps results correctly (source_id, content format, similarity)', async () => {
    mocks.mockResult = {
      data: [makeBlock('block-abc-123', 'Thornfield Capital', 'client')],
      error: null,
    }

    const result = await checkForDuplicates('Thornfield Capital', TEST_TYPE, TEST_ORG_ID)

    expect(result.matches).toHaveLength(1)

    const match = result.matches[0]
    expect(match.source_id).toBe('block-abc-123')
    expect(match.content).toBe('client: Thornfield Capital')
    expect(match.similarity).toBe(1.0)
  })
})

describe('calculateNameSimilarity (tested indirectly via checkForDuplicates)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.mockResult = { data: null, error: null }
  })

  it('identical strings have similarity 1.0', async () => {
    mocks.mockResult = {
      data: [makeBlock('b-10', 'Exact Match Name')],
      error: null,
    }

    const result = await checkForDuplicates('Exact Match Name', TEST_TYPE, TEST_ORG_ID)

    expect(result.hasDuplicates).toBe(true)
    expect(result.matches).toHaveLength(1)
    expect(result.matches[0].similarity).toBe(1.0)
  })

  it('completely different strings have low similarity', async () => {
    mocks.mockResult = {
      data: [makeBlock('b-11', 'ZZZZZ QQQQQ')],
      error: null,
    }

    const result = await checkForDuplicates('Aardvark Banana', TEST_TYPE, TEST_ORG_ID)

    expect(result.hasDuplicates).toBe(false)
    // Match was filtered out because similarity < 0.85
    expect(result.matches).toEqual([])
  })

  it('short strings (length < 2) return similarity 0', async () => {
    // Use two different single-character names so the exact-match shortcut
    // (a === b => 1.0) does not trigger; the length < 2 guard returns 0.
    mocks.mockResult = {
      data: [makeBlock('b-12', 'Z')],
      error: null,
    }

    const result = await checkForDuplicates('A', TEST_TYPE, TEST_ORG_ID)

    // Similarity of 0 means it won't pass the 0.85 threshold
    expect(result.hasDuplicates).toBe(false)
    expect(result.matches).toEqual([])
  })
})
