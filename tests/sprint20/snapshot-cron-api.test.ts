/**
 * tests/sprint20/snapshot-cron-api.test.ts
 *
 * Unit tests for GET /api/performance/snapshot -- Weekly cron endpoint.
 * Covers: auth (CRON_SECRET), idempotency, time aggregation, task counting,
 * on-time rate, empty orgs, and upsert flow.
 *
 * All external dependencies mocked: Supabase, logger.
 */

// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---- Mutable mock state (vi.hoisted for factory sharing) -------------------

const mockDb = vi.hoisted(() => ({
  orgs: null as unknown[] | null,
  existingSnapshots: null as unknown[] | null,
  timeEntries: null as unknown[] | null,
  completedTasks: null as unknown[] | null,
  deadlines: null as unknown[] | null,
  workflows: null as unknown[] | null,
  upsertError: null as { code: string; message: string } | null,
  upsertedData: [] as unknown[],
}))

const mockEnv = vi.hoisted(() => ({
  cronSecret: 'test-cron-secret-123',
}))

// ---- Mocks -----------------------------------------------------------------

vi.mock('@/lib/supabase/server', () => {
  return {
    createServerClient: vi.fn(() => {
      // Track which table and what query path we're on
      let currentTable = ''
      let queryPath: 'select' | 'upsert' = 'select'
      let eqFilters: Record<string, string> = {}

      const chain: Record<string, ReturnType<typeof vi.fn>> = {}

      chain.from = vi.fn((table: string) => {
        currentTable = table
        queryPath = 'select'
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
      chain.gt = vi.fn(() => chain)

      chain.upsert = vi.fn((data: unknown) => {
        queryPath = 'upsert'
        mockDb.upsertedData = Array.isArray(data) ? data : [data]
        return chain
      })

      // Make chain thenable -- resolves based on current table and path
      ;(chain as Record<string, unknown>).then = function (
        onFulfilled?: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) {
        let result: { data: unknown; error: unknown }

        if (queryPath === 'upsert') {
          result = { data: null, error: mockDb.upsertError }
        } else if (currentTable === 'orgs') {
          result = { data: mockDb.orgs, error: null }
        } else if (currentTable === 'performance_snapshots') {
          result = { data: mockDb.existingSnapshots, error: null }
        } else if (currentTable === 'time_entries') {
          result = { data: mockDb.timeEntries, error: null }
        } else if (currentTable === 'blocks' && eqFilters['type'] === 'task_queue_item') {
          result = { data: mockDb.completedTasks, error: null }
        } else if (currentTable === 'blocks' && eqFilters['type'] === 'workflow_instance') {
          result = { data: mockDb.workflows, error: null }
        } else if (currentTable === 'task_deadlines_v') {
          result = { data: mockDb.deadlines, error: null }
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

// ---- Import handler after mocks -------------------------------------------

import { GET } from '@/app/api/performance/snapshot/route'

// ---- Helpers ---------------------------------------------------------------

function makeRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (authHeader) headers['authorization'] = authHeader
  return new NextRequest('http://localhost/api/performance/snapshot', {
    method: 'GET',
    headers,
  })
}

// ---- Tests -----------------------------------------------------------------

describe('GET /api/performance/snapshot', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv, CRON_SECRET: mockEnv.cronSecret }
    mockDb.orgs = null
    mockDb.existingSnapshots = null
    mockDb.timeEntries = null
    mockDb.completedTasks = null
    mockDb.deadlines = null
    mockDb.workflows = null
    mockDb.upsertError = null
    mockDb.upsertedData = []
  })

  afterEach(() => {
    process.env = originalEnv
  })

  // -- Auth tests --

  it('should reject requests with no authorization header', async () => {
    const req = makeRequest()
    const res = await GET(req)
    expect(res.status).toBe(401)

    const body = await res.json()
    expect(body.error.code).toBe('auth/unauthenticated')
  })

  it('should reject requests with wrong CRON_SECRET', async () => {
    const req = makeRequest('Bearer wrong-secret')
    const res = await GET(req)
    expect(res.status).toBe(401)

    const body = await res.json()
    expect(body.error.message).toBe('Unauthorized')
  })

  it('should reject when CRON_SECRET env is missing', async () => {
    delete process.env.CRON_SECRET
    const req = makeRequest('Bearer test-cron-secret-123')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  // -- Empty orgs --

  it('should return processed: 0 when no orgs exist', async () => {
    mockDb.orgs = []

    const req = makeRequest(`Bearer ${mockEnv.cronSecret}`)
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data.processed).toBe(0)
    expect(body.error).toBeNull()
  })

  it('should return processed: 0 when orgs is null', async () => {
    mockDb.orgs = null

    const req = makeRequest(`Bearer ${mockEnv.cronSecret}`)
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data.processed).toBe(0)
  })

  // -- Idempotency --

  it('should skip orgs that already have snapshots for this period', async () => {
    mockDb.orgs = [{ id: 'org-1' }]
    mockDb.existingSnapshots = [{ id: 'snap-existing' }]
    mockDb.timeEntries = []
    mockDb.completedTasks = []
    mockDb.deadlines = []
    mockDb.workflows = []

    const req = makeRequest(`Bearer ${mockEnv.cronSecret}`)
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data.processed).toBe(0)
  })

  // -- Empty org (no users) --

  it('should skip org when no time entries and no tasks', async () => {
    mockDb.orgs = [{ id: 'org-1' }]
    mockDb.existingSnapshots = []
    mockDb.timeEntries = []
    mockDb.completedTasks = []
    mockDb.deadlines = []
    mockDb.workflows = []

    const req = makeRequest(`Bearer ${mockEnv.cronSecret}`)
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data.processed).toBe(0)
  })

  // -- Time aggregation --

  it('should aggregate time entries by user', async () => {
    mockDb.orgs = [{ id: 'org-1' }]
    mockDb.existingSnapshots = []
    mockDb.timeEntries = [
      { user_id: 'user-a', duration_seconds: 3600, is_billable: true },
      { user_id: 'user-a', duration_seconds: 1800, is_billable: false },
      { user_id: 'user-b', duration_seconds: 7200, is_billable: true },
    ]
    mockDb.completedTasks = []
    mockDb.deadlines = []
    mockDb.workflows = []

    const req = makeRequest(`Bearer ${mockEnv.cronSecret}`)
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data.processed).toBe(2) // 2 users

    // Check the upserted data
    const userA = (mockDb.upsertedData as Record<string, unknown>[]).find(
      (s) => s.user_id === 'user-a'
    ) as Record<string, unknown>
    expect(userA).toBeDefined()
    expect(userA.total_time_seconds).toBe(5400) // 3600 + 1800
    expect(userA.billable_time_seconds).toBe(3600) // only the billable one

    const userB = (mockDb.upsertedData as Record<string, unknown>[]).find(
      (s) => s.user_id === 'user-b'
    ) as Record<string, unknown>
    expect(userB).toBeDefined()
    expect(userB.total_time_seconds).toBe(7200)
    expect(userB.billable_time_seconds).toBe(7200)
  })

  // -- Task counting + on-time rate --

  it('should count completed tasks and compute on-time rate', async () => {
    mockDb.orgs = [{ id: 'org-1' }]
    mockDb.existingSnapshots = []
    mockDb.timeEntries = []
    mockDb.completedTasks = [
      {
        id: 'task-1',
        metadata: { assigned_to: 'user-a', status: 'completed' },
        updated_at: '2026-03-15T10:00:00Z',
      },
      {
        id: 'task-2',
        metadata: { assigned_to: 'user-a', status: 'completed' },
        updated_at: '2026-03-16T18:00:00Z',
      },
    ]
    mockDb.deadlines = [
      { id: 'task-1', deadline_at: '2026-03-16T00:00:00Z' }, // on time
      { id: 'task-2', deadline_at: '2026-03-15T00:00:00Z' }, // overdue (completed after deadline)
    ]
    mockDb.workflows = []

    const req = makeRequest(`Bearer ${mockEnv.cronSecret}`)
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data.processed).toBe(1) // 1 user (user-a)

    const snapshot = mockDb.upsertedData[0] as Record<string, unknown>
    expect(snapshot.tasks_completed).toBe(2)
    expect(snapshot.tasks_on_time).toBe(1)
    expect(snapshot.tasks_overdue).toBe(1)
  })

  it('should treat tasks without deadlines as on-time', async () => {
    mockDb.orgs = [{ id: 'org-1' }]
    mockDb.existingSnapshots = []
    mockDb.timeEntries = []
    mockDb.completedTasks = [
      {
        id: 'task-1',
        metadata: { assigned_to: 'user-a', status: 'completed' },
        updated_at: '2026-03-15T10:00:00Z',
      },
    ]
    mockDb.deadlines = [] // no deadlines at all
    mockDb.workflows = []

    const req = makeRequest(`Bearer ${mockEnv.cronSecret}`)
    const res = await GET(req)
    expect(res.status).toBe(200)

    const snapshot = mockDb.upsertedData[0] as Record<string, unknown>
    expect(snapshot.tasks_on_time).toBe(1)
    expect(snapshot.tasks_overdue).toBe(0)
  })

  // -- Workflow aggregation --

  it('should count workflow completions and failures', async () => {
    mockDb.orgs = [{ id: 'org-1' }]
    mockDb.existingSnapshots = []
    mockDb.timeEntries = [
      { user_id: 'user-a', duration_seconds: 100, is_billable: false },
    ]
    mockDb.completedTasks = []
    mockDb.deadlines = []
    mockDb.workflows = [
      {
        id: 'wf-1',
        metadata: { created_by: 'user-a', status: 'completed' },
        updated_at: '2026-03-15T10:00:00Z',
      },
      {
        id: 'wf-2',
        metadata: { assigned_to: 'user-a', status: 'failed' },
        updated_at: '2026-03-16T10:00:00Z',
      },
      {
        id: 'wf-3',
        metadata: { created_by: 'user-a', status: 'completed' },
        updated_at: '2026-03-16T12:00:00Z',
      },
    ]

    const req = makeRequest(`Bearer ${mockEnv.cronSecret}`)
    const res = await GET(req)
    expect(res.status).toBe(200)

    const snapshot = mockDb.upsertedData[0] as Record<string, unknown>
    expect(snapshot.workflows_completed).toBe(2)
    expect(snapshot.workflows_failed).toBe(1)
  })

  // -- Response structure --

  it('should include period_start and period_end in response', async () => {
    mockDb.orgs = [{ id: 'org-1' }]
    mockDb.existingSnapshots = []
    mockDb.timeEntries = [
      { user_id: 'user-a', duration_seconds: 100, is_billable: false },
    ]
    mockDb.completedTasks = []
    mockDb.deadlines = []
    mockDb.workflows = []

    const req = makeRequest(`Bearer ${mockEnv.cronSecret}`)
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data.period_start).toBeDefined()
    expect(body.data.period_end).toBeDefined()
    // Period dates should be YYYY-MM-DD format
    expect(body.data.period_start).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(body.data.period_end).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  // -- Upsert error handling --

  it('should handle upsert errors gracefully and return 0 processed', async () => {
    mockDb.orgs = [{ id: 'org-1' }]
    mockDb.existingSnapshots = []
    mockDb.timeEntries = [
      { user_id: 'user-a', duration_seconds: 100, is_billable: false },
    ]
    mockDb.completedTasks = []
    mockDb.deadlines = []
    mockDb.workflows = []
    mockDb.upsertError = { code: 'PGRST000', message: 'Insert failed' }

    const req = makeRequest(`Bearer ${mockEnv.cronSecret}`)
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data.processed).toBe(0) // upsert failed so 0 inserted
  })

  // -- Logging --

  it('should log snapshot.completed on success', async () => {
    mockDb.orgs = [{ id: 'org-1' }]
    mockDb.existingSnapshots = []
    mockDb.timeEntries = [
      { user_id: 'user-a', duration_seconds: 100, is_billable: false },
    ]
    mockDb.completedTasks = []
    mockDb.deadlines = []
    mockDb.workflows = []

    const req = makeRequest(`Bearer ${mockEnv.cronSecret}`)
    await GET(req)

    const { logger } = await import('@/lib/logger')
    expect(logger.info).toHaveBeenCalledWith(
      'api-performance',
      'snapshot.completed',
      expect.objectContaining({
        snapshots_created: expect.any(Number),
      })
    )
  })

  it('should log unauthorized attempts', async () => {
    const req = makeRequest('Bearer wrong')
    await GET(req)

    const { logger } = await import('@/lib/logger')
    expect(logger.warn).toHaveBeenCalledWith(
      'api-performance',
      'snapshot.unauthorized_trigger'
    )
  })
})
