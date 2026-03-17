/**
 * tests/sprint19/calendar-events-api.test.ts
 *
 * Unit tests for GET/POST/PATCH /api/calendar-events -- Calendar Events CRUD API.
 * Covers date range filtering, event creation with all fields, validation
 * rejection, update flow, and error handling.
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
      let mode: 'query' | 'insert' | 'update' = 'query'

      const chain: Record<string, ReturnType<typeof vi.fn>> = {}

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

import { GET, POST, PATCH } from '@/app/api/calendar-events/route'

// ---- Helpers ---------------------------------------------------------------

function makeGetRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/calendar-events')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return new NextRequest(url)
}

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/calendar-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makePatchRequest(body: Record<string, unknown>, id?: string) {
  const url = new URL('http://localhost/api/calendar-events')
  if (id) url.searchParams.set('id', id)
  return new NextRequest(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const context = { params: Promise.resolve({}) }

// ---- Tests -----------------------------------------------------------------

describe('GET /api/calendar-events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.queryResult = []
    mockDb.queryError = null
    mockDb.insertResult = null
    mockDb.insertError = null
    mockDb.updateResult = null
    mockDb.updateError = null
  })

  it('should return 400 when from param is missing', async () => {
    const req = makeGetRequest({ to: '2026-03-20T00:00:00Z' })
    const res = await GET(req, context)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error.code).toBe('validation/missing-range')
    expect(body.error.message).toContain('from/to')
  })

  it('should return 400 when to param is missing', async () => {
    const req = makeGetRequest({ from: '2026-03-10T00:00:00Z' })
    const res = await GET(req, context)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error.code).toBe('validation/missing-range')
  })

  it('should return 400 when both from and to are missing', async () => {
    const req = makeGetRequest()
    const res = await GET(req, context)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error.code).toBe('validation/missing-range')
  })

  it('should return events filtered by user, org, and date range', async () => {
    const events = [
      { id: 'e1', title: 'Standup', org_id: 'org-uuid-1', user_id: 'user_abc' },
      { id: 'e2', title: 'Planning', org_id: 'org-uuid-1', user_id: 'user_abc' },
    ]
    mockDb.queryResult = events

    const req = makeGetRequest({
      from: '2026-03-10T00:00:00Z',
      to: '2026-03-17T23:59:59Z',
    })
    const res = await GET(req, context)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data).toEqual(events)
    expect(body.data).toHaveLength(2)
    expect(body.error).toBeNull()
  })

  it('should apply org_id and user_id filters to Supabase query', async () => {
    mockDb.queryResult = []
    const { createServerClient } = await import('@/lib/supabase/server')

    const req = makeGetRequest({
      from: '2026-03-10T00:00:00Z',
      to: '2026-03-17T23:59:59Z',
    })
    await GET(req, context)

    const supabase = (createServerClient as ReturnType<typeof vi.fn>).mock.results[0]?.value
    expect(supabase.from).toHaveBeenCalledWith('calendar_events')
    expect(supabase.eq).toHaveBeenCalledWith('org_id', 'org-uuid-1')
    expect(supabase.eq).toHaveBeenCalledWith('user_id', 'user_abc')
  })

  it('should filter events by end_at >= from and start_at <= to', async () => {
    mockDb.queryResult = []
    const { createServerClient } = await import('@/lib/supabase/server')

    const req = makeGetRequest({
      from: '2026-03-10T00:00:00Z',
      to: '2026-03-17T23:59:59Z',
    })
    await GET(req, context)

    const supabase = (createServerClient as ReturnType<typeof vi.fn>).mock.results[0]?.value
    expect(supabase.gte).toHaveBeenCalledWith('end_at', '2026-03-10T00:00:00Z')
    expect(supabase.lte).toHaveBeenCalledWith('start_at', '2026-03-17T23:59:59Z')
  })

  it('should order results by start_at ascending', async () => {
    mockDb.queryResult = []
    const { createServerClient } = await import('@/lib/supabase/server')

    const req = makeGetRequest({
      from: '2026-03-10T00:00:00Z',
      to: '2026-03-17T23:59:59Z',
    })
    await GET(req, context)

    const supabase = (createServerClient as ReturnType<typeof vi.fn>).mock.results[0]?.value
    expect(supabase.order).toHaveBeenCalledWith('start_at', { ascending: true })
  })

  it('should limit results to 500', async () => {
    mockDb.queryResult = []
    const { createServerClient } = await import('@/lib/supabase/server')

    const req = makeGetRequest({
      from: '2026-03-10T00:00:00Z',
      to: '2026-03-17T23:59:59Z',
    })
    await GET(req, context)

    const supabase = (createServerClient as ReturnType<typeof vi.fn>).mock.results[0]?.value
    expect(supabase.limit).toHaveBeenCalledWith(500)
  })

  it('should return empty array when no events found', async () => {
    mockDb.queryResult = []

    const req = makeGetRequest({
      from: '2026-03-10T00:00:00Z',
      to: '2026-03-17T23:59:59Z',
    })
    const res = await GET(req, context)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data).toEqual([])
  })

  it('should return empty array when data is null', async () => {
    mockDb.queryResult = null
    mockDb.queryError = null

    const req = makeGetRequest({
      from: '2026-03-10T00:00:00Z',
      to: '2026-03-17T23:59:59Z',
    })
    const res = await GET(req, context)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data).toEqual([])
  })

  it('should return 500 when database query fails', async () => {
    mockDb.queryResult = null
    mockDb.queryError = { code: 'PGRST000', message: 'Database error' }

    const req = makeGetRequest({
      from: '2026-03-10T00:00:00Z',
      to: '2026-03-17T23:59:59Z',
    })
    const res = await GET(req, context)
    expect(res.status).toBe(500)

    const body = await res.json()
    expect(body.error.code).toBe('db/query-failed')
  })
})

describe('POST /api/calendar-events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.queryResult = null
    mockDb.queryError = null
    mockDb.insertResult = null
    mockDb.insertError = null
    mockDb.updateResult = null
    mockDb.updateError = null
  })

  it('should create an event with all fields', async () => {
    const created = {
      id: 'event-1',
      org_id: 'org-uuid-1',
      user_id: 'user_abc',
      title: 'Sprint Planning',
      description: 'Weekly sprint planning session',
      start_at: '2026-03-18T09:00:00Z',
      end_at: '2026-03-18T10:00:00Z',
      all_day: false,
      source: 'local',
      color: 'blue',
      block_id: null,
    }
    mockDb.insertResult = created

    const req = makePostRequest({
      title: 'Sprint Planning',
      description: 'Weekly sprint planning session',
      start_at: '2026-03-18T09:00:00Z',
      end_at: '2026-03-18T10:00:00Z',
      all_day: false,
      color: 'blue',
    })
    const res = await POST(req, context)
    expect(res.status).toBe(201)

    const body = await res.json()
    expect(body.data.id).toBe('event-1')
    expect(body.data.title).toBe('Sprint Planning')
    expect(body.data.source).toBe('local')
    expect(body.error).toBeNull()
  })

  it('should set source to "local" on insert', async () => {
    mockDb.insertResult = { id: 'event-2', source: 'local' }
    const { createServerClient } = await import('@/lib/supabase/server')

    const req = makePostRequest({
      title: 'Test Event',
      start_at: '2026-03-18T09:00:00Z',
      end_at: '2026-03-18T10:00:00Z',
    })
    await POST(req, context)

    const supabase = (createServerClient as ReturnType<typeof vi.fn>).mock.results[0]?.value
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'local' })
    )
  })

  it('should set org_id and user_id from auth context', async () => {
    mockDb.insertResult = { id: 'event-3' }
    const { createServerClient } = await import('@/lib/supabase/server')

    const req = makePostRequest({
      title: 'Context Test',
      start_at: '2026-03-18T09:00:00Z',
      end_at: '2026-03-18T10:00:00Z',
    })
    await POST(req, context)

    const supabase = (createServerClient as ReturnType<typeof vi.fn>).mock.results[0]?.value
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-uuid-1',
        user_id: 'user_abc',
      })
    )
  })

  it('should return validation error when title is missing', async () => {
    const req = makePostRequest({
      start_at: '2026-03-18T09:00:00Z',
      end_at: '2026-03-18T10:00:00Z',
    })
    const res = await POST(req, context)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error.code).toBe('validation/invalid-input')
  })

  it('should return validation error when title is empty string', async () => {
    const req = makePostRequest({
      title: '',
      start_at: '2026-03-18T09:00:00Z',
      end_at: '2026-03-18T10:00:00Z',
    })
    const res = await POST(req, context)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error.code).toBe('validation/invalid-input')
  })

  it('should return validation error for invalid start_at datetime', async () => {
    const req = makePostRequest({
      title: 'Bad date',
      start_at: 'not-a-date',
      end_at: '2026-03-18T10:00:00Z',
    })
    const res = await POST(req, context)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error.code).toBe('validation/invalid-input')
  })

  it('should default all_day to false when not provided', async () => {
    mockDb.insertResult = { id: 'event-4', all_day: false }
    const { createServerClient } = await import('@/lib/supabase/server')

    const req = makePostRequest({
      title: 'Default all_day',
      start_at: '2026-03-18T09:00:00Z',
      end_at: '2026-03-18T10:00:00Z',
    })
    await POST(req, context)

    const supabase = (createServerClient as ReturnType<typeof vi.fn>).mock.results[0]?.value
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({ all_day: false })
    )
  })

  it('should default color to "primary" when not provided', async () => {
    mockDb.insertResult = { id: 'event-5', color: 'primary' }
    const { createServerClient } = await import('@/lib/supabase/server')

    const req = makePostRequest({
      title: 'Default color',
      start_at: '2026-03-18T09:00:00Z',
      end_at: '2026-03-18T10:00:00Z',
    })
    await POST(req, context)

    const supabase = (createServerClient as ReturnType<typeof vi.fn>).mock.results[0]?.value
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'primary' })
    )
  })

  it('should set block_id to null when not provided', async () => {
    mockDb.insertResult = { id: 'event-6', block_id: null }
    const { createServerClient } = await import('@/lib/supabase/server')

    const req = makePostRequest({
      title: 'No block',
      start_at: '2026-03-18T09:00:00Z',
      end_at: '2026-03-18T10:00:00Z',
    })
    await POST(req, context)

    const supabase = (createServerClient as ReturnType<typeof vi.fn>).mock.results[0]?.value
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({ block_id: null })
    )
  })

  it('should accept a valid block_id UUID', async () => {
    const blockId = '550e8400-e29b-41d4-a716-446655440000'
    mockDb.insertResult = { id: 'event-7', block_id: blockId }
    const { createServerClient } = await import('@/lib/supabase/server')

    const req = makePostRequest({
      title: 'Block linked event',
      start_at: '2026-03-18T09:00:00Z',
      end_at: '2026-03-18T10:00:00Z',
      block_id: blockId,
    })
    await POST(req, context)

    const supabase = (createServerClient as ReturnType<typeof vi.fn>).mock.results[0]?.value
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({ block_id: blockId })
    )
  })

  it('should return validation error for invalid block_id format', async () => {
    const req = makePostRequest({
      title: 'Bad block id',
      start_at: '2026-03-18T09:00:00Z',
      end_at: '2026-03-18T10:00:00Z',
      block_id: 'not-a-uuid',
    })
    const res = await POST(req, context)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error.code).toBe('validation/invalid-input')
  })

  it('should return 500 when database insert fails', async () => {
    mockDb.insertError = { code: 'PGRST000', message: 'Insert failed' }

    const req = makePostRequest({
      title: 'Will fail',
      start_at: '2026-03-18T09:00:00Z',
      end_at: '2026-03-18T10:00:00Z',
    })
    const res = await POST(req, context)
    expect(res.status).toBe(500)

    const body = await res.json()
    expect(body.error.code).toBe('db/insert-failed')
  })

  it('should log event.created on success', async () => {
    mockDb.insertResult = { id: 'event-logged' }

    const req = makePostRequest({
      title: 'Log me',
      start_at: '2026-03-18T09:00:00Z',
      end_at: '2026-03-18T10:00:00Z',
    })
    await POST(req, context)

    const { logger } = await import('@/lib/logger')
    expect(logger.info).toHaveBeenCalledWith(
      'api-calendar',
      'event.created',
      expect.objectContaining({
        org_id: 'org-uuid-1',
        event_id: 'event-logged',
      })
    )
  })
})

describe('PATCH /api/calendar-events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.queryResult = null
    mockDb.queryError = null
    mockDb.insertResult = null
    mockDb.insertError = null
    mockDb.updateResult = null
    mockDb.updateError = null
  })

  it('should update an event', async () => {
    mockDb.updateResult = {
      id: 'event-1',
      title: 'Updated Title',
      description: 'Updated description',
    }

    const req = makePatchRequest({ title: 'Updated Title' }, 'event-1')
    const res = await PATCH(req, context)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data.title).toBe('Updated Title')
  })

  it('should reject when event ID is missing', async () => {
    const req = makePatchRequest({ title: 'No ID' })
    const res = await PATCH(req, context)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error.code).toBe('validation/missing-id')
    expect(body.error.message).toContain('event ID')
  })

  it('should scope update to user org_id and user_id', async () => {
    mockDb.updateResult = { id: 'event-1', title: 'Scoped' }
    const { createServerClient } = await import('@/lib/supabase/server')

    const req = makePatchRequest({ title: 'Scoped' }, 'event-1')
    await PATCH(req, context)

    const supabase = (createServerClient as ReturnType<typeof vi.fn>).mock.results[0]?.value
    expect(supabase.eq).toHaveBeenCalledWith('id', 'event-1')
    expect(supabase.eq).toHaveBeenCalledWith('org_id', 'org-uuid-1')
    expect(supabase.eq).toHaveBeenCalledWith('user_id', 'user_abc')
  })

  it('should include updated_at in update payload', async () => {
    mockDb.updateResult = { id: 'event-1' }
    const { createServerClient } = await import('@/lib/supabase/server')

    const before = new Date().toISOString()
    const req = makePatchRequest({ title: 'Timestamp check' }, 'event-1')
    await PATCH(req, context)

    const supabase = (createServerClient as ReturnType<typeof vi.fn>).mock.results[0]?.value
    const updateCall = supabase.update.mock.calls[0][0]
    expect(updateCall.updated_at).toBeDefined()
    const updatedDate = new Date(updateCall.updated_at)
    expect(updatedDate.getTime()).toBeGreaterThanOrEqual(new Date(before).getTime())
  })

  it('should return validation error for invalid update data', async () => {
    const req = makePatchRequest(
      { title: 'x'.repeat(501) },
      'event-1'
    )
    const res = await PATCH(req, context)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error.code).toBe('validation/invalid-input')
  })

  it('should return 500 when database update fails', async () => {
    mockDb.updateError = { code: 'PGRST000', message: 'Update failed' }

    const req = makePatchRequest({ title: 'Fail update' }, 'event-1')
    const res = await PATCH(req, context)
    expect(res.status).toBe(500)

    const body = await res.json()
    expect(body.error.code).toBe('db/update-failed')
  })

  it('should allow partial updates (only color)', async () => {
    mockDb.updateResult = { id: 'event-1', color: 'green' }

    const req = makePatchRequest({ color: 'green' }, 'event-1')
    const res = await PATCH(req, context)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data.color).toBe('green')
  })
})
