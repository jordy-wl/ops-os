import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { AuthContext } from '@/lib/auth/withAuth'

// ─── Mock withAuth + permission context ─────────────────────────────────────
const ALL_PERMS = new Set(['manage_blocks', 'edit_blocks', 'view_blocks', 'manage_workflows', 'execute_workflows', 'approve_tasks', 'manage_team', 'manage_settings', 'manage_integrations', 'view_audit_log'])
const APPROVER_PERMS = new Set(['view_blocks', 'approve_tasks', 'view_audit_log'])

const mockAuth = vi.hoisted(() => ({
  role: 'ops-admin' as string,
  permissions: null as unknown as Set<string>,
}))

vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: vi.fn(
    (handler: (req: NextRequest, ctx: AuthContext, params: Record<string, string>) => Promise<Response>) =>
      async (req: NextRequest, context: { params: Promise<Record<string, string>> }) => {
        const params = await context.params
        return handler(
          req,
          { userId: 'user_111', clerkOrgId: 'org_abc', orgId: 'uuid-org-1', role: mockAuth.role as AuthContext['role'], roleId: 'role-uuid', permissions: mockAuth.permissions },
          params
        )
      }
  ),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
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

const makeReq = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/blocks/uuid-block-1/run-workflow', {
    method: 'POST',
    body: JSON.stringify(body),
  } as ConstructorParameters<typeof NextRequest>[1])

// ─── Import after mocks ─────────────────────────────────────────────────────
const { POST } = await import('@/app/api/blocks/[id]/run-workflow/route')

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/blocks/[id]/run-workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.role = 'ops-admin'
    mockAuth.permissions = ALL_PERMS
  })

  it('spawns workflow instance — returns 201', async () => {
    const block = { id: 'uuid-block-1', type: 'client', name: 'Acme Corp' }
    const template = {
      id: 'uuid-tmpl-1',
      name: 'Onboarding Flow',
      metadata: {
        applies_to_type: 'client',
        trigger: { type: 'manual' },
        steps: [{ name: 'notify', type: 'emit_event', event_type: 'started' }],
      },
    }
    const instance = {
      id: 'uuid-inst-1',
      type: 'workflow_instance',
      name: 'Onboarding Flow — Acme Corp',
      metadata: { template_id: 'uuid-tmpl-1', source_block_id: 'uuid-block-1', status: 'pending' },
    }
    const event = { id: 'uuid-event-1', type: 'workflow.instance.spawned' }

    makeDb(
      { data: block, error: null },         // block lookup
      { data: template, error: null },       // template lookup
      { data: instance, error: null },       // instance insert
      { data: null, error: null },           // block_edges insert
      { data: event, error: null },          // event insert
    )

    const res = await POST(makeReq({ template_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }), {
      params: Promise.resolve({ id: 'uuid-block-1' }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.instance.id).toBe('uuid-inst-1')
    expect(body.data.event.type).toBe('workflow.instance.spawned')
  })

  it('returns 400 on invalid JSON body', async () => {
    makeDb()
    const req = new NextRequest('http://localhost/api/blocks/uuid-block-1/run-workflow', {
      method: 'POST',
      body: 'not json',
    } as ConstructorParameters<typeof NextRequest>[1])

    const res = await POST(req, { params: Promise.resolve({ id: 'uuid-block-1' }) })
    expect(res.status).toBe(400)
  })

  it('returns 400 on missing template_id', async () => {
    makeDb()
    const res = await POST(makeReq({}), { params: Promise.resolve({ id: 'uuid-block-1' }) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('validation/invalid-input')
  })

  it('returns 404 when block not found', async () => {
    makeDb({ data: null, error: { code: 'PGRST116' } })

    const res = await POST(makeReq({ template_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }), {
      params: Promise.resolve({ id: 'uuid-block-1' }),
    })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('blocks/not-found')
  })

  it('returns 404 when template not found', async () => {
    const block = { id: 'uuid-block-1', type: 'client', name: 'Acme' }
    makeDb(
      { data: block, error: null },
      { data: null, error: { code: 'PGRST116' } }
    )

    const res = await POST(makeReq({ template_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }), {
      params: Promise.resolve({ id: 'uuid-block-1' }),
    })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('workflow/template-not-found')
  })

  it('returns 422 when template type does not match block type', async () => {
    const block = { id: 'uuid-block-1', type: 'deal', name: 'Deal A' }
    const template = {
      id: 'uuid-tmpl-1',
      name: 'Client Flow',
      metadata: {
        applies_to_type: 'client',
        trigger: { type: 'manual' },
        steps: [{ name: 'step', type: 'emit_event', event_type: 'test' }],
      },
    }
    makeDb(
      { data: block, error: null },
      { data: template, error: null }
    )

    const res = await POST(makeReq({ template_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }), {
      params: Promise.resolve({ id: 'uuid-block-1' }),
    })

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('workflow/type-mismatch')
  })

  it('returns 500 when instance insert fails', async () => {
    const block = { id: 'uuid-block-1', type: 'client', name: 'Acme' }
    const template = {
      id: 'uuid-tmpl-1',
      name: 'Flow',
      metadata: {
        applies_to_type: 'client',
        trigger: { type: 'manual' },
        steps: [{ name: 'step', type: 'emit_event', event_type: 'test' }],
      },
    }
    makeDb(
      { data: block, error: null },
      { data: template, error: null },
      { data: null, error: { code: 'DB_ERR' } }
    )

    const res = await POST(makeReq({ template_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }), {
      params: Promise.resolve({ id: 'uuid-block-1' }),
    })

    expect(res.status).toBe(500)
  })

  it('returns 403 for compliance-approver (lacks execute_workflows)', async () => {
    mockAuth.role = 'compliance-approver'
    mockAuth.permissions = APPROVER_PERMS
    makeDb()

    const res = await POST(makeReq({ template_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }), {
      params: Promise.resolve({ id: 'uuid-block-1' }),
    })

    expect(res.status).toBe(403)
  })
})
