import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { AuthContext } from '@/lib/auth/withAuth'

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
    delete: vi.fn().mockReturnThis(),
    single: singleFn,
    rpc: vi.fn().mockImplementation(() => Promise.resolve(queue[i++] ?? { data: null, error: null })),
    then: (resolve: (v: unknown) => void, reject: (r: unknown) => void) =>
      Promise.resolve(queue[i++] ?? { data: [], error: null }).then(resolve, reject),
  }

  vi.mocked(createServerClient).mockReturnValue(chain as unknown as ReturnType<typeof createServerClient>)
  return { chain, singleFn }
}

const makeReq = (url = 'http://localhost/api/integrations', opts?: RequestInit) =>
  new NextRequest(url, opts as ConstructorParameters<typeof NextRequest>[1])

// ─── Import routes after mocks ─────────────────────────────────────────────────
const { GET: listIntegrations, POST: createIntegration } = await import('@/app/api/integrations/route')
const { GET: getIntegration, PATCH: updateIntegration, DELETE: deleteIntegration } = await import('@/app/api/integrations/[id]/route')

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/integrations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns connector list for org', async () => {
    const connectors = [
      { id: 'conn-1', name: 'Salesforce Sync', provider: 'salesforce', status: 'active' },
      { id: 'conn-2', name: 'Webhook In', provider: 'webhook', status: 'active' },
    ]
    makeDb({ data: connectors, error: null })

    const res = await listIntegrations(makeReq(), { params: Promise.resolve({}) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(2)
  })

  it('returns 500 on DB error', async () => {
    makeDb({ data: null, error: { code: 'DB_ERR' } })

    const res = await listIntegrations(makeReq(), { params: Promise.resolve({}) })
    expect(res.status).toBe(500)
  })
})

describe('POST /api/integrations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates inbound webhook connector — returns 201 with webhook_url', async () => {
    const connector = {
      id: 'conn-1',
      org_id: 'uuid-org-1',
      name: 'CRM Webhook',
      provider: 'webhook',
      direction: 'inbound',
      config: {},
      status: 'active',
      webhook_secret: 'secret-uuid',
    }
    makeDb({ data: connector, error: null })

    const req = makeReq('http://localhost/api/integrations', {
      method: 'POST',
      body: JSON.stringify({ name: 'CRM Webhook', provider: 'webhook', direction: 'inbound' }),
    })
    const res = await createIntegration(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.name).toBe('CRM Webhook')
    expect(body.data.webhook_url).toBe('/api/webhooks/integration/conn-1')
    expect(body.data.webhook_secret).toBeUndefined()
  })

  it('creates outbound connector without webhook_url', async () => {
    const connector = {
      id: 'conn-2',
      org_id: 'uuid-org-1',
      name: 'Xero API',
      provider: 'custom_api',
      direction: 'outbound',
      config: { base_url: 'https://api.xero.com' },
      status: 'active',
    }
    makeDb({ data: connector, error: null })

    const req = makeReq('http://localhost/api/integrations', {
      method: 'POST',
      body: JSON.stringify({ name: 'Xero API', provider: 'custom_api', direction: 'outbound', config: { base_url: 'https://api.xero.com' } }),
    })
    const res = await createIntegration(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.webhook_url).toBeUndefined()
  })

  it('returns 400 when config contains secrets', async () => {
    makeDb()
    const req = makeReq('http://localhost/api/integrations', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bad', provider: 'webhook', config: { api_key: 'sk-1234' } }),
    })
    const res = await createIntegration(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('validation/secrets-in-config')
  })

  it('returns 400 on invalid provider', async () => {
    makeDb()
    const req = makeReq('http://localhost/api/integrations', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bad', provider: 'foobar' }),
    })
    const res = await createIntegration(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(400)
  })

  it('returns 400 on missing name', async () => {
    makeDb()
    const req = makeReq('http://localhost/api/integrations', {
      method: 'POST',
      body: JSON.stringify({ provider: 'webhook' }),
    })
    const res = await createIntegration(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(400)
  })

  it('returns 500 on DB insert failure', async () => {
    makeDb({ data: null, error: { code: 'DB_ERR' } })

    const req = makeReq('http://localhost/api/integrations', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', provider: 'webhook' }),
    })
    const res = await createIntegration(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(500)
  })
})

describe('GET /api/integrations/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns connector with webhook_url for inbound', async () => {
    const connector = {
      id: 'conn-1',
      name: 'Webhook In',
      direction: 'inbound',
      webhook_secret: 'should-not-appear',
    }
    makeDb({ data: connector, error: null })

    const res = await getIntegration(
      makeReq('http://localhost/api/integrations/conn-1'),
      { params: Promise.resolve({ id: 'conn-1' }) }
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.webhook_url).toBe('/api/webhooks/integration/conn-1')
    expect(body.data.webhook_secret).toBeUndefined()
  })

  it('returns 404 for unknown connector', async () => {
    makeDb({ data: null, error: { code: 'PGRST116' } })

    const res = await getIntegration(
      makeReq('http://localhost/api/integrations/unknown'),
      { params: Promise.resolve({ id: 'unknown' }) }
    )

    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/integrations/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates connector name and status', async () => {
    const updated = { id: 'conn-1', name: 'Updated Name', status: 'paused' }
    makeDb({ data: updated, error: null })

    const req = makeReq('http://localhost/api/integrations/conn-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated Name', status: 'paused' }),
    })
    const res = await updateIntegration(req, { params: Promise.resolve({ id: 'conn-1' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.name).toBe('Updated Name')
  })

  it('returns 400 when config contains secrets', async () => {
    makeDb()
    const req = makeReq('http://localhost/api/integrations/conn-1', {
      method: 'PATCH',
      body: JSON.stringify({ config: { password: 'hunter2' } }),
    })
    const res = await updateIntegration(req, { params: Promise.resolve({ id: 'conn-1' }) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('validation/secrets-in-config')
  })

  it('returns 400 on empty body', async () => {
    makeDb()
    const req = makeReq('http://localhost/api/integrations/conn-1', {
      method: 'PATCH',
      body: JSON.stringify({}),
    })
    const res = await updateIntegration(req, { params: Promise.resolve({ id: 'conn-1' }) })

    expect(res.status).toBe(400)
  })

  it('returns 404 for unknown/archived connector', async () => {
    makeDb({ data: null, error: { code: 'PGRST116' } })

    const req = makeReq('http://localhost/api/integrations/unknown', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'X' }),
    })
    const res = await updateIntegration(req, { params: Promise.resolve({ id: 'unknown' }) })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/integrations/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('soft-deletes connector — sets status to archived', async () => {
    makeDb({ data: { id: 'conn-1' }, error: null })

    const req = makeReq('http://localhost/api/integrations/conn-1', { method: 'DELETE' })
    const res = await deleteIntegration(req, { params: Promise.resolve({ id: 'conn-1' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe('archived')
  })

  it('returns 404 for unknown connector', async () => {
    makeDb({ data: null, error: { code: 'PGRST116' } })

    const req = makeReq('http://localhost/api/integrations/unknown', { method: 'DELETE' })
    const res = await deleteIntegration(req, { params: Promise.resolve({ id: 'unknown' }) })

    expect(res.status).toBe(404)
  })
})
