import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveMentionContext, MentionInputSchema } from '@/lib/ai/mention-context'
import type { MentionInput } from '@/lib/ai/mention-context'

// ─── Supabase mock ──────────────────────────────────────────────────────────

function createMockSupabase(overrides: Record<string, unknown> = {}) {
  const defaultChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  }

  return {
    from: vi.fn().mockReturnValue({ ...defaultChain, ...overrides }),
    ...overrides,
  } as unknown as Parameters<typeof resolveMentionContext>[0]
}

// ─── Schema Validation ──────────────────────────────────────────────────────

describe('MentionInputSchema', () => {
  it('accepts valid block mentions', () => {
    const result = MentionInputSchema.safeParse([
      { kind: 'block', blockId: '00000000-0000-0000-0000-000000000001', blockName: 'Acme', blockType: 'client' },
    ])
    expect(result.success).toBe(true)
  })

  it('accepts valid type_query mentions', () => {
    const result = MentionInputSchema.safeParse([
      { kind: 'type_query', type: 'client', displayName: 'Client' },
    ])
    expect(result.success).toBe(true)
  })

  it('accepts valid field_query mentions', () => {
    const result = MentionInputSchema.safeParse([
      { kind: 'field_query', type: 'client', field: 'jurisdiction', displayName: 'Client/Jurisdiction' },
    ])
    expect(result.success).toBe(true)
  })

  it('accepts valid value_query mentions', () => {
    const result = MentionInputSchema.safeParse([
      { kind: 'value_query', type: 'client', field: 'jurisdiction', value: 'AU', displayName: 'Client/Jurisdiction/AU' },
    ])
    expect(result.success).toBe(true)
  })

  it('rejects invalid kind', () => {
    const result = MentionInputSchema.safeParse([
      { kind: 'unknown_kind', type: 'client' },
    ])
    expect(result.success).toBe(false)
  })

  it('rejects more than 10 mentions', () => {
    const mentions = Array(11).fill({ kind: 'type_query', type: 'client' })
    const result = MentionInputSchema.safeParse(mentions)
    expect(result.success).toBe(false)
  })

  it('rejects invalid blockId format', () => {
    const result = MentionInputSchema.safeParse([
      { kind: 'block', blockId: 'not-a-uuid' },
    ])
    expect(result.success).toBe(false)
  })

  it('accepts empty array', () => {
    const result = MentionInputSchema.safeParse([])
    expect(result.success).toBe(true)
  })
})

// ─── resolveMentionContext ───────────────────────────────────────────────────

