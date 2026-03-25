import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: (...args: unknown[]) => mockCreate(...args) },
  })),
}))

vi.mock('@/lib/documents/renderer', () => ({
  renderDocument: vi.fn().mockReturnValue({
    html: '<h1>Generated</h1>',
    missingVariables: [],
  }),
}))

vi.mock('@/lib/documents/pdf', () => ({
  generatePdf: vi.fn().mockReturnValue(Buffer.from('pdf')),
}))

vi.mock('@/lib/documents/storage', () => ({
  storeDocument: vi.fn().mockResolvedValue({ id: 'doc-001' }),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { documentGenerateHandler } from '../document-generate'
import type { AuthContext } from '@/lib/auth/withAuth'
import type { Permission } from '@/lib/rbac/types'

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockCtx: AuthContext = {
  userId: 'user-1',
  clerkOrgId: 'clerk-org-1',
  orgId: 'org-1',
  role: 'ops-admin',
  roleId: 'role-1',
  permissions: new Set<Permission>([
    'manage_blocks',
    'edit_blocks',
    'view_blocks',
  ]),
}

function buildMockSupabase(overrides: Record<string, unknown> = {}) {
  const sourceBlock = {
    id: 'block-1',
    name: 'Acme Corp',
    type: 'client',
    state: 'active',
    metadata: { industry: 'finance', contact_email: 'info@acme.com' },
    created_at: '2026-01-01',
    updated_at: '2026-03-01',
  }

  const brandKitBlock = {
    id: 'bk-1',
    name: 'Acme Brand',
    metadata: { company_name: 'Acme', tagline: 'We deliver' },
  }

  const edges = [
    { from_block_id: 'block-1', to_block_id: 'block-2' },
    { from_block_id: 'block-3', to_block_id: 'block-1' },
  ]

  const neighbours = [
    { name: 'Deal Alpha', type: 'deal', state: 'open', metadata: { value: 50000 } },
    { name: 'Project Beta', type: 'project', state: 'in_progress', metadata: { deadline: '2026-06-01' } },
  ]

  const events = [
    { type: 'block.updated', occurred_at: '2026-03-10T10:00:00Z', payload: { field: 'state' } },
    { type: 'document.generated', occurred_at: '2026-03-09T09:00:00Z', payload: { via: 'action' } },
  ]

  const eventInsert = { id: 'evt-1' }

  // Build a chainable mock
  const chain = (data: unknown, error: unknown = null) => {
    const obj: Record<string, unknown> = {}
    const methods = ['select', 'insert', 'update', 'eq', 'in', 'or', 'order', 'limit', 'single'] as const
    for (const m of methods) {
      obj[m] = vi.fn().mockReturnValue(obj)
    }
    // Terminal: single() resolves to { data, error }
    obj.single = vi.fn().mockResolvedValue({ data, error })
    // select() without single returns { data, error }
    const selectFn = vi.fn().mockReturnValue({ ...obj, then: undefined })
    obj.select = selectFn
    // For non-.single() chains, resolve as { data, error }
    obj.then = undefined
    // Make it thenable for Promise.all patterns
    return obj
  }

  // Track calls for assertions
  const fromCalls: string[] = []

  const supabase = {
    from: vi.fn().mockImplementation((table: string) => {
      fromCalls.push(table)

      if (table === 'blocks') {
        // Return different data based on call order
        const blocksCalled = fromCalls.filter((t) => t === 'blocks').length
        if (blocksCalled === 1) {
          // Source block
          return chain(sourceBlock)
        } else if (blocksCalled === 2) {
          // Brand kit
          return chain(brandKitBlock)
        } else {
          // Neighbours
          const c = chain(null)
          c.select = vi.fn().mockReturnValue({
            ...c,
            in: vi.fn().mockReturnValue({
              ...c,
              eq: vi.fn().mockResolvedValue({ data: neighbours, error: null }),
            }),
          })
          return c
        }
      }

      if (table === 'block_edges') {
        const c = chain(null)
        // Promise.all needs thenable
        c.select = vi.fn().mockReturnValue({
          ...c,
          eq: vi.fn().mockReturnValue({
            ...c,
            or: vi.fn().mockReturnValue({
              ...c,
              limit: vi.fn().mockResolvedValue({ data: edges, error: null }),
            }),
          }),
        })
        return c
      }

      if (table === 'events') {
        const callCount = fromCalls.filter((t) => t === 'events').length
        if (callCount === 1) {
          // Context assembly: recent events query
          const c = chain(null)
          c.select = vi.fn().mockReturnValue({
            ...c,
            eq: vi.fn().mockReturnValue({
              ...c,
              eq: vi.fn().mockReturnValue({
                ...c,
                order: vi.fn().mockReturnValue({
                  ...c,
                  limit: vi.fn().mockResolvedValue({ data: events, error: null }),
                }),
              }),
            }),
          })
          return c
        } else {
          // Event insert for recording
          return chain(eventInsert)
        }
      }

      return chain(null)
    }),
    ...overrides,
  }

  return supabase
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('documentGenerateHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('schema validation', () => {
    it('accepts valid AI generation payload', () => {
      const result = documentGenerateHandler.schema.safeParse({
        source_block_id: '123e4567-e89b-12d3-a456-426614174000',
        prompt: 'Generate a client report',
      })
      expect(result.success).toBe(true)
    })

    it('accepts valid template payload', () => {
      const result = documentGenerateHandler.schema.safeParse({
        source_block_id: '123e4567-e89b-12d3-a456-426614174000',
        template_id: '223e4567-e89b-12d3-a456-426614174000',
        output_format: 'pdf',
        generate_pdf: true,
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing source_block_id', () => {
      const result = documentGenerateHandler.schema.safeParse({
        prompt: 'Generate a report',
      })
      expect(result.success).toBe(false)
    })

    it('rejects prompt over 4000 chars', () => {
      const result = documentGenerateHandler.schema.safeParse({
        source_block_id: '123e4567-e89b-12d3-a456-426614174000',
        prompt: 'x'.repeat(4001),
      })
      expect(result.success).toBe(false)
    })

    it('defaults output_format to html', () => {
      const result = documentGenerateHandler.schema.parse({
        source_block_id: '123e4567-e89b-12d3-a456-426614174000',
        prompt: 'Generate a report',
      })
      expect(result.output_format).toBe('html')
      expect(result.generate_pdf).toBe(false)
    })
  })

  describe('AI-based generation with context', () => {
    it('calls Claude with connected blocks and events in context', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: '# Client Report\n\nAcme Corp overview.' }],
        usage: { output_tokens: 150 },
      })

      const supabase = buildMockSupabase()
      const payload = documentGenerateHandler.schema.parse({
        source_block_id: '123e4567-e89b-12d3-a456-426614174000',
        prompt: 'Generate a quarterly client report',
      })

      const result = await documentGenerateHandler.execute(
        payload,
        mockCtx,
        supabase as never
      )

      expect(result.status).toBe('completed')
      expect(result.actionId).toBeDefined()

      // Verify Claude was called
      expect(mockCreate).toHaveBeenCalledOnce()
      const callArgs = mockCreate.mock.calls[0][0]

      // System prompt should contain context sections
      expect(callArgs.system).toContain('Source Block Context')
      expect(callArgs.system).toContain('Acme Corp')
      expect(callArgs.system).toContain('client')

      // User message is the prompt
      expect(callArgs.messages[0].content).toBe(
        'Generate a quarterly client report'
      )
    })
  })

  describe('error handling', () => {
    it('throws when neither template_id nor prompt provided', async () => {
      const supabase = buildMockSupabase()
      const payload = {
        source_block_id: '123e4567-e89b-12d3-a456-426614174000',
        output_format: 'html' as const,
        generate_pdf: false,
      }

      await expect(
        documentGenerateHandler.execute(payload, mockCtx, supabase as never)
      ).rejects.toThrow('Either template_id or prompt must be provided')
    })
  })
})
