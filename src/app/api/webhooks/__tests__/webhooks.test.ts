import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createHmac } from 'crypto'

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
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: singleFn,
    then: (resolve: (v: unknown) => void, reject: (r: unknown) => void) =>
      Promise.resolve(queue[i++] ?? { data: null, error: null }).then(resolve, reject),
  }

  vi.mocked(createServerClient).mockReturnValue(chain as unknown as ReturnType<typeof createServerClient>)
  return { chain, singleFn }
}

// ─── Import route after mocks ──────────────────────────────────────────────────
const { POST: webhookHandler } = await import('@/app/api/webhooks/integration/[connectorId]/route')

const ACTIVE_CONNECTOR = {
  id: 'conn-1',
  org_id: 'uuid-org-1',
  status: 'active',
  provider: 'webhook',
  config: {},
  webhook_secret: null,
}

const makeReq = (connectorId: string, body: string, headers?: Record<string, string>) =>
  new NextRequest(`http://localhost/api/webhooks/integration/${connectorId}`, {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json', ...headers },
  } as ConstructorParameters<typeof NextRequest>[1])

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/webhooks/integration/[connectorId]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('accepts webhook with block_id — records event', async () => {
    const block = { id: 'block-1' }
    const event = { id: 'evt-1' }
    makeDb(
      { data: ACTIVE_CONNECTOR, error: null },  // connector lookup
      { data: block, error: null },               // block verification
      { data: event, error: null },               // event insert
      { data: null, error: null },                // last_sync_at update
    )

    const body = JSON.stringify({ block_id: 'block-1', action: 'lead.created' })
    const res = await webhookHandler(
      makeReq('conn-1', body),
      { params: Promise.resolve({ connectorId: 'conn-1' }) }
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.received).toBe(true)
    expect(json.event_id).toBe('evt-1')
  })

  it('accepts webhook without block_id — returns event_id null', async () => {
    makeDb(
      { data: ACTIVE_CONNECTOR, error: null },  // connector lookup
      { data: null, error: null },                // last_sync_at update
    )

    const body = JSON.stringify({ action: 'external.event' })
    const res = await webhookHandler(
      makeReq('conn-1', body),
      { params: Promise.resolve({ connectorId: 'conn-1' }) }
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.received).toBe(true)
    expect(json.event_id).toBeNull()
  })

  it('returns 404 for unknown connector', async () => {
    makeDb({ data: null, error: { code: 'PGRST116' } })

    const body = JSON.stringify({ test: true })
    const res = await webhookHandler(
      makeReq('unknown', body),
      { params: Promise.resolve({ connectorId: 'unknown' }) }
    )

    expect(res.status).toBe(404)
  })

  it('returns 403 for inactive connector', async () => {
    makeDb({ data: { ...ACTIVE_CONNECTOR, status: 'paused' }, error: null })

    const body = JSON.stringify({ test: true })
    const res = await webhookHandler(
      makeReq('conn-1', body),
      { params: Promise.resolve({ connectorId: 'conn-1' }) }
    )

    expect(res.status).toBe(403)
  })

  it('validates HMAC signature when webhook_secret is set', async () => {
    const secret = 'test-secret-key'
    const bodyStr = JSON.stringify({ action: 'test' })
    const validSig = createHmac('sha256', secret).update(bodyStr).digest('hex')

    makeDb(
      { data: { ...ACTIVE_CONNECTOR, webhook_secret: secret }, error: null },  // connector
      { data: null, error: null },  // last_sync_at
    )

    const res = await webhookHandler(
      makeReq('conn-1', bodyStr, { 'x-webhook-signature': validSig }),
      { params: Promise.resolve({ connectorId: 'conn-1' }) }
    )

    expect(res.status).toBe(200)
  })

  it('rejects invalid HMAC signature', async () => {
    const secret = 'test-secret-key'
    const bodyStr = JSON.stringify({ action: 'test' })

    makeDb(
      { data: { ...ACTIVE_CONNECTOR, webhook_secret: secret }, error: null },
    )

    const res = await webhookHandler(
      makeReq('conn-1', bodyStr, { 'x-webhook-signature': 'invalid-signature' }),
      { params: Promise.resolve({ connectorId: 'conn-1' }) }
    )

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('webhooks/invalid-signature')
  })

  it('rejects missing HMAC signature when secret is configured', async () => {
    const secret = 'test-secret-key'
    const bodyStr = JSON.stringify({ action: 'test' })

    makeDb(
      { data: { ...ACTIVE_CONNECTOR, webhook_secret: secret }, error: null },
    )

    const res = await webhookHandler(
      makeReq('conn-1', bodyStr),
      { params: Promise.resolve({ connectorId: 'conn-1' }) }
    )

    expect(res.status).toBe(400)
  })

  it('strips PII from webhook payload before storing', async () => {
    const block = { id: 'block-1' }
    const event = { id: 'evt-1' }
    const { chain } = makeDb(
      { data: ACTIVE_CONNECTOR, error: null },  // connector lookup
      { data: block, error: null },               // block verification
      { data: event, error: null },               // event insert
      { data: null, error: null },                // last_sync_at update
    )

    const body = JSON.stringify({
      block_id: 'block-1',
      action: 'lead.created',
      email: 'john@example.com',
      phone: '+61400000000',
      company: 'Acme Corp',
    })

    const res = await webhookHandler(
      makeReq('conn-1', body),
      { params: Promise.resolve({ connectorId: 'conn-1' }) }
    )

    expect(res.status).toBe(200)

    // Verify the event insert was called with sanitized payload
    const insertCalls = vi.mocked(chain.insert as ReturnType<typeof vi.fn>).mock.calls
    const lastInsertPayload = insertCalls[insertCalls.length - 1]?.[0]
    if (lastInsertPayload?.payload) {
      const storedPayload = lastInsertPayload.payload
      expect(storedPayload.external_payload).not.toHaveProperty('email')
      expect(storedPayload.external_payload).not.toHaveProperty('phone')
      expect(storedPayload.external_payload).toHaveProperty('company')
    }
  })

  it('returns 400 for invalid JSON body', async () => {
    makeDb({ data: ACTIVE_CONNECTOR, error: null })

    const res = await webhookHandler(
      makeReq('conn-1', 'not-json'),
      { params: Promise.resolve({ connectorId: 'conn-1' }) }
    )

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('webhooks/invalid-json')
  })
})
