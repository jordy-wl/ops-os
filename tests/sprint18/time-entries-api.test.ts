/**
 * tests/sprint18/time-entries-api.test.ts
 *
 * Unit tests for GET/POST/PATCH /api/time-entries — Time Entries CRUD API.
 * Covers date filtering, auto-duration computation, update flow, and
 * validation rejection.
 *
 * All external dependencies mocked: withAuth, Supabase, logger.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { AuthContext } from '@/lib/auth/withAuth'

// ---- Mutable mock state (vi.hoisted for factory sharing) -------------------

const mockCtx = vi.hoisted(() => ({
  current: {
    userId: 'user_abc',
    clerkOrgId: 'org_clerk',
    orgId: 'org-uuid-1',
    role: 'ops-admin' as const,
    roleId: 'role-1',
    permissions: new Set(['manage_blocks'] as const),
  } as unknown as AuthContext,
}))

const mockDb = vi.hoisted(() => ({
  queryResult: null as unknown,
  queryError: null as { code: string; message: string } | null,
  insertResult: null as unknown,
  insertError: null as { code: string; message: string } | null,
  updateResult: null as unknown,
  updateError: null as { code: string; message: string } | null,
}))

// ---- Mocks -----------------------------------------------------------------

vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: vi.fn<(handler: Function) => Function>().mockImplementation((handler) =>
    async (req: NextRequest, context: { params: Promise<Record<string, string>> }) => {
      const params = await context.params
      return handler(req, mockCtx.current, params)
    }
  ),
}))

vi.mock('@/lib/supabase/server', () => {
  return {
    createServerClient: vi.fn(() => {
      // Track which operation mode the chain is in
      let mode: 'query' | 'insert' | 'update' = 'query'

      const chain: Record<string, ReturnType<typeof vi.fn>> = {}

      // All chainable methods return the chain itself
      chain.from = vi.fn(() => chain)
      chain.select = vi.fn(() => chain)
      chain.eq = vi.fn(() => chain)
      chain.gte = vi.fn(() => chain)
      chain.lte = vi.fn(() => chain)
      chain.order = vi.fn(() => chain)
      chain.limit = vi.fn(() => chain)
      chain.insert = vi.fn(() => {
        mode = 'insert'
        return chain
      })
      chain.update = vi.fn(() => {
        mode = 'update'
        return chain
      })

      // Terminal method: single() resolves with data based on mode
      chain.single = vi.fn(() => {
        if (mode === 'insert') {
          return Promise.resolve({
            data: mockDb.insertResult,
            error: mockDb.insertError,
          })
        }
        return Promise.resolve({
          data: mockDb.updateResult,
          error: mockDb.updateError,
        })
      })

      // Make the chain thenable for GET queries (await query)
      // When the chain is awaited directly, resolve with query results
      ;(chain as Record<string, unknown>).then = function (
        onFulfilled?: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) {
        const result = Promise.resolve({
          data: mockDb.queryResult,
          error: mockDb.queryError,
        })
        return result.then(onFulfilled, onRejected)
      }

      return chain
    }),
  }
})

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// ---- Import handlers after mocks -------------------------------------------

import { GET, POST, PATCH } from '@/app/api/time-entries/route'

// ---- Helpers ---------------------------------------------------------------

function makeGetRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/time-entries')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return new NextRequest(url)
}

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/time-entries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makePatchRequest(body: Record<string, unknown>, id?: string) {
  const url = new URL('http://localhost/api/time-entries')
  if (id) url.searchParams.set('id', id)
  return new NextRequest(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const context = { params: Promise.resolve({}) }

// ---- Tests -----------------------------------------------------------------

describe('GET /api/time-entries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.queryResult = []
    mockDb.queryError = null
    mockDb.insertResult = null
    mockDb.insertError = null
    mockDb.updateResult = null
    mockDb.updateError = null
  })

  it('should return entries filtered by user and org', async () => {
    const entries = [
      { id: 'e1', description: 'Task A', org_id: 'org-uuid-1', user_id: 'user_abc' },
      { id: 'e2', description: 'Task B', org_id: 'org-uuid-1', user_id: 'user_abc' },
    ]
    mockDb.queryResult = entries

    const res = await GET(makeGetRequest(), context)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data).toEqual(entries)
    expect(body.error).toBeNull()
  })

  it('should support from/to date filtering', async () => {
    mockDb.queryResult = []
    const { createServerClient } = await import('@/lib/supabase/server')

    const req = makeGetRequest({
      from: '2026-03-10T00:00:00Z',
      to: '2026-03-17T23:59:59Z',
    })
    const res = await GET(req, context)
    expect(res.status).toBe(200)

    // Verify gte/lte were called on the chain
    const supabase = (createServerClient as ReturnType<typeof vi.fn>).mock.results[0]?.value
    expect(supabase.gte).toHaveBeenCalledWith('started_at', '2026-03-10T00:00:00Z')
    expect(supabase.lte).toHaveBeenCalledWith('started_at', '2026-03-17T23:59:59Z')
  })

  it('should support block_id filtering', async () => {
    mockDb.queryResult = []
    const { createServerClient } = await import('@/lib/supabase/server')
    const blockId = '550e8400-e29b-41d4-a716-446655440000'

    const req = makeGetRequest({ block_id: blockId })
    const res = await GET(req, context)
    expect(res.status).toBe(200)

    const supabase = (createServerClient as ReturnType<typeof vi.fn>).mock.results[0]?.value
    // eq is called for org_id, user_id, and block_id
    expect(supabase.eq).toHaveBeenCalledWith('block_id', blockId)
  })

  it('should return empty array when no entries found', async () => {
    mockDb.queryResult = []

    const res = await GET(makeGetRequest(), context)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data).toEqual([])
  })

  it('should return 500 when database query fails', async () => {
    mockDb.queryResult = null
    mockDb.queryError = { code: 'PGRST000', message: 'Database error' }

    const res = await GET(makeGetRequest(), context)
    expect(res.status).toBe(500)

    const body = await res.json()
    expect(body.error.code).toBe('db/query-failed')
  })

  it('should default limit to 50', async () => {
    mockDb.queryResult = []
    const { createServerClient } = await import('@/lib/supabase/server')

    const req = makeGetRequest()
    await GET(req, context)

    const supabase = (createServerClient as ReturnType<typeof vi.fn>).mock.results[0]?.value
    expect(supabase.limit).toHaveBeenCalledWith(50)
  })

  it('should cap limit parameter at 200', async () => {
    mockDb.queryResult = []
    const { createServerClient } = await import('@/lib/supabase/server')

    const req = makeGetRequest({ limit: '500' })
    await GET(req, context)

    const supabase = (createServerClient as ReturnType<typeof vi.fn>).mock.results[0]?.value
    expect(supabase.limit).toHaveBeenCalledWith(200)
  })

  it('should return null data as empty array', async () => {
    mockDb.queryResult = null
    mockDb.queryError = null

    const res = await GET(makeGetRequest(), context)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })
})

describe('POST /api/time-entries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.queryResult = null
    mockDb.queryError = null
    mockDb.insertResult = null
    mockDb.insertError = null
    mockDb.updateResult = null
    mockDb.updateError = null
  })

  it('should create an entry with correct fields', async () => {
    const created = {
      id: 'entry-1',
      org_id: 'org-uuid-1',
      user_id: 'user_abc',
      description: 'Working on feature',
      started_at: '2026-03-17T09:00:00Z',
      ended_at: null,
      duration_seconds: null,
      is_billable: false,
      block_id: null,
    }
    mockDb.insertResult = created

    const req = makePostRequest({
      description: 'Working on feature',
      started_at: '2026-03-17T09:00:00Z',
      is_billable: false,
    })
    const res = await POST(req, context)
    expect(res.status).toBe(201)

    const body = await res.json()
    expect(body.data.id).toBe('entry-1')
    expect(body.data.description).toBe('Working on feature')
    expect(body.error).toBeNull()
  })

  it('should auto-compute duration_seconds when ended_at is provided', async () => {
    const startedAt = '2026-03-17T09:00:00Z'
    const endedAt = '2026-03-17T10:30:00Z'

    mockDb.insertResult = {
      id: 'entry-2',
      started_at: startedAt,
      ended_at: endedAt,
      duration_seconds: 5400,
    }

    const { createServerClient } = await import('@/lib/supabase/server')

    const req = makePostRequest({
      description: 'Completed task',
      started_at: startedAt,
      ended_at: endedAt,
      is_billable: true,
    })
    const res = await POST(req, context)
    expect(res.status).toBe(201)

    const supabase = (createServerClient as ReturnType<typeof vi.fn>).mock.results[0]?.value
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        duration_seconds: 5400,
        is_billable: true,
      })
    )
  })

  it('should use provided duration_seconds over auto-computed', async () => {
    mockDb.insertResult = { id: 'entry-3', duration_seconds: 1800 }
    const { createServerClient } = await import('@/lib/supabase/server')

    const req = makePostRequest({
      description: 'Manual duration',
      started_at: '2026-03-17T09:00:00Z',
      ended_at: '2026-03-17T10:00:00Z',
      duration_seconds: 1800,
    })
    const res = await POST(req, context)
    expect(res.status).toBe(201)

    const supabase = (createServerClient as ReturnType<typeof vi.fn>).mock.results[0]?.value
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({ duration_seconds: 1800 })
    )
  })

  it('should set block_id when provided', async () => {
    const blockId = '550e8400-e29b-41d4-a716-446655440000'
    mockDb.insertResult = { id: 'entry-4', block_id: blockId }
    const { createServerClient } = await import('@/lib/supabase/server')

    const req = makePostRequest({
      block_id: blockId,
      description: 'Block linked',
    })
    const res = await POST(req, context)
    expect(res.status).toBe(201)

    const supabase = (createServerClient as ReturnType<typeof vi.fn>).mock.results[0]?.value
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({ block_id: blockId })
    )
  })

  it('should return validation error for description exceeding max length', async () => {
    const req = makePostRequest({
      description: 'x'.repeat(501),
    })
    const res = await POST(req, context)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error.code).toBe('validation/invalid-input')
  })

  it('should return validation error for invalid block_id format', async () => {
    const req = makePostRequest({
      block_id: 'not-a-uuid',
    })
    const res = await POST(req, context)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error.code).toBe('validation/invalid-input')
  })

  it('should return 500 when database insert fails', async () => {
    mockDb.insertError = { code: 'PGRST000', message: 'Insert failed' }

    const req = makePostRequest({ description: 'Will fail' })
    const res = await POST(req, context)
    expect(res.status).toBe(500)

    const body = await res.json()
    expect(body.error.code).toBe('db/insert-failed')
  })

  it('should default started_at to now when not provided', async () => {
    mockDb.insertResult = { id: 'entry-5', started_at: '2026-03-17T12:00:00Z' }
    const { createServerClient } = await import('@/lib/supabase/server')

    const req = makePostRequest({ description: 'No start time' })
    const res = await POST(req, context)
    expect(res.status).toBe(201)

    const supabase = (createServerClient as ReturnType<typeof vi.fn>).mock.results[0]?.value
    const insertCall = supabase.insert.mock.calls[0][0]
    expect(insertCall.started_at).toBeDefined()
    expect(new Date(insertCall.started_at).getTime()).not.toBeNaN()
  })

  it('should log entry.created on success', async () => {
    mockDb.insertResult = { id: 'entry-logged' }

    const req = makePostRequest({ description: 'Log me' })
    await POST(req, context)

    const { logger } = await import('@/lib/logger')
    expect(logger.info).toHaveBeenCalledWith(
      'api-time-entries',
      'entry.created',
      expect.objectContaining({
        org_id: 'org-uuid-1',
        entry_id: 'entry-logged',
      })
    )
  })
})

describe('PATCH /api/time-entries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.queryResult = null
    mockDb.queryError = null
    mockDb.insertResult = null
    mockDb.insertError = null
    mockDb.updateResult = null
    mockDb.updateError = null
  })

  it('should update an entry', async () => {
    mockDb.updateResult = {
      id: 'entry-1',
      description: 'Updated description',
    }

    const req = makePatchRequest({ description: 'Updated description' }, 'entry-1')
    const res = await PATCH(req, context)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data.description).toBe('Updated description')
  })

  it('should reject when entry ID is missing', async () => {
    const req = makePatchRequest({ description: 'No ID' })
    const res = await PATCH(req, context)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error.code).toBe('validation/missing-id')
  })

  it('should recompute duration when both started_at and ended_at are provided', async () => {
    mockDb.updateResult = { id: 'entry-1', duration_seconds: 7200 }
    const { createServerClient } = await import('@/lib/supabase/server')

    const req = makePatchRequest(
      {
        started_at: '2026-03-17T08:00:00Z',
        ended_at: '2026-03-17T10:00:00Z',
      },
      'entry-1'
    )
    const res = await PATCH(req, context)
    expect(res.status).toBe(200)

    const supabase = (createServerClient as ReturnType<typeof vi.fn>).mock.results[0]?.value
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        duration_seconds: 7200,
      })
    )
  })

  it('should return 500 when database update fails', async () => {
    mockDb.updateError = { code: 'PGRST000', message: 'Update failed' }

    const req = makePatchRequest({ description: 'Fail update' }, 'entry-1')
    const res = await PATCH(req, context)
    expect(res.status).toBe(500)

    const body = await res.json()
    expect(body.error.code).toBe('db/update-failed')
  })

  it('should return validation error for invalid update data', async () => {
    const req = makePatchRequest(
      { description: 'x'.repeat(501) },
      'entry-1'
    )
    const res = await PATCH(req, context)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error.code).toBe('validation/invalid-input')
  })
})
