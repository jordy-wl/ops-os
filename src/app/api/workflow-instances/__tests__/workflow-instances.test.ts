import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { AuthContext, UserRole } from '@/lib/auth/withAuth'

// Configurable mock context
const ALL_PERMS = new Set(['manage_blocks', 'edit_blocks', 'view_blocks', 'manage_workflows', 'execute_workflows', 'approve_tasks', 'manage_team', 'manage_settings', 'manage_integrations', 'view_audit_log'])

const mockCtx = vi.hoisted(() => ({
  role: 'ops-admin' as UserRole,
  permissions: null as unknown as Set<string>,
}))

vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: vi.fn(
    (handler: (req: NextRequest, ctx: AuthContext, params: Record<string, string>) => Promise<Response>) =>
      async (req: NextRequest, context: { params: Promise<Record<string, string>> }) => {
        const params = await context.params
        return handler(
          req,
          { userId: 'user_111', clerkOrgId: 'org_abc', orgId: 'uuid-org-1', role: mockCtx.role, roleId: 'role-uuid', permissions: mockCtx.permissions },
          params
        )
      }
  ),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

import { createServerClient } from '@/lib/supabase/server'

// ─── Mock DB helper ──────────────────────────────────────────────────────────
function makeDb(...responses: { data: unknown; error: unknown }[]) {
  const queue = [...responses]
  let i = 0

  const next = () => {
    const resp = queue[i++] ?? { data: null, error: null }
    return Promise.resolve(resp)
  }

  const chain: Record<string, unknown> = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(next),
    then: (resolve: (v: unknown) => void, reject: (r: unknown) => void) =>
      next().then(resolve, reject),
  }

  vi.mocked(createServerClient).mockReturnValue(chain as unknown as ReturnType<typeof createServerClient>)
  return chain
}

const makeReq = (url = 'http://localhost/api/workflow-instances', opts?: RequestInit) =>
  new NextRequest(url, opts as ConstructorParameters<typeof NextRequest>[1])

