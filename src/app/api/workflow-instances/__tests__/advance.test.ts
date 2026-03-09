import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { AuthContext } from '@/lib/auth/withAuth'

// ─── Mock withAuth — bypass auth, inject context ─────────────────────────────
vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: vi.fn(
    (handler: (req: NextRequest, ctx: AuthContext, params: Record<string, string>) => Promise<Response>) =>
      async (req: NextRequest, context: { params: Promise<Record<string, string>> }) => {
        const params = await context.params
        return handler(
          req,
          { userId: 'user_111', clerkOrgId: 'org_abc', orgId: 'uuid-org-1', role: 'ops-admin' as const },
          params
        )
      }
  ),
}))

// ─── Mock step engine ────────────────────────────────────────────────────────
const mockAdvance = vi.hoisted(() =>
  vi.fn<(instanceId: string, orgId: string) => Promise<{ status: string; step_result: Record<string, unknown>; instance_status: string }>>()
)

vi.mock('@/lib/workflow/step-engine', () => ({
  advanceWorkflowInstance: mockAdvance,
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

// ─── Import after mocks ─────────────────────────────────────────────────────
const { POST } = await import('@/app/api/workflow-instances/[id]/advance/route')

const makeReq = (url = 'http://localhost/api/workflow-instances/uuid-inst-1/advance') =>
  new NextRequest(url, { method: 'POST' } as ConstructorParameters<typeof NextRequest>[1])

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/workflow-instances/[id]/advance', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with advance result on success', async () => {
    mockAdvance.mockResolvedValue({
      status: 'advanced',
      step_result: { step_name: 'emit_start', step_type: 'emit_event', status: 'completed' },
      instance_status: 'running',
    })

    const res = await POST(makeReq(), {
      params: Promise.resolve({ id: '12345678-1234-1234-1234-123456789abc' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe('advanced')
    expect(body.data.step_result.step_name).toBe('emit_start')
    expect(body.data.instance_status).toBe('running')
    expect(body.error).toBeNull()
  })

  it('returns 200 with completed status when instance finishes', async () => {
    mockAdvance.mockResolvedValue({
      status: 'completed',
      step_result: { step_name: 'final_step', step_type: 'condition', status: 'completed' },
      instance_status: 'done',
    })

    const res = await POST(makeReq(), {
      params: Promise.resolve({ id: '12345678-1234-1234-1234-123456789abc' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe('completed')
    expect(body.data.instance_status).toBe('done')
  })

  it('returns 400 for invalid instance ID', async () => {
    const res = await POST(makeReq(), {
      params: Promise.resolve({ id: 'not-a-uuid' }),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('validation/invalid-id')
  })

  it('returns 404 when instance is not found', async () => {
    mockAdvance.mockRejectedValue(new Error('Instance not found: uuid-inst-1'))

    const res = await POST(makeReq(), {
      params: Promise.resolve({ id: '12345678-1234-1234-1234-123456789abc' }),
    })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('workflow/not-found')
  })

  it('returns 404 when template is not found', async () => {
    mockAdvance.mockRejectedValue(new Error('Template not found: uuid-tmpl-1'))

    const res = await POST(makeReq(), {
      params: Promise.resolve({ id: '12345678-1234-1234-1234-123456789abc' }),
    })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('workflow/not-found')
  })

  it('returns 409 when instance is already done', async () => {
    mockAdvance.mockRejectedValue(new Error('Instance uuid-inst-1 is already done'))

    const res = await POST(makeReq(), {
      params: Promise.resolve({ id: '12345678-1234-1234-1234-123456789abc' }),
    })

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('workflow/already-terminal')
  })

  it('returns 422 when step index is out of bounds', async () => {
    mockAdvance.mockRejectedValue(new Error('Step index 5 out of bounds (3 steps)'))

    const res = await POST(makeReq(), {
      params: Promise.resolve({ id: '12345678-1234-1234-1234-123456789abc' }),
    })

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('workflow/step-out-of-bounds')
  })

  it('returns 500 on unexpected errors', async () => {
    mockAdvance.mockRejectedValue(new Error('Database connection lost'))

    const res = await POST(makeReq(), {
      params: Promise.resolve({ id: '12345678-1234-1234-1234-123456789abc' }),
    })

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('workflow/advance-failed')
  })
})
