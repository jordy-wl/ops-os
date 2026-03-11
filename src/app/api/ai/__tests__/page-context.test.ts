import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { AuthContext } from '@/lib/auth/withAuth'

vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: vi.fn(
    (handler: (req: NextRequest, ctx: AuthContext, params: Record<string, string>) => Promise<Response>) =>
      async (req: NextRequest, context: { params: Promise<Record<string, string>> }) => {
        const params = await context.params
        return handler(
          req,
          { userId: 'user_111', clerkOrgId: 'org_abc', orgId: 'uuid-org-1', role: 'ops-admin' },
          params
        )
      }
  ),
}))

vi.mock('@/lib/supabase/server', () => {
  const mockChain = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'block-1',
                name: 'Acme Corp',
                type: 'client',
                state: 'active',
                metadata: { status: 'active' },
              },
              error: null,
            }),
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [
                  { type: 'block.created', occurred_at: '2026-03-11', actor_type: 'user', payload: {} },
                ],
                error: null,
              }),
            }),
          }),
          or: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [
                { type: 'block.created', occurred_at: '2026-03-11', actor_type: 'user', payload: {} },
              ],
              error: null,
            }),
          }),
        }),
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }),
  }
  return { createServerClient: vi.fn().mockReturnValue(mockChain) }
})

const { GET } = await import('@/app/api/ai/page-context/route')

function makeReq(params: Record<string, string>) {
  const url = new URL('http://localhost/api/ai/page-context')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return new NextRequest(url)
}

describe('GET /api/ai/page-context', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns dashboard page type for /dashboard', async () => {
    const res = await GET(makeReq({ path: '/dashboard' }), { params: Promise.resolve({}) })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data.pageType).toBe('dashboard')
  })

  it('returns block_detail page type for /blocks/:id', async () => {
    const res = await GET(
      makeReq({
        path: '/blocks/00000000-0000-0000-0000-000000000001',
        blockId: '00000000-0000-0000-0000-000000000001',
      }),
      { params: Promise.resolve({}) }
    )
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data.pageType).toBe('block_detail')
    expect(body.data.block).toBeDefined()
    expect(body.data.block.name).toBe('Acme Corp')
  })

  it('returns workflow_builder page type for /workflows/:id/builder', async () => {
    const res = await GET(
      makeReq({
        path: '/workflows/00000000-0000-0000-0000-000000000001/builder',
        blockId: '00000000-0000-0000-0000-000000000001',
      }),
      { params: Promise.resolve({}) }
    )
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data.pageType).toBe('workflow_builder')
  })

  it('returns workflows page type for /workflows', async () => {
    const res = await GET(makeReq({ path: '/workflows' }), { params: Promise.resolve({}) })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data.pageType).toBe('workflows')
  })

  it('returns library page type for /library/blocks', async () => {
    const res = await GET(makeReq({ path: '/library/blocks' }), { params: Promise.resolve({}) })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data.pageType).toBe('library')
  })

  it('returns 400 when path is missing', async () => {
    const res = await GET(makeReq({}), { params: Promise.resolve({}) })
    expect(res.status).toBe(400)
  })

  it('returns recent events for block detail pages', async () => {
    const res = await GET(
      makeReq({
        path: '/blocks/00000000-0000-0000-0000-000000000001',
        blockId: '00000000-0000-0000-0000-000000000001',
      }),
      { params: Promise.resolve({}) }
    )
    const body = await res.json()
    expect(body.data.recentEvents).toBeDefined()
    expect(body.data.recentEvents.length).toBeGreaterThanOrEqual(0)
  })
})
