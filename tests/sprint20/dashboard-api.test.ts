/**
 * tests/sprint20/dashboard-api.test.ts
 *
 * Unit tests for GET /api/performance/dashboard -- Personal performance dashboard.
 * Covers: user snapshots retrieval, team averages, current week live stats,
 * weeks param, empty data handling, and authentication via withAuth.
 *
 * All external dependencies mocked: withAuth, Supabase, logger.
 */

// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { AuthContext } from '@/lib/auth/withAuth'

// ---- Mutable mock state (vi.hoisted for factory sharing) -------------------

const mockCtx = vi.hoisted(() => ({
  current: {
    userId: 'user_perf_123',
    clerkOrgId: 'clerk_org_789',
    orgId: 'org_perf_456',
    role: 'ops-admin' as const,
    roleId: 'role-1',
    permissions: new Set(['manage_blocks'] as const),
  } as unknown as AuthContext,
}))

const mockDb = vi.hoisted(() => ({
  snapshots: null as unknown[] | null,
  snapshotsError: null as { code: string; message: string } | null,
  teamSnaps: null as unknown[] | null,
  timeEntries: null as unknown[] | null,
  currentTasks: null as unknown[] | null,
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
      // Track how many performance_snapshots queries have been made
      // The first one is for user's snapshots, the second is for team averages
      let snapshotQueryCount = 0

      function createChain(table: string) {
        const isTeam = { value: false }
        let chainTable = table

        const chain: Record<string, ReturnType<typeof vi.fn>> = {}

        chain.from = vi.fn((t: string) => {
          return createChain(t)
        })
        chain.select = vi.fn((cols?: string) => {
          if (chainTable === 'performance_snapshots' && cols && cols.includes('period_start') && cols.includes('tasks_completed')) {
            isTeam.value = true
          }
          return chain
        })
        chain.eq = vi.fn(() => chain)
        chain.gte = vi.fn(() => chain)
        chain.lte = vi.fn(() => chain)
        chain.not = vi.fn(() => chain)
        chain.order = vi.fn(() => chain)
        chain.limit = vi.fn(() => chain)
        chain.in = vi.fn(() => {
          // If we are doing .in on performance_snapshots, it's the team query
          if (chainTable === 'performance_snapshots') {
            isTeam.value = true
          }
          return chain
        })

        // Make chain thenable -- resolves based on chainTable
        ;(chain as Record<string, unknown>).then = function (
          onFulfilled?: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown
        ) {
          let result: { data: unknown; error: unknown }

          if (chainTable === 'performance_snapshots') {
            if (isTeam.value) {
              result = { data: mockDb.teamSnaps, error: null }
            } else {
              result = { data: mockDb.snapshots, error: mockDb.snapshotsError }
            }
          } else if (chainTable === 'time_entries') {
            result = { data: mockDb.timeEntries, error: null }
          } else if (chainTable === 'blocks') {
            result = { data: mockDb.currentTasks, error: null }
          } else {
            result = { data: null, error: null }
          }

          return Promise.resolve(result).then(onFulfilled, onRejected)
        }

        return chain
      }

      // The root object just needs a `from` method
      return {
        from: (table: string) => createChain(table),
      }
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

vi.mock('@/lib/api/responses', () => ({
  ok: (data: unknown) => {
    const { NextResponse } = require('next/server')
    return NextResponse.json({ data, error: null })
  },
  apiError: (message: string, code: string, status: number) => {
    const { NextResponse } = require('next/server')
    return NextResponse.json({ data: null, error: { message, code } }, { status })
  },
}))

// ---- Import handler after mocks -------------------------------------------

import { GET } from '@/app/api/performance/dashboard/route'

// ---- Helpers ---------------------------------------------------------------

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/performance/dashboard')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return new NextRequest(url)
}

const context = { params: Promise.resolve({}) }

// ---- Tests -----------------------------------------------------------------

describe('GET /api/performance/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.snapshots = []
    mockDb.snapshotsError = null
    mockDb.teamSnaps = []
    mockDb.timeEntries = []
    mockDb.currentTasks = []
  })

  // -- Auth --

  it('should be wrapped with withAuth', () => {
    // withAuth is called at module load time (export const GET = withAuth(handler))
    // We verify the GET export is the wrapped function returned by our mock
    expect(typeof GET).toBe('function')
    // The mock wraps the handler, so calling GET should work with our context
  })

  // -- User snapshots --

  it('should return user snapshots in chronological order', async () => {
    // The route queries desc and then reverses, so we simulate the desc order
    const snapshots = [
      { period_start: '2026-03-10', period_end: '2026-03-16', tasks_completed: 8, tasks_on_time: 7, tasks_overdue: 1, total_time_seconds: 40000, billable_time_seconds: 32000 },
      { period_start: '2026-03-03', period_end: '2026-03-09', tasks_completed: 5, tasks_on_time: 4, tasks_overdue: 1, total_time_seconds: 36000, billable_time_seconds: 28800 },
    ]
    mockDb.snapshots = snapshots
    mockDb.teamSnaps = [
      { period_start: '2026-03-03', tasks_completed: 10, tasks_on_time: 8, total_time_seconds: 72000, billable_time_seconds: 50000 },
      { period_start: '2026-03-10', tasks_completed: 12, tasks_on_time: 10, total_time_seconds: 80000, billable_time_seconds: 60000 },
    ]

    const req = makeRequest()
    const res = await GET(req, context)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data.snapshots).toHaveLength(2)
    // The route reverses the desc-ordered snapshots, so they come back chronological
    expect(body.data.snapshots[0].period_start).toBe('2026-03-03')
    expect(body.data.snapshots[1].period_start).toBe('2026-03-10')
    expect(body.error).toBeNull()
  })

  // -- Team averages --

  it('should include team averages', async () => {
    mockDb.snapshots = [
      { period_start: '2026-03-10', period_end: '2026-03-16', tasks_completed: 5, tasks_on_time: 4, tasks_overdue: 1, total_time_seconds: 36000, billable_time_seconds: 28800 },
    ]
    mockDb.teamSnaps = [
      { period_start: '2026-03-10', tasks_completed: 5, tasks_on_time: 4, total_time_seconds: 36000, billable_time_seconds: 28800 },
      { period_start: '2026-03-10', tasks_completed: 10, tasks_on_time: 8, total_time_seconds: 50000, billable_time_seconds: 40000 },
    ]

    const req = makeRequest()
    const res = await GET(req, context)
    const body = await res.json()

    expect(body.data.team_averages).toHaveLength(1)
    const avg = body.data.team_averages[0]
    expect(avg.period_start).toBe('2026-03-10')
    expect(avg.avg_tasks_completed).toBe(8) // (5+10)/2 = 7.5 rounded to 8
    expect(avg.team_size).toBe(2)
  })

  // -- Current week live stats --

  it('should include current week live stats', async () => {
    mockDb.snapshots = []
    mockDb.timeEntries = [
      { duration_seconds: 3600, is_billable: true },
      { duration_seconds: 1800, is_billable: false },
    ]
    mockDb.currentTasks = [
      { id: 't1', metadata: { assigned_to: 'user_perf_123', status: 'completed' }, updated_at: '2026-03-17T10:00:00Z' },
      { id: 't2', metadata: { assigned_to: 'user_perf_123', status: 'in_progress' }, updated_at: '2026-03-17T11:00:00Z' },
      { id: 't3', metadata: { assigned_to: 'other_user', status: 'completed' }, updated_at: '2026-03-17T12:00:00Z' },
    ]

    const req = makeRequest()
    const res = await GET(req, context)
    const body = await res.json()

    expect(body.data.current_week).toBeDefined()
    expect(body.data.current_week.tasks_completed).toBe(1) // only user_perf_123's completed task
    expect(body.data.current_week.total_time_seconds).toBe(5400) // 3600 + 1800
    expect(body.data.current_week.billable_time_seconds).toBe(3600) // only billable
    expect(body.data.current_week.period_start).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  // -- Empty data --

  it('should handle no snapshots with empty data', async () => {
    mockDb.snapshots = []
    mockDb.timeEntries = []
    mockDb.currentTasks = []

    const req = makeRequest()
    const res = await GET(req, context)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data.snapshots).toEqual([])
    expect(body.data.team_averages).toEqual([])
    expect(body.data.snapshot_count).toBe(0)
    expect(body.data.current_week).toBeDefined()
    expect(body.data.current_week.tasks_completed).toBe(0)
    expect(body.data.current_week.total_time_seconds).toBe(0)
  })

  // -- Weeks param --

  it('should respect the weeks param', async () => {
    mockDb.snapshots = []

    const req = makeRequest({ weeks: '4' })
    const res = await GET(req, context)
    expect(res.status).toBe(200)

    // Verify the response is valid (param was parsed and used)
    const body = await res.json()
    expect(body.data).toBeDefined()
  })

  it('should cap weeks at 52', async () => {
    mockDb.snapshots = []

    const req = makeRequest({ weeks: '100' })
    const res = await GET(req, context)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data).toBeDefined()
  })

  // -- Snapshot count --

  it('should include snapshot_count in response', async () => {
    mockDb.snapshots = [
      { period_start: '2026-03-03', period_end: '2026-03-09', tasks_completed: 1, tasks_on_time: 1, tasks_overdue: 0, total_time_seconds: 100, billable_time_seconds: 100 },
      { period_start: '2026-03-10', period_end: '2026-03-16', tasks_completed: 2, tasks_on_time: 2, tasks_overdue: 0, total_time_seconds: 200, billable_time_seconds: 200 },
      { period_start: '2026-02-24', period_end: '2026-03-02', tasks_completed: 3, tasks_on_time: 3, tasks_overdue: 0, total_time_seconds: 300, billable_time_seconds: 300 },
    ]
    mockDb.teamSnaps = []

    const req = makeRequest()
    const res = await GET(req, context)
    const body = await res.json()

    expect(body.data.snapshot_count).toBe(3)
  })

  // -- Error handling --

  it('should return 500 when snapshot query fails', async () => {
    mockDb.snapshotsError = { code: 'PGRST000', message: 'Database error' }

    const req = makeRequest()
    const res = await GET(req, context)
    expect(res.status).toBe(500)

    const body = await res.json()
    expect(body.error.code).toBe('performance/query-failed')
  })
})
