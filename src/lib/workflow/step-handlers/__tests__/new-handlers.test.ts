import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WorkflowStep } from '../../template-schema'
import type { InstanceMetadata } from '../types'

// ─── Mock Supabase ──────────────────────────────────────────────────────────

/** Creates a deeply chainable mock that resolves any chain of .eq().eq().order().limit() etc. */
function createMockSupabase() {
  const defaultData = { data: [{ id: 'block-a' }, { id: 'block-b' }], error: null }
  const singleData = { data: { id: 'new-id', token: 'tok-abc', name: 'Test', type: 'client', metadata: {} }, error: null }
  const searchData = { data: [{ id: 'b1', name: 'Found', type: 'client', metadata: { status: 'active' }, status: 'active', created_at: '2026-01-01' }], error: null }

  function makeChain(): Record<string, unknown> {
    const chain: Record<string, unknown> = {}
    const self = () => chain
    chain.eq = vi.fn(self)
    chain.in = vi.fn().mockResolvedValue(defaultData)
    chain.or = vi.fn(self)
    chain.ilike = vi.fn(self)
    chain.order = vi.fn(self)
    chain.limit = vi.fn().mockResolvedValue(searchData)
    chain.single = vi.fn().mockResolvedValue(singleData)
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    chain.select = vi.fn(self)
    return chain
  }

  const insertChain = makeChain()

  return {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue(insertChain),
      select: vi.fn().mockReturnValue(makeChain()),
    }),
  }
}

const META: InstanceMetadata = {
  template_id: 'tpl-1',
  source_block_id: 'block-source',
  applies_to_type: 'client',
  status: 'running',
  current_step_index: 0,
  step_results: [],
  started_at: '2026-01-01T00:00:00Z',
  completed_at: null,
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── create_edge ────────────────────────────────────────────────────────────

describe('create_edge handler', () => {
  it('creates edge between two blocks', async () => {
    const handler = (await import('../create-edge')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'link_blocks',
      type: 'create_edge',
      from_block_id: 'block-a',
      to_block_id: 'block-b',
      edge_type: 'related',
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as unknown as never)

    expect(result.status).toBe('completed')
    expect(result.output?.edge_id).toBe('new-id')
  })

  it('fails when to_block_id is missing', async () => {
    const handler = (await import('../create-edge')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'link_blocks',
      type: 'create_edge',
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as unknown as never)
    expect(result.status).toBe('failed')
    expect(result.error).toContain('to_block_id')
  })

  it('prevents self-edges', async () => {
    const handler = (await import('../create-edge')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'link_blocks',
      type: 'create_edge',
      from_block_id: 'block-a',
      to_block_id: 'block-a',
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as unknown as never)
    expect(result.status).toBe('failed')
    expect(result.error).toContain('self-edge')
  })
})

// ─── search_blocks ──────────────────────────────────────────────────────────

describe('search_blocks handler', () => {
  it('returns search results', async () => {
    const handler = (await import('../search-blocks')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'find_clients',
      type: 'search_blocks',
      search_type: 'client',
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as unknown as never)

    expect(result.status).toBe('completed')
    expect(result.output?.count).toBeGreaterThan(0)
    expect(result.output?.results).toBeInstanceOf(Array)
  })

  it('completes with empty results on no match', async () => {
    const handler = (await import('../search-blocks')).default
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }),
      }),
    }

    const step = {
      name: 'find_nothing',
      type: 'search_blocks',
      search_type: 'nonexistent',
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', mockSupabase as unknown as never)
    expect(result.status).toBe('completed')
    expect(result.output?.count).toBe(0)
  })
})

// ─── send_notification ──────────────────────────────────────────────────────

describe('send_notification handler', () => {
  it('creates notification in database', async () => {
    const handler = (await import('../send-notification')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'notify_team',
      type: 'send_notification',
      notification_title: 'Deal approved',
      notification_body: 'The deal has been approved by the manager.',
      notification_type: 'success',
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as unknown as never)

    expect(result.status).toBe('completed')
    expect(result.output?.notification_id).toBe('new-id')
    expect(result.output?.type).toBe('success')
  })

  it('uses step name as default title', async () => {
    const handler = (await import('../send-notification')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'notify_default',
      type: 'send_notification',
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as unknown as never)
    expect(result.status).toBe('completed')
    expect(result.output?.title).toBe('notify_default')
  })
})

// ─── create_shared_link ─────────────────────────────────────────────────────

describe('create_shared_link handler', () => {
  it('creates shared link with token', async () => {
    const handler = (await import('../create-shared-link')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'share_portal',
      type: 'create_shared_link',
      link_type: 'form',
      link_expires_hours: 48,
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as unknown as never)

    expect(result.status).toBe('completed')
    expect(result.output?.link_id).toBe('new-id')
    expect(result.output?.token).toBe('tok-abc')
    expect(result.output?.type).toBe('form')
  })

  it('defaults to source block and view type', async () => {
    const handler = (await import('../create-shared-link')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'share_default',
      type: 'create_shared_link',
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as unknown as never)
    expect(result.status).toBe('completed')
    expect(result.output?.block_id).toBe('block-source') // defaults to source
    expect(result.output?.type).toBe('view') // defaults to view
  })
})
