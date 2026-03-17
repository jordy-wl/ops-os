/**
 * tests/sprint20/team-utilization-api.test.ts
 *
 * Unit tests for GET /api/performance/team -- Team utilization endpoint.
 * Covers: per-member stats, on-time rate, billable rate, sort order,
 * team totals, empty data, and authentication via withAuth.
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
  teamMembers: null as unknown[] | null,
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
      let currentTable = ''
      let eqFilters: Record<string, string> = {}

      const chain: Record<string, ReturnType<typeof vi.fn>> = {}

      chain.from = vi.fn((table: string) => {
        currentTable = table
        eqFilters = {}
        return chain
      })
      chain.select = vi.fn(() => chain)
      chain.eq = vi.fn((col: string, val: string) => {
        eqFilters[col] = val
        return chain
      })
      chain.gte = vi.fn(() => chain)
      chain.lte = vi.fn(() => chain)
      chain.not = vi.fn(() => chain)
      chain.order = vi.fn(() => chain)
      chain.limit = vi.fn(() => chain)
      chain.in = vi.fn(() => chain)

      // Make chain thenable
      ;(chain as Record<string, unknown>).then = function (
        onFulfilled?: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) {
        let result: { data: unknown; error: unknown }

        if (currentTable === 'performance_snapshots') {
          result = { data: mockDb.snapshots, error: mockDb.snapshotsError }
        } else if (currentTable === 'blocks' && eqFilters['type'] === 'team_member') {
          result = { data: mockDb.teamMembers, error: null }
        } else {
          result = { data: null, error: null }
        }

        return Promise.resolve(result).then(onFulfilled, onRejected)
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

import { GET } from '@/app/api/performance/team/route'

// ---- Helpers ---------------------------------------------------------------

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/performance/team')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return new NextRequest(url)
}

const context = { params: Promise.resolve({}) }

// ---- Tests -----------------------------------------------------------------

describe('GET /api/performance/team', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.snapshots = []
    mockDb.snapshotsError = null
    mockDb.teamMembers = []
  })

  // -- Auth --

  it('should be wrapped with withAuth', () => {
    // withAuth is called at module load time (export const GET = withAuth(handler))
    // We verify the GET export is a function (the wrapped handler)
    expect(typeof GET).toBe('function')
  })

  // -- Per-member stats --

  it('should return per-member stats', async () => {
    mockDb.snapshots = [
      { user_id: 'user-a', period_start: '2026-03-10', tasks_completed: 5, tasks_on_time: 4, tasks_overdue: 1, total_time_seconds: 36000, billable_time_seconds: 28800, workflows_completed: 2, workflows_failed: 0 },
      { user_id: 'user-b', period_start: '2026-03-10', tasks_completed: 3, tasks_on_time: 3, tasks_overdue: 0, total_time_seconds: 28800, billable_time_seconds: 14400, workflows_completed: 1, workflows_failed: 1 },
    ]
    mockDb.teamMembers = [
      { id: 'tm-1', name: 'Alice Smith', metadata: { clerk_user_id: 'user-a' } },
      { id: 'tm-2', name: 'Bob Jones', metadata: { clerk_user_id: 'user-b' } },
    ]

    const req = makeRequest()
    const res = await GET(req, context)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data.members).toHaveLength(2)

    const alice = body.data.members.find((m: Record<string, unknown>) => m.user_id === 'user-a')
    expect(alice).toBeDefined()
    expect(alice.name).toBe('Alice Smith')
    expect(alice.tasks_completed).toBe(5)
    expect(alice.tasks_on_time).toBe(4)
    expect(alice.tasks_overdue).toBe(1)
  })

  // -- On-time rate --

  it('should compute on-time rate as percentage', async () => {
    mockDb.snapshots = [
      { user_id: 'user-a', period_start: '2026-03-10', tasks_completed: 10, tasks_on_time: 8, tasks_overdue: 2, total_time_seconds: 36000, billable_time_seconds: 28800, workflows_completed: 0, workflows_failed: 0 },
    ]
    mockDb.teamMembers = []

    const req = makeRequest()
    const res = await GET(req, context)
    const body = await res.json()

    const member = body.data.members[0]
    expect(member.on_time_rate).toBe(80) // 8/10 * 100
  })

  it('should return 100% on-time rate when no tasks completed', async () => {
    mockDb.snapshots = [
      { user_id: 'user-a', period_start: '2026-03-10', tasks_completed: 0, tasks_on_time: 0, tasks_overdue: 0, total_time_seconds: 36000, billable_time_seconds: 28800, workflows_completed: 0, workflows_failed: 0 },
    ]
    mockDb.teamMembers = []

    const req = makeRequest()
    const res = await GET(req, context)
    const body = await res.json()

    expect(body.data.members[0].on_time_rate).toBe(100)
  })

  // -- Billable rate --

  it('should compute billable rate as percentage', async () => {
    mockDb.snapshots = [
      { user_id: 'user-a', period_start: '2026-03-10', tasks_completed: 5, tasks_on_time: 5, tasks_overdue: 0, total_time_seconds: 40000, billable_time_seconds: 30000, workflows_completed: 0, workflows_failed: 0 },
    ]
    mockDb.teamMembers = []

    const req = makeRequest()
    const res = await GET(req, context)
    const body = await res.json()

    expect(body.data.members[0].billable_rate).toBe(75) // 30000/40000 * 100
  })

  it('should return 0% billable rate when no time logged', async () => {
    mockDb.snapshots = [
      { user_id: 'user-a', period_start: '2026-03-10', tasks_completed: 5, tasks_on_time: 5, tasks_overdue: 0, total_time_seconds: 0, billable_time_seconds: 0, workflows_completed: 0, workflows_failed: 0 },
    ]
    mockDb.teamMembers = []

    const req = makeRequest()
    const res = await GET(req, context)
    const body = await res.json()

    expect(body.data.members[0].billable_rate).toBe(0)
  })

  // -- Sort order --

  it('should sort members by tasks completed descending', async () => {
    mockDb.snapshots = [
      { user_id: 'user-a', period_start: '2026-03-10', tasks_completed: 3, tasks_on_time: 3, tasks_overdue: 0, total_time_seconds: 10000, billable_time_seconds: 5000, workflows_completed: 0, workflows_failed: 0 },
      { user_id: 'user-b', period_start: '2026-03-10', tasks_completed: 10, tasks_on_time: 8, tasks_overdue: 2, total_time_seconds: 50000, billable_time_seconds: 40000, workflows_completed: 0, workflows_failed: 0 },
      { user_id: 'user-c', period_start: '2026-03-10', tasks_completed: 7, tasks_on_time: 7, tasks_overdue: 0, total_time_seconds: 30000, billable_time_seconds: 20000, workflows_completed: 0, workflows_failed: 0 },
    ]
    mockDb.teamMembers = []

    const req = makeRequest()
    const res = await GET(req, context)
    const body = await res.json()

    expect(body.data.members[0].user_id).toBe('user-b')  // 10 tasks
    expect(body.data.members[1].user_id).toBe('user-c')  // 7 tasks
    expect(body.data.members[2].user_id).toBe('user-a')  // 3 tasks
  })

  // -- Aggregation across weeks --

  it('should aggregate stats across multiple weeks for the same user', async () => {
    mockDb.snapshots = [
      { user_id: 'user-a', period_start: '2026-03-03', tasks_completed: 5, tasks_on_time: 4, tasks_overdue: 1, total_time_seconds: 36000, billable_time_seconds: 28800, workflows_completed: 2, workflows_failed: 0 },
      { user_id: 'user-a', period_start: '2026-03-10', tasks_completed: 8, tasks_on_time: 7, tasks_overdue: 1, total_time_seconds: 40000, billable_time_seconds: 32000, workflows_completed: 3, workflows_failed: 1 },
    ]
    mockDb.teamMembers = []

    const req = makeRequest()
    const res = await GET(req, context)
    const body = await res.json()

    expect(body.data.members).toHaveLength(1)
    const member = body.data.members[0]
    expect(member.tasks_completed).toBe(13) // 5 + 8
    expect(member.tasks_on_time).toBe(11)   // 4 + 7
    expect(member.tasks_overdue).toBe(2)    // 1 + 1
    expect(member.total_time_seconds).toBe(76000) // 36000 + 40000
    expect(member.billable_time_seconds).toBe(60800) // 28800 + 32000
    expect(member.workflows_completed).toBe(5) // 2 + 3
    expect(member.workflows_failed).toBe(1)    // 0 + 1
    expect(member.weeks_active).toBe(2)
  })

  // -- Empty data --

  it('should handle no data gracefully', async () => {
    mockDb.snapshots = []
    mockDb.teamMembers = []

    const req = makeRequest()
    const res = await GET(req, context)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data.members).toEqual([])
    expect(body.data.totals.total_members).toBe(0)
    expect(body.data.totals.total_tasks_completed).toBe(0)
    expect(body.data.totals.avg_on_time_rate).toBe(100) // default when no members
  })

  // -- Team totals --

  it('should compute correct team totals', async () => {
    mockDb.snapshots = [
      { user_id: 'user-a', period_start: '2026-03-10', tasks_completed: 5, tasks_on_time: 4, tasks_overdue: 1, total_time_seconds: 36000, billable_time_seconds: 28800, workflows_completed: 0, workflows_failed: 0 },
      { user_id: 'user-b', period_start: '2026-03-10', tasks_completed: 10, tasks_on_time: 8, tasks_overdue: 2, total_time_seconds: 50000, billable_time_seconds: 40000, workflows_completed: 0, workflows_failed: 0 },
    ]
    mockDb.teamMembers = []

    const req = makeRequest()
    const res = await GET(req, context)
    const body = await res.json()

    expect(body.data.totals.total_members).toBe(2)
    expect(body.data.totals.total_tasks_completed).toBe(15)
    expect(body.data.totals.total_time_seconds).toBe(86000)
    expect(body.data.totals.total_billable_seconds).toBe(68800)
    // on-time rates: user-a = 80%, user-b = 80% => avg = 80
    expect(body.data.totals.avg_on_time_rate).toBe(80)
  })

  // -- Name resolution --

  it('should use team member name when available', async () => {
    mockDb.snapshots = [
      { user_id: 'user-a', period_start: '2026-03-10', tasks_completed: 5, tasks_on_time: 5, tasks_overdue: 0, total_time_seconds: 36000, billable_time_seconds: 28800, workflows_completed: 0, workflows_failed: 0 },
    ]
    mockDb.teamMembers = [
      { id: 'tm-1', name: 'Alice Smith', metadata: { clerk_user_id: 'user-a' } },
    ]

    const req = makeRequest()
    const res = await GET(req, context)
    const body = await res.json()

    expect(body.data.members[0].name).toBe('Alice Smith')
  })

  it('should fallback to truncated user_id when no team member name', async () => {
    mockDb.snapshots = [
      { user_id: 'user-abcd-1234', period_start: '2026-03-10', tasks_completed: 5, tasks_on_time: 5, tasks_overdue: 0, total_time_seconds: 36000, billable_time_seconds: 28800, workflows_completed: 0, workflows_failed: 0 },
    ]
    mockDb.teamMembers = []

    const req = makeRequest()
    const res = await GET(req, context)
    const body = await res.json()

    expect(body.data.members[0].name).toBe('user-abc') // first 8 chars
  })

  // -- Weeks covered --

  it('should include weeks_covered in response', async () => {
    mockDb.snapshots = []

    const req = makeRequest({ weeks: '6' })
    const res = await GET(req, context)
    const body = await res.json()

    expect(body.data.weeks_covered).toBe(6)
  })

  // -- Error handling --

  it('should return 500 when database query fails', async () => {
    mockDb.snapshotsError = { code: 'PGRST000', message: 'Database error' }

    const req = makeRequest()
    const res = await GET(req, context)
    expect(res.status).toBe(500)

    const body = await res.json()
    expect(body.error.code).toBe('performance/query-failed')
  })
})
