import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { AuthContext } from '@/lib/auth/withAuth'

// ─── Mock withAuth ───────────────────────────────────────────────────────────
const mockCtx = vi.hoisted(() => ({
  current: {
    userId: 'user_111',
    clerkOrgId: 'org_abc',
    orgId: 'uuid-org-1',
    role: 'ops-admin' as const,
  } as AuthContext,
}))

vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: vi.fn(
    (handler: (req: NextRequest, ctx: AuthContext, params: Record<string, string>) => Promise<Response>) =>
      async (req: NextRequest, context: { params: Promise<Record<string, string>> }) => {
        const params = await context.params
        return handler(req, mockCtx.current, params)
      }
  ),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

// Mock step engine to prevent actual workflow advancement
vi.mock('@/lib/workflow/step-engine', () => ({
  advanceWorkflowInstance: vi.fn().mockResolvedValue({
    status: 'advanced',
    step_result: { step_name: 'next', step_type: 'emit_event', status: 'completed' },
    instance_status: 'running',
  }),
}))

import { createServerClient } from '@/lib/supabase/server'

// ─── Mock DB helper ──────────────────────────────────────────────────────────
function makeDb(...responses: { data: unknown; error: unknown }[]) {
  const queue = [...responses]
  let i = 0

  const singleFn = vi.fn().mockImplementation(() =>
    Promise.resolve(queue[i++] ?? { data: null, error: null })
  )

  const chain: Record<string, unknown> = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: singleFn,
    then: (resolve: (v: unknown) => void, reject: (r: unknown) => void) =>
      Promise.resolve(queue[i++] ?? { data: [], error: null }).then(resolve, reject),
  }

  vi.mocked(createServerClient).mockReturnValue(chain as unknown as ReturnType<typeof createServerClient>)
  return { chain, singleFn }
}

const makeReq = (url = 'http://localhost/api/tasks') =>
  new NextRequest(url, { method: 'GET' } as ConstructorParameters<typeof NextRequest>[1])

const makePostReq = (url = 'http://localhost/api/tasks/uuid-task-1/claim') =>
  new NextRequest(url, { method: 'POST' } as ConstructorParameters<typeof NextRequest>[1])

// ─── Import routes ───────────────────────────────────────────────────────────
const { GET: listTasks } = await import('@/app/api/tasks/route')
const { POST: claimTask } = await import('@/app/api/tasks/[id]/claim/route')
const { POST: completeTask } = await import('@/app/api/tasks/[id]/complete/route')

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GET /api/tasks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns task list', async () => {
    const tasks = [
      { id: 'task-1', type: 'task_queue_item', metadata: { status: 'open', step_name: 'review' } },
      { id: 'task-2', type: 'task_queue_item', metadata: { status: 'claimed', step_name: 'approve' } },
    ]
    makeDb({ data: tasks, error: null })

    const res = await listTasks(makeReq(), { params: Promise.resolve({}) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(2)
  })

  it('returns empty array when no tasks', async () => {
    makeDb({ data: [], error: null })

    const res = await listTasks(makeReq(), { params: Promise.resolve({}) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })

  it('returns 500 on DB error', async () => {
    makeDb({ data: null, error: { code: 'DB_ERR' } })

    const res = await listTasks(makeReq(), { params: Promise.resolve({}) })

    expect(res.status).toBe(500)
  })
})