describe('resolveMentionContext', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null for empty mentions array', async () => {
    const supabase = createMockSupabase()
    const result = await resolveMentionContext(supabase, 'org-1', [])
    expect(result).toBeNull()
  })

  it('returns null for null/undefined mentions', async () => {
    const supabase = createMockSupabase()
    const result = await resolveMentionContext(supabase, 'org-1', null as unknown as MentionInput[])
    expect(result).toBeNull()
  })

  describe('block resolution', () => {
    it('resolves a block mention with metadata', async () => {
      const mockBlock = {
        id: 'block-1',
        name: 'Acme Corp',
        type: 'client',
        state: 'active',
        metadata: { jurisdiction: 'AU', industry: 'Finance' },
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
        owner_id: null,
      }

      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockBlock, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }

      const supabase = { from: vi.fn().mockReturnValue(chain) } as unknown as Parameters<typeof resolveMentionContext>[0]

      const result = await resolveMentionContext(supabase, 'org-1', [
        { kind: 'block', blockId: 'block-1', blockName: 'Acme Corp', blockType: 'client' },
      ])

      expect(result).not.toBeNull()
      expect(result).toContain('[Block: "Acme Corp" (client)]')
      expect(result).toContain('State: active')
      expect(result).toContain('jurisdiction: AU')
      expect(result).toContain('industry: Finance')
    })

    it('returns null for non-existent block', async () => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }

      const supabase = { from: vi.fn().mockReturnValue(chain) } as unknown as Parameters<typeof resolveMentionContext>[0]

      const result = await resolveMentionContext(supabase, 'org-1', [
        { kind: 'block', blockId: '00000000-0000-0000-0000-000000000099' },
      ])

      expect(result).toBeNull()
    })

    it('skips block mention when blockId is missing', async () => {
      const supabase = createMockSupabase()
      const result = await resolveMentionContext(supabase, 'org-1', [
        { kind: 'block' },
      ])
      expect(result).toBeNull()
    })
  })

  describe('type_query resolution', () => {
    it('resolves a type query with count and recent names', async () => {
      // We need to handle multiple from() calls returning different chains
      let callCount = 0
      const supabase = {
        from: vi.fn().mockImplementation(() => {
          callCount++
          // First call: count query (head: true)
          if (callCount === 1) {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              or: vi.fn().mockReturnThis(),
              not: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: null, error: null, count: 5 }),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }
          }
          // Second call: recent names
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            not: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [{ name: 'Acme' }, { name: 'Globex' }, { name: 'Initech' }],
                error: null,
              }),
            }),
            limit: vi.fn().mockResolvedValue({
              data: [{ name: 'Acme' }, { name: 'Globex' }, { name: 'Initech' }],
              error: null,
            }),
          }
        }),
      } as unknown as Parameters<typeof resolveMentionContext>[0]

      const result = await resolveMentionContext(supabase, 'org-1', [
        { kind: 'type_query', type: 'client', displayName: 'Client' },
      ])

      expect(result).not.toBeNull()
      expect(result).toContain('[Type Query: Client]')
      expect(result).toContain('Total client blocks:')
    })

    it('skips type_query when type is missing', async () => {
      const supabase = createMockSupabase()
      const result = await resolveMentionContext(supabase, 'org-1', [
        { kind: 'type_query' },
      ])
      expect(result).toBeNull()
    })
  })

  describe('field_query resolution', () => {
    it('skips field_query when field is not in type schema', async () => {
      // Simulate block_type_definitions returning a schema without the requested field
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            field_schema: {
              properties: { jurisdiction: { type: 'string' } },
            },
          },
          error: null,
        }),
      }

      const supabase = { from: vi.fn().mockReturnValue(chain) } as unknown as Parameters<typeof resolveMentionContext>[0]

      const result = await resolveMentionContext(supabase, 'org-1', [
        { kind: 'field_query', type: 'client', field: 'hacker_field' },
      ])

      // hacker_field is not in schema, so should be skipped
      expect(result).toBeNull()
    })

    it('skips field_query when type or field is missing', async () => {
      const supabase = createMockSupabase()
      const result = await resolveMentionContext(supabase, 'org-1', [
        { kind: 'field_query', type: 'client' },
      ])
      expect(result).toBeNull()
    })
  })

  describe('value_query resolution', () => {
    it('skips value_query when type, field, or value is missing', async () => {
      const supabase = createMockSupabase()
      const result = await resolveMentionContext(supabase, 'org-1', [
        { kind: 'value_query', type: 'client', field: 'jurisdiction' },
      ])
      expect(result).toBeNull()
    })
  })

  describe('mixed mentions', () => {
    it('resolves multiple mention types and joins with double newline', async () => {
      const mockBlock = {
        id: 'block-1',
        name: 'Acme Corp',
        type: 'client',
        state: 'active',
        metadata: { jurisdiction: 'AU' },
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
        owner_id: null,
      }

      let callCount = 0
      const supabase = {
        from: vi.fn().mockImplementation((table: string) => {
          callCount++
          if (table === 'blocks' && callCount <= 2) {
            // Block lookup for the 'block' mention
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              or: vi.fn().mockReturnThis(),
              not: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockBlock, error: null }),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }
          }
          // Fallback for type_query count and recent
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            not: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            limit: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
            single: vi.fn().mockResolvedValue({ data: null, error: null, count: 0 }),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }
        }),
      } as unknown as Parameters<typeof resolveMentionContext>[0]

      const result = await resolveMentionContext(supabase, 'org-1', [
        { kind: 'block', blockId: 'block-1', blockName: 'Acme Corp', blockType: 'client' },
        { kind: 'type_query', type: 'deal', displayName: 'Deal' },
      ])

      expect(result).not.toBeNull()
      // At minimum the block mention should resolve
      expect(result).toContain('[Block: "Acme Corp" (client)]')
    })
  })

  describe('error handling', () => {
    it('gracefully skips mentions that throw errors', async () => {
      const supabase = {
        from: vi.fn().mockImplementation(() => {
          throw new Error('Database connection lost')
        }),
      } as unknown as Parameters<typeof resolveMentionContext>[0]

      const result = await resolveMentionContext(supabase, 'org-1', [
        { kind: 'block', blockId: '00000000-0000-0000-0000-000000000001' },
      ])

      // Should not throw, should return null since no mentions resolved
      expect(result).toBeNull()
    })
  })
})
