/**
 * tests/api/integrations.test.ts — Integration & Webhook Contract Tests
 *
 * Tests run against a REAL local Supabase instance.
 * Requires: supabase start + SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Also includes unit tests for HMAC verification, PII sanitization,
 * and template variable interpolation that run without Supabase.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'
import { hasSupabase, getTestSupabase, makePost, makePatch, makeDelete } from './helpers'

// ─── Unit tests (no Supabase needed) ────────────────────────────────────────

describe('HMAC verification', () => {
  it('verifies valid HMAC-SHA256 signature', async () => {
    const { createHmac } = await import('crypto')
    const { verifyHmacSignature } = await import('@/lib/integrations/hmac')

    const body = '{"event": "test"}'
    const secret = 'test-secret-key'
    const signature = createHmac('sha256', secret).update(body).digest('hex')

    expect(verifyHmacSignature(body, signature, secret)).toBe(true)
  })

  it('rejects invalid HMAC signature', async () => {
    const { verifyHmacSignature } = await import('@/lib/integrations/hmac')

    expect(verifyHmacSignature('body', 'invalid-hex', 'secret')).toBe(false)
  })

  it('rejects wrong signature', async () => {
    const { createHmac } = await import('crypto')
    const { verifyHmacSignature } = await import('@/lib/integrations/hmac')

    const body = '{"event": "test"}'
    const wrongSignature = createHmac('sha256', 'wrong-secret').update(body).digest('hex')

    expect(verifyHmacSignature(body, wrongSignature, 'correct-secret')).toBe(false)
  })
})

describe('PII sanitization', () => {
  it('strips known PII fields', async () => {
    const { sanitizePayload } = await import('@/lib/embeddings')

    const payload = {
      action: 'created',
      block_type: 'client',
      email: 'user@example.com',
      phone: '+61400000000',
      first_name: 'John',
      last_name: 'Doe',
      ssn: '123-45-6789',
    }

    const result = sanitizePayload(payload)

    expect(result).toEqual({ action: 'created', block_type: 'client' })
    expect(result).not.toHaveProperty('email')
    expect(result).not.toHaveProperty('phone')
    expect(result).not.toHaveProperty('first_name')
    expect(result).not.toHaveProperty('last_name')
    expect(result).not.toHaveProperty('ssn')
  })

  it('preserves non-PII fields', async () => {
    const { sanitizePayload } = await import('@/lib/embeddings')

    const payload = {
      block_type: 'deal',
      status: 'active',
      amount: 50000,
      region: 'APAC',
    }

    const result = sanitizePayload(payload)
    expect(result).toEqual(payload)
  })

  it('handles null/non-object input', async () => {
    const { sanitizePayload } = await import('@/lib/embeddings')

    expect(sanitizePayload(null)).toEqual({})
    expect(sanitizePayload(undefined)).toEqual({})
    expect(sanitizePayload('string')).toEqual({})
  })
})

describe('template interpolation', () => {
  it('interpolates block and context variables', async () => {
    const { interpolateTemplate } = await import('@/lib/workflow/step-engine')

    const result = interpolateTemplate(
      'Hello {{block.name}} from {{context.applies_to_type}}',
      {
        block: { name: 'Acme Corp', id: 'b-1' },
        context: { applies_to_type: 'client' },
      }
    )

    expect(result).toBe('Hello Acme Corp from client')
  })

  it('handles missing variables gracefully', async () => {
    const { interpolateTemplate } = await import('@/lib/workflow/step-engine')

    const result = interpolateTemplate('{{block.name}} {{block.missing}}', {
      block: { name: 'Test' },
    })

    expect(result).toBe('Test ')
  })

  it('serializes object values to JSON', async () => {
    const { interpolateTemplate } = await import('@/lib/workflow/step-engine')

    const result = interpolateTemplate('{{block.meta}}', {
      block: { meta: { key: 'value' } },
    })

    expect(result).toBe('{"key":"value"}')
  })
})

// ─── Contract tests (real Supabase) ─────────────────────────────────────────

const ctx = vi.hoisted(() => ({
  orgId: '',
  userId: 'user_contract_test',
  clerkOrgId: '',
  role: 'ops-admin' as const,
}))

vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: vi.fn(
    (handler) =>
      async (req: NextRequest, context: { params: Promise<Record<string, string>> }) =>
        handler(req, { userId: ctx.userId, clerkOrgId: ctx.clerkOrgId, orgId: ctx.orgId, role: ctx.role },
          await (context.params ?? Promise.resolve({})))
  ),
}))

vi.mock('@/lib/auth/requireRole', () => ({
  requireRole: vi.fn((_roles: string[], handler: unknown) => handler),
}))

vi.mock('@/lib/supabase/server', async () => {
  const { createClient } = await import('@supabase/supabase-js')
  return {
    createServerClient: vi.fn(() =>
      createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      )
    ),
  }
})

vi.mock('@/lib/embeddings', () => ({
  embedEvent: vi.fn().mockResolvedValue(undefined),
  sanitizePayload: vi.fn((p: unknown) => {
    if (!p || typeof p !== 'object') return {}
    const PII = new Set(['email', 'phone', 'mobile', 'address', 'ssn', 'tax_id', 'date_of_birth', 'dob', 'first_name', 'last_name', 'full_name', 'password', 'secret', 'token', 'credit_card', 'bank_account'])
    const clean: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(p as Record<string, unknown>)) {
      if (!PII.has(k.toLowerCase())) clean[k] = v
    }
    return clean
  }),
}))

import { GET as LIST_CONNECTORS, POST as CREATE_CONNECTOR } from '@/app/api/integrations/route'
import { GET as GET_CONNECTOR, PATCH as PATCH_CONNECTOR, DELETE as DELETE_CONNECTOR } from '@/app/api/integrations/[id]/route'

describe.skipIf(!hasSupabase)('Integration Connectors API — contract tests (real Supabase)', () => {
  let connectorId: string
  let webhookSecret: string | null

  beforeAll(async () => {
    const supabase = getTestSupabase()
    // Get or create a test org
    const { data: orgs } = await supabase.from('orgs').select('id').limit(1)
    if (orgs && orgs.length > 0) {
      ctx.orgId = orgs[0].id
    } else {
      const { data: newOrg } = await supabase
        .from('orgs')
        .insert({ name: 'Test Org for Integrations', clerk_org_id: 'org_integration_test' })
        .select()
        .single()
      ctx.orgId = newOrg!.id
      ctx.clerkOrgId = 'org_integration_test'
    }
  })

  it('POST /api/integrations — creates inbound webhook connector', async () => {
    const req = makePost('http://localhost/api/integrations', {
      name: 'CRM Webhook Test',
      provider: 'webhook',
      direction: 'inbound',
    })

    const res = await CREATE_CONNECTOR(req, { params: Promise.resolve({}) })
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.data).toBeDefined()
    expect(json.data.name).toBe('CRM Webhook Test')
    expect(json.data.provider).toBe('webhook')
    expect(json.data.direction).toBe('inbound')
    expect(json.data.status).toBe('active')
    expect(json.data.webhook_url).toContain('/api/webhooks/integration/')
    // webhook_secret should NOT be in response
    expect(json.data.webhook_secret).toBeUndefined()

    connectorId = json.data.id
  })

  it('GET /api/integrations — lists connectors', async () => {
    const req = new NextRequest('http://localhost/api/integrations')
    const res = await LIST_CONNECTORS(req, { params: Promise.resolve({}) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toBeInstanceOf(Array)
    expect(json.data.some((c: { id: string }) => c.id === connectorId)).toBe(true)
  })

  it('GET /api/integrations — filters by provider', async () => {
    const req = new NextRequest('http://localhost/api/integrations?provider=webhook')
    const res = await LIST_CONNECTORS(req, { params: Promise.resolve({}) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.every((c: { provider: string }) => c.provider === 'webhook')).toBe(true)
  })

  it('GET /api/integrations/:id — gets single connector', async () => {
    const req = new NextRequest(`http://localhost/api/integrations/${connectorId}`)
    const res = await GET_CONNECTOR(req, { params: Promise.resolve({ id: connectorId }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.id).toBe(connectorId)
    expect(json.data.webhook_secret).toBeUndefined()
  })

  it('PATCH /api/integrations/:id — updates connector', async () => {
    const req = makePatch(`http://localhost/api/integrations/${connectorId}`, {
      name: 'CRM Webhook Updated',
    })
    const res = await PATCH_CONNECTOR(req, { params: Promise.resolve({ id: connectorId }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.name).toBe('CRM Webhook Updated')
  })

  it('PATCH /api/integrations/:id — rejects secrets in config', async () => {
    const req = makePatch(`http://localhost/api/integrations/${connectorId}`, {
      config: { api_key: 'sk-secret-value' },
    })
    const res = await PATCH_CONNECTOR(req, { params: Promise.resolve({ id: connectorId }) })

    expect(res.status).toBe(400)
  })

  it('POST /api/integrations — rejects secrets in config', async () => {
    const req = makePost('http://localhost/api/integrations', {
      name: 'Bad Connector',
      provider: 'webhook',
      direction: 'inbound',
      config: { password: 'secret123' },
    })

    const res = await CREATE_CONNECTOR(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(400)
  })

  it('DELETE /api/integrations/:id — soft-deletes (archives) connector', async () => {
    const req = makeDelete(`http://localhost/api/integrations/${connectorId}`)
    const res = await DELETE_CONNECTOR(req, { params: Promise.resolve({ id: connectorId }) })

    expect(res.status).toBe(200)

    // Verify archived — should not appear in list
    const listReq = new NextRequest('http://localhost/api/integrations')
    const listRes = await LIST_CONNECTORS(listReq, { params: Promise.resolve({}) })
    const listJson = await listRes.json()
    expect(listJson.data.some((c: { id: string }) => c.id === connectorId)).toBe(false)
  })

  it('GET /api/integrations/:id — returns 404 for non-existent connector', async () => {
    const req = new NextRequest('http://localhost/api/integrations/00000000-0000-0000-0000-000000000000')
    const res = await GET_CONNECTOR(req, { params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000000' }) })

    expect(res.status).toBe(404)
  })

  it('POST /api/integrations — validates required fields', async () => {
    const req = makePost('http://localhost/api/integrations', {
      // Missing name
      provider: 'webhook',
    })

    const res = await CREATE_CONNECTOR(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(400)
  })

  it('POST /api/integrations — validates provider enum', async () => {
    const req = makePost('http://localhost/api/integrations', {
      name: 'Bad Provider',
      provider: 'invalid_provider',
    })

    const res = await CREATE_CONNECTOR(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(400)
  })
})