// ─── Import routes after mocks ───────────────────────────────────────────────
const { GET: listInstances, POST: spawnInstance } = await import('@/app/api/workflow-instances/route')
const { GET: getInstance } = await import('@/app/api/workflow-instances/[id]/route')

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GET /api/workflow-instances', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCtx.role = 'ops-admin'
    mockCtx.permissions = ALL_PERMS
  })

  it('returns workflow instances for org', async () => {
    const instances = [
      { id: 'inst-1', type: 'workflow_instance', metadata: { status: 'running' } },
      { id: 'inst-2', type: 'workflow_instance', metadata: { status: 'done' } },
    ]
    makeDb({ data: instances, error: null })

    const res = await listInstances(makeReq(), { params: Promise.resolve({}) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(2)
  })

  it('filters by status', async () => {
    const instances = [{ id: 'inst-1', metadata: { status: 'running' } }]
    const db = makeDb({ data: instances, error: null })

    const res = await listInstances(
      makeReq('http://localhost/api/workflow-instances?status=running'),
      { params: Promise.resolve({}) }
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(db.eq).toHaveBeenCalledWith('metadata->>status', 'running')
  })

  it('filters by template_id', async () => {
    const db = makeDb({ data: [], error: null })

    await listInstances(
      makeReq('http://localhost/api/workflow-instances?template_id=tmpl-1'),
      { params: Promise.resolve({}) }
    )

    expect(db.eq).toHaveBeenCalledWith('metadata->>template_id', 'tmpl-1')
  })

  it('returns 500 on db error', async () => {
    makeDb({ data: null, error: { code: 'DB_ERR' } })

    const res = await listInstances(makeReq(), { params: Promise.resolve({}) })
    expect(res.status).toBe(500)
  })
})

describe('POST /api/workflow-instances', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCtx.role = 'ops-admin'
    mockCtx.permissions = ALL_PERMS
  })

  const validBody = {
    template_id: '00000000-0000-0000-0000-000000000001',
    source_block_id: '00000000-0000-0000-0000-000000000002',
  }

  it('spawns instance from template (201)', async () => {
    const template = {
      id: validBody.template_id,
      name: 'Onboarding',
      type: 'workflow_template',
      metadata: { applies_to_type: 'client', trigger: { type: 'manual' }, steps: [{ name: 'step_one', type: 'emit_event' }] },
    }
    const sourceBlock = { id: validBody.source_block_id, name: 'Acme Corp', type: 'client' }
    const instance = {
      id: 'inst-new',
      type: 'workflow_instance',
      name: 'Onboarding → Acme Corp',
      metadata: { template_id: template.id, status: 'pending' },
    }
    const event = { id: 'evt-1', type: 'workflow.instance.spawned' }

    // Responses: 1) template lookup, 2) source lookup, 3) insert instance, 4) insert edges, 5) insert event
    makeDb(
      { data: template, error: null },
      { data: sourceBlock, error: null },
      { data: instance, error: null },
      { data: null, error: null },
      { data: event, error: null }
    )

    const res = await spawnInstance(
      makeReq('http://localhost/api/workflow-instances', {
        method: 'POST',
        body: JSON.stringify(validBody),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: Promise.resolve({}) }
    )
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.data.instance.name).toBe('Onboarding → Acme Corp')
    expect(json.data.event.type).toBe('workflow.instance.spawned')
  })

  it('returns 404 when template not found', async () => {
    makeDb({ data: null, error: { code: 'PGRST116' } })

    const res = await spawnInstance(
      makeReq('http://localhost/api/workflow-instances', {
        method: 'POST',
        body: JSON.stringify(validBody),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: Promise.resolve({}) }
    )

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('workflow/template-not-found')
  })

  it('returns 404 when source block not found', async () => {
    const template = {
      id: validBody.template_id,
      name: 'Onboarding',
      type: 'workflow_template',
      metadata: { applies_to_type: 'client' },
    }
    makeDb(
      { data: template, error: null },
      { data: null, error: { code: 'PGRST116' } }
    )

    const res = await spawnInstance(
      makeReq('http://localhost/api/workflow-instances', {
        method: 'POST',
        body: JSON.stringify(validBody),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: Promise.resolve({}) }
    )

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('workflow/source-block-not-found')
  })

  it('returns 400 for invalid body (missing template_id)', async () => {
    const res = await spawnInstance(
      makeReq('http://localhost/api/workflow-instances', {
        method: 'POST',
        body: JSON.stringify({ source_block_id: '00000000-0000-0000-0000-000000000002' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: Promise.resolve({}) }
    )

    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid UUID format', async () => {
    const res = await spawnInstance(
      makeReq('http://localhost/api/workflow-instances', {
        method: 'POST',
        body: JSON.stringify({ template_id: 'not-a-uuid', source_block_id: 'also-not-uuid' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: Promise.resolve({}) }
    )

    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    const res = await spawnInstance(
      makeReq('http://localhost/api/workflow-instances', {
        method: 'POST',
        body: 'not json',
        headers: { 'Content-Type': 'text/plain' },
      }),
      { params: Promise.resolve({}) }
    )

    expect(res.status).toBe(400)
  })

  it('returns 500 when instance insert fails', async () => {
    const template = {
      id: validBody.template_id,
      name: 'Onboarding',
      type: 'workflow_template',
      metadata: { applies_to_type: 'client' },
    }
    const sourceBlock = { id: validBody.source_block_id, name: 'Acme Corp', type: 'client' }

    makeDb(
      { data: template, error: null },
      { data: sourceBlock, error: null },
      { data: null, error: { code: 'DB_ERR' } }
    )

    const res = await spawnInstance(
      makeReq('http://localhost/api/workflow-instances', {
        method: 'POST',
        body: JSON.stringify(validBody),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: Promise.resolve({}) }
    )

    expect(res.status).toBe(500)
  })
})

describe('GET /api/workflow-instances/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCtx.role = 'ops-admin'
    mockCtx.permissions = ALL_PERMS
  })

  it('returns a single instance', async () => {
    const instance = { id: 'inst-1', type: 'workflow_instance', metadata: { status: 'running' } }
    makeDb({ data: instance, error: null })

    const res = await getInstance(
      makeReq('http://localhost/api/workflow-instances/inst-1'),
      { params: Promise.resolve({ id: 'inst-1' }) }
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.id).toBe('inst-1')
  })

  it('returns 404 when not found', async () => {
    makeDb({ data: null, error: { code: 'PGRST116' } })

    const res = await getInstance(
      makeReq('http://localhost/api/workflow-instances/nonexistent'),
      { params: Promise.resolve({ id: 'nonexistent' }) }
    )

    expect(res.status).toBe(404)
  })

  it('returns 500 on db error', async () => {
    makeDb({ data: null, error: { code: 'DB_ERR' } })

    const res = await getInstance(
      makeReq('http://localhost/api/workflow-instances/inst-1'),
      { params: Promise.resolve({ id: 'inst-1' }) }
    )

    expect(res.status).toBe(500)
  })
})