describe('POST /api/tasks/[id]/claim', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCtx.current = { userId: 'user_111', clerkOrgId: 'org_abc', orgId: 'uuid-org-1', role: 'ops-admin' }
  })

  it('claims an open task — returns 200', async () => {
    const task = {
      id: 'task-1',
      metadata: {
        workflow_instance_id: 'inst-1',
        step_name: 'review_docs',
        assigned_to: null,
        claimed_at: null,
        completed_at: null,
        status: 'open',
        instructions: 'Review the documents',
      },
    }
    const updated = { ...task, metadata: { ...task.metadata, status: 'claimed', assigned_to: 'user_111' } }

    makeDb(
      { data: task, error: null },       // fetch task
      { data: updated, error: null },    // update task
      { data: null, error: null },       // event insert
    )

    const res = await claimTask(makePostReq(), { params: Promise.resolve({ id: 'task-1' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.metadata.status).toBe('claimed')
  })

  it('returns 404 when task not found', async () => {
    makeDb({ data: null, error: { code: 'PGRST116' } })

    const res = await claimTask(makePostReq(), { params: Promise.resolve({ id: 'unknown' }) })
    expect(res.status).toBe(404)
  })

  it('returns 409 when task is already claimed', async () => {
    const task = {
      id: 'task-1',
      metadata: { status: 'claimed', assigned_to: 'user_222' },
    }
    makeDb({ data: task, error: null })

    const res = await claimTask(makePostReq(), { params: Promise.resolve({ id: 'task-1' }) })

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('tasks/already-claimed')
  })

  it('returns 500 when update fails', async () => {
    const task = { id: 'task-1', metadata: { status: 'open' } }
    makeDb(
      { data: task, error: null },
      { data: null, error: { code: 'DB_ERR' } }
    )

    const res = await claimTask(makePostReq(), { params: Promise.resolve({ id: 'task-1' }) })
    expect(res.status).toBe(500)
  })
})

describe('POST /api/tasks/[id]/complete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCtx.current = { userId: 'user_111', clerkOrgId: 'org_abc', orgId: 'uuid-org-1', role: 'ops-admin' }
  })

  it('completes a claimed task — returns 200', async () => {
    const task = {
      id: 'task-1',
      metadata: {
        workflow_instance_id: 'inst-1',
        step_name: 'review_docs',
        assigned_to: 'user_111',
        claimed_at: '2026-01-01',
        completed_at: null,
        status: 'claimed',
        instructions: 'Review',
      },
    }
    const updated = { ...task, metadata: { ...task.metadata, status: 'completed' } }

    makeDb(
      { data: task, error: null },       // fetch task
      { data: updated, error: null },    // update task
      { data: null, error: null },       // event insert
    )

    const res = await completeTask(
      makePostReq('http://localhost/api/tasks/task-1/complete'),
      { params: Promise.resolve({ id: 'task-1' }) }
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.metadata.status).toBe('completed')
  })

  it('returns 404 when task not found', async () => {
    makeDb({ data: null, error: { code: 'PGRST116' } })

    const res = await completeTask(makePostReq(), { params: Promise.resolve({ id: 'unknown' }) })
    expect(res.status).toBe(404)
  })

  it('returns 409 when task is already completed', async () => {
    const task = { id: 'task-1', metadata: { status: 'completed' } }
    makeDb({ data: task, error: null })

    const res = await completeTask(makePostReq(), { params: Promise.resolve({ id: 'task-1' }) })

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('tasks/already-completed')
  })

  it('returns 422 when task is still open (not claimed)', async () => {
    const task = { id: 'task-1', metadata: { status: 'open' } }
    makeDb({ data: task, error: null })

    const res = await completeTask(makePostReq(), { params: Promise.resolve({ id: 'task-1' }) })

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('tasks/not-claimed')
  })

  it('returns 403 when non-admin user is not the assigned user', async () => {
    mockCtx.current = { userId: 'user_333', clerkOrgId: 'org_abc', orgId: 'uuid-org-1', role: 'ops-user' }
    const task = {
      id: 'task-1',
      metadata: { status: 'claimed', assigned_to: 'user_111', workflow_instance_id: 'inst-1', step_name: 'review' },
    }
    makeDb({ data: task, error: null })

    const res = await completeTask(makePostReq(), { params: Promise.resolve({ id: 'task-1' }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('tasks/not-assigned')
  })

  it('allows ops-admin to complete tasks assigned to others', async () => {
    mockCtx.current = { userId: 'admin_999', clerkOrgId: 'org_abc', orgId: 'uuid-org-1', role: 'ops-admin' }
    const task = {
      id: 'task-1',
      metadata: {
        status: 'claimed',
        assigned_to: 'user_111',
        workflow_instance_id: 'inst-1',
        step_name: 'review',
        instructions: 'test',
        claimed_at: '2026-01-01',
        completed_at: null,
      },
    }
    const updated = { ...task, metadata: { ...task.metadata, status: 'completed' } }

    makeDb(
      { data: task, error: null },
      { data: updated, error: null },
      { data: null, error: null },
    )

    const res = await completeTask(makePostReq(), { params: Promise.resolve({ id: 'task-1' }) })
    expect(res.status).toBe(200)
  })

  it('returns 500 when update fails', async () => {
    const task = {
      id: 'task-1',
      metadata: { status: 'claimed', assigned_to: 'user_111', workflow_instance_id: 'inst-1', step_name: 'review' },
    }
    makeDb(
      { data: task, error: null },
      { data: null, error: { code: 'DB_ERR' } }
    )

    const res = await completeTask(makePostReq(), { params: Promise.resolve({ id: 'task-1' }) })
    expect(res.status).toBe(500)
  })
})
