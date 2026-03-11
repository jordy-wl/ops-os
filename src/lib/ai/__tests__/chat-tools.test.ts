import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { CHAT_TOOLS, executeChatTool } from '../chat-tools'
import { createServerClient } from '@/lib/supabase/server'

type MockDb = ReturnType<typeof createServerClient>

function makeSupabase(responses: Record<string, { data: unknown; error: unknown }>): MockDb {
  const chain = {
    from: vi.fn().mockImplementation((table: string) => {
      const resp = responses[table] ?? { data: null, error: null }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(resp),
              or: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(resp),
              }),
            }),
            ilike: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue(resp),
                }),
              }),
            }),
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue(resp),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(resp),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue(resp),
          }),
        }),
      }
    }),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  }
  return chain as unknown as MockDb
}

describe('CHAT_TOOLS', () => {
  it('defines 4 tools', () => {
    expect(CHAT_TOOLS).toHaveLength(4)
  })

  it('each tool has name, description, and input_schema', () => {
    for (const tool of CHAT_TOOLS) {
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(tool.input_schema).toBeDefined()
      expect(tool.input_schema.type).toBe('object')
    }
  })

  it('defines expected tool names', () => {
    const names = CHAT_TOOLS.map((t) => t.name)
    expect(names).toContain('search_blocks')
    expect(names).toContain('create_block')
    expect(names).toContain('update_block')
    expect(names).toContain('trigger_workflow')
  })
})

describe('executeChatTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows search_blocks for any role', async () => {
    const db = makeSupabase({
      blocks: { data: [{ id: 'b1', name: 'Acme', type: 'client' }], error: null },
    })
    vi.mocked(createServerClient).mockReturnValue(db)

    const result = await executeChatTool('search_blocks', { query: 'Acme' }, 'org-1', 'ops-user')
    expect(result.success).toBe(true)
  })

  it('rejects create_block for non-admin', async () => {
    const result = await executeChatTool(
      'create_block',
      { name: 'Test', type: 'client' },
      'org-1',
      'ops-user'
    )
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/permission denied/i)
  })

  it('rejects update_block for non-admin', async () => {
    const result = await executeChatTool(
      'update_block',
      { block_id: 'b1', fields: { status: 'active' } },
      'org-1',
      'compliance-approver'
    )
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/permission denied/i)
  })

  it('rejects trigger_workflow for non-admin', async () => {
    const result = await executeChatTool(
      'trigger_workflow',
      { template_id: 't1', block_id: 'b1' },
      'org-1',
      'ops-user'
    )
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/permission denied/i)
  })

  it('allows create_block for ops-admin', async () => {
    const db = makeSupabase({
      blocks: { data: { id: 'new-1', name: 'Test', type: 'client' }, error: null },
      events: { data: null, error: null },
    })
    vi.mocked(createServerClient).mockReturnValue(db)

    const result = await executeChatTool(
      'create_block',
      { name: 'Test Corp', type: 'client' },
      'org-1',
      'ops-admin'
    )
    expect(result.success).toBe(true)
  })

  it('returns error for unknown tool', async () => {
    const result = await executeChatTool('unknown_tool', {}, 'org-1', 'ops-admin')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/unknown tool/i)
  })

  it('rejects update_block with empty fields', async () => {
    const db = makeSupabase({})
    vi.mocked(createServerClient).mockReturnValue(db)

    const result = await executeChatTool(
      'update_block',
      { block_id: 'b1', fields: {} },
      'org-1',
      'ops-admin'
    )
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/fields cannot be empty/i)
  })

  it('rejects create_block with missing name', async () => {
    const db = makeSupabase({})
    vi.mocked(createServerClient).mockReturnValue(db)

    const result = await executeChatTool(
      'create_block',
      { type: 'client' },
      'org-1',
      'ops-admin'
    )
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/name and type are required/i)
  })
})
