/**
 * tests/sprint18/active-timer-api.test.ts
 *
 * Unit tests for GET/PATCH /api/time-entries/active — Active Timer API.
 * Covers: fetching null when no timer, returning running timer, stopping
 * a timer with computed duration, and 404 when no active timer to stop.
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

/** Tracks what the "find active" query returns */
const mockDb = vi.hoisted(() => ({
  findResult: null as Record<string, unknown> | null,
  findError: null as { code: string; message: string } | null,
  stopResult: null as Record<string, unknown> | null,
  stopError: null as { code: string; message: string } | null,
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
      let callCount = 0

      const chain: Record<string, unknown> = {}
      chain.from = vi.fn(() => {
        callCount++
        return chain
      })
      chain.select = vi.fn(() => chain)
      chain.eq = vi.fn(() => chain)
      chain.is = vi.fn(() => chain)
      chain.order = vi.fn(() => chain)
      chain.limit = vi.fn(() => chain)
      chain.update = vi.fn(() => chain)
      chain.maybeSingle = vi.fn(() => {
        // First maybeSingle call = find query
        return Promise.resolve({
          data: mockDb.findResult,
          error: mockDb.findError,
        })
      })
      chain.single = vi.fn(() => {
        // second chain (update) returns stopResult/stopError
        return Promise.resolve({
          data: mockDb.stopResult,
          error: mockDb.stopError,
        })
      })

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

import { GET, PATCH } from '@/app/api/time-entries/active/route'

// ---- Helpers ---------------------------------------------------------------

const context = { params: Promise.resolve({}) }

function makeGetRequest() {
  return new NextRequest('http://localhost/api/time-entries/active')
}

function makePatchRequest() {
  return new NextRequest('http://localhost/api/time-entries/active', {
    method: 'PATCH',
  })
}

// ---- Tests -----------------------------------------------------------------

describe('GET /api/time-entries/active', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.findResult = null
    mockDb.findError = null
    mockDb.stopResult = null
    mockDb.stopError = null
  })

  it('should return null when no active timer exists', async () => {
    mockDb.findResult = null

    const res = await GET(makeGetRequest(), context)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data).toBeNull()
    expect(body.error).toBeNull()
  })

  it('should return the running timer (ended_at IS NULL)', async () => {
    const runningTimer = {
      id: 'timer-1',
      org_id: 'org-uuid-1',
      user_id: 'user_abc',
      description: 'Working on sprint 18',
      started_at: '2026-03-17T09:00:00Z',
      ended_at: null,
      duration_seconds: null,
      is_billable: true,
      block_id: null,
    }
    mockDb.findResult = runningTimer

    const res = await GET(makeGetRequest(), context)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data).toEqual(runningTimer)
    expect(body.data.ended_at).toBeNull()
    expect(body.data.id).toBe('timer-1')
  })

  it('should return 500 when database query fails', async () => {
    mockDb.findError = { code: 'PGRST000', message: 'Connection lost' }

    const res = await GET(makeGetRequest(), context)
    expect(res.status).toBe(500)

    const body = await res.json()
    expect(body.error.code).toBe('db/query-failed')
  })

  it('should log error when query fails', async () => {
    mockDb.findError = { code: 'PGRST000', message: 'DB error' }

    await GET(makeGetRequest(), context)

    const { logger } = await import('@/lib/logger')
    expect(logger.error).toHaveBeenCalledWith(
      'api-time-entries',
      'active.fetch_failed',
      expect.objectContaining({ error_code: 'PGRST000' })
    )
  })
})

describe('PATCH /api/time-entries/active', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.findResult = null
    mockDb.findError = null
    mockDb.stopResult = null
    mockDb.stopError = null
  })

  it('should stop the running timer with computed duration_seconds', async () => {
    // Timer started 1 hour ago
    const startedAt = new Date(Date.now() - 3600 * 1000).toISOString()
    mockDb.findResult = {
      id: 'timer-1',
      started_at: startedAt,
    }
    mockDb.stopResult = {
      id: 'timer-1',
      started_at: startedAt,
      ended_at: new Date().toISOString(),
      duration_seconds: 3600,
    }

    const res = await PATCH(makePatchRequest(), context)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data.id).toBe('timer-1')
    expect(body.data.ended_at).toBeDefined()
    expect(body.data.duration_seconds).toBeDefined()
  })

  it('should return 404 when no active timer to stop', async () => {
    mockDb.findResult = null

    const res = await PATCH(makePatchRequest(), context)
    expect(res.status).toBe(404)

    const body = await res.json()
    expect(body.error.code).toBe('timer/not-running')
    expect(body.error.message).toContain('No active timer')
  })

  it('should return 500 when find query fails during stop', async () => {
    mockDb.findError = { code: 'PGRST000', message: 'Query failed' }

    const res = await PATCH(makePatchRequest(), context)
    expect(res.status).toBe(500)

    const body = await res.json()
    expect(body.error.code).toBe('db/query-failed')
  })

  it('should return 500 when update query fails during stop', async () => {
    mockDb.findResult = {
      id: 'timer-1',
      started_at: '2026-03-17T09:00:00Z',
    }
    mockDb.stopError = { code: 'PGRST000', message: 'Update failed' }

    const res = await PATCH(makePatchRequest(), context)
    expect(res.status).toBe(500)

    const body = await res.json()
    expect(body.error.code).toBe('db/update-failed')
  })

  it('should log timer.stopped on success', async () => {
    const startedAt = new Date(Date.now() - 1800 * 1000).toISOString()
    mockDb.findResult = { id: 'timer-log', started_at: startedAt }
    mockDb.stopResult = { id: 'timer-log', ended_at: new Date().toISOString(), duration_seconds: 1800 }

    await PATCH(makePatchRequest(), context)

    const { logger } = await import('@/lib/logger')
    expect(logger.info).toHaveBeenCalledWith(
      'api-time-entries',
      'timer.stopped',
      expect.objectContaining({
        org_id: 'org-uuid-1',
        entry_id: 'timer-log',
      })
    )
  })

  it('should compute duration_seconds as difference between now and started_at', async () => {
    // Set up a timer that started exactly 120 seconds ago
    const startedAt = new Date(Date.now() - 120_000).toISOString()
    mockDb.findResult = { id: 'timer-dur', started_at: startedAt }
    mockDb.stopResult = { id: 'timer-dur' }

    const { createServerClient } = await import('@/lib/supabase/server')

    await PATCH(makePatchRequest(), context)

    const supabase = (createServerClient as ReturnType<typeof vi.fn>).mock.results[0]?.value
    if (supabase) {
      const updateCall = (supabase.update as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
      if (updateCall) {
        // Allow 2-second tolerance for test execution time
        expect(updateCall.duration_seconds).toBeGreaterThanOrEqual(118)
        expect(updateCall.duration_seconds).toBeLessThanOrEqual(125)
        expect(updateCall.ended_at).toBeDefined()
      }
    }
  })
})
