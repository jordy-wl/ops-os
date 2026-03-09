import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { AuthContext } from '@/lib/auth/withAuth'

// Bypass withAuth — its own tests cover auth logic
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

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

import { createServerClient } from '@/lib/supabase/server'

// ─── Mock DB helper ────────────────────────────────────────────────────────────
function makeDb(...responses: { data: unknown; error: unknown }[]) {
  const queue = [...responses]
  let i = 0

  const singleFn = vi.fn().mockImplementation(() => Promise.resolve(queue[i++] ?? { data: null, error: null }))

  const rpcFn = vi.fn().mockImplementation(() => Promise.resolve(queue[i++] ?? { data: null, error: null }))

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
    lt: vi.fn().mockReturnThis(),
    single: singleFn,
    rpc: rpcFn,
    then: (resolve: (v: unknown) => void, reject: (r: unknown) => void) =>
      Promise.resolve(queue[i++] ?? { data: [], error: null }).then(resolve, reject),
  }

  vi.mocked(createServerClient).mockReturnValue(chain as unknown as ReturnType<typeof createServerClient>)
  return { chain, singleFn }
}

const makeReq = (url = 'http://localhost/api/workflow-templates', opts?: RequestInit) =>
  new NextRequest(url, opts as ConstructorParameters<typeof NextRequest>[1])

// ─── Import routes after mocks ─────────────────────────────────────────────────
const { GET: listTemplates } = await import('@/app/api/workflow-templates/route')
const { POST: createBlock } = await import('@/app/api/blocks/route')

// ─── Valid template metadata ────────────────────────────────────────────────────
const VALID_TEMPLATE = {
  applies_to_type: 'client',
  trigger: { type: 'event', event_pattern: 'block.created' },
  steps: [
    { name: 'request_docs', type: 'emit_event', event_type: 'document.requested' },
    { name: 'kyc_check', type: 'emit_event', event_type: 'kyc.check.started' },
  ],
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('GET /api/workflow-templates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns all workflow_template blocks for org', async () => {
    const templates = [
      { id: 'tmpl-1', type: 'workflow_template', name: 'Client Onboarding', metadata: VALID_TEMPLATE },
      { id: 'tmpl-2', type: 'workflow_template', name: 'Deal Pipeline', metadata: { ...VALID_TEMPLATE, applies_to_type: 'deal' } },
    ]
    makeDb({ data: templates, error: null })

    const res = await listTemplates(makeReq(), { params: Promise.resolve({}) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(2)
  })

  it('filters by applies_to_type when query param provided', async () => {
    const templates = [
      { id: 'tmpl-1', type: 'workflow_template', name: 'Client Onboarding', metadata: VALID_TEMPLATE },
    ]
    const { chain } = makeDb({ data: templates, error: null })

    const res = await listTemplates(
      makeReq('http://localhost/api/workflow-templates?applies_to_type=client'),
      { params: Promise.resolve({}) }
    )

    expect(res.status).toBe(200)
    expect(chain.eq).toHaveBeenCalledWith('metadata->>applies_to_type', 'client')
  })

  it('returns 500 on DB error', async () => {
    makeDb({ data: null, error: { code: 'DB_ERR' } })

    const res = await listTemplates(makeReq(), { params: Promise.resolve({}) })
    expect(res.status).toBe(500)
  })
})

describe('POST /api/blocks — workflow_template validation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates workflow_template with valid metadata — returns 201', async () => {
    const block = { id: 'tmpl-1', org_id: 'uuid-org-1', type: 'workflow_template', name: 'Client Onboarding', metadata: VALID_TEMPLATE }
    const event = { id: 'ev-1', type: 'block.created' }
    makeDb({ data: { block, event }, error: null })

    const req = makeReq('http://localhost/api/blocks', {
      method: 'POST',
      body: JSON.stringify({ type: 'workflow_template', name: 'Client Onboarding', metadata: VALID_TEMPLATE }),
    })
    const res = await createBlock(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.block.type).toBe('workflow_template')
  })

  it('returns 400 when workflow_template metadata missing applies_to_type', async () => {
    makeDb()
    const badMeta = { trigger: { type: 'manual' }, steps: [{ name: 'step_one', type: 'emit_event' }] }

    const req = makeReq('http://localhost/api/blocks', {
      method: 'POST',
      body: JSON.stringify({ type: 'workflow_template', name: 'Bad Template', metadata: badMeta }),
    })
    const res = await createBlock(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('validation/invalid-input')
  })

  it('returns 400 when workflow_template has no steps', async () => {
    makeDb()
    const noSteps = { applies_to_type: 'client', trigger: { type: 'manual' }, steps: [] }

    const req = makeReq('http://localhost/api/blocks', {
      method: 'POST',
      body: JSON.stringify({ type: 'workflow_template', name: 'Empty Steps', metadata: noSteps }),
    })
    const res = await createBlock(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(400)
  })

  it('returns 400 when workflow_template trigger is event but missing event_pattern', async () => {
    makeDb()
    const badTrigger = {
      applies_to_type: 'client',
      trigger: { type: 'event' },
      steps: [{ name: 'step_one', type: 'emit_event', event_type: 'foo' }],
    }

    const req = makeReq('http://localhost/api/blocks', {
      method: 'POST',
      body: JSON.stringify({ type: 'workflow_template', name: 'Bad Trigger', metadata: badTrigger }),
    })
    const res = await createBlock(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(400)
  })

  it('returns 400 when step name is not snake_case', async () => {
    makeDb()
    const badStep = {
      applies_to_type: 'client',
      trigger: { type: 'manual' },
      steps: [{ name: 'Bad Step Name!', type: 'emit_event' }],
    }

    const req = makeReq('http://localhost/api/blocks', {
      method: 'POST',
      body: JSON.stringify({ type: 'workflow_template', name: 'Invalid Step', metadata: badStep }),
    })
    const res = await createBlock(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(400)
  })

  it('allows non-template blocks without template validation', async () => {
    const block = { id: 'block-1', type: 'client', name: 'Acme Corp', metadata: {} }
    const event = { id: 'ev-1', type: 'block.created' }
    makeDb({ data: { block, event }, error: null })

    const req = makeReq('http://localhost/api/blocks', {
      method: 'POST',
      body: JSON.stringify({ type: 'client', name: 'Acme Corp' }),
    })
    const res = await createBlock(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(201)
  })
})
