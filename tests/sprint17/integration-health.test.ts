/**
 * tests/sprint17/integration-health.test.ts
 *
 * Unit tests for GET /api/integrations/[id]/health — integration connector
 * health check endpoint. Verifies health check logic per provider type,
 * database update behavior, and default capabilities mapping.
 *
 * All external dependencies are mocked: Supabase, withAuth, rbac middleware, logger.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { AuthContext } from '@/lib/auth/withAuth'

// ---- Mutable mock state (vi.hoisted for factory sharing) -------------------

const mockCtx = vi.hoisted(() => ({
  current: {
    userId: 'user_111',
    clerkOrgId: 'org_abc',
    orgId: 'uuid-org-1',
    role: 'ops-admin' as const,
    roleId: 'role-uuid',
    permissions: new Set(['manage_integrations'] as const),
  } as unknown as AuthContext,
}))

const mockDb = vi.hoisted(() => ({
  selectResult: null as Record<string, unknown> | null,
  selectError: null as { code: string; message: string } | null,
  updateError: null as { code: string; message: string } | null,
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

vi.mock('@/lib/rbac/middleware', () => ({
  requirePermission: vi.fn<(perms: string[], handler: Function) => Function>()
    .mockImplementation((_perms, handler) => handler),
}))

vi.mock('@/lib/supabase/server', () => {
  const createChain = () => {
    const chain: Record<string, unknown> = {}
    chain.from = vi.fn(() => chain)
    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    chain.update = vi.fn(() => chain)
    chain.single = vi.fn(() =>
      Promise.resolve({
        data: mockDb.selectResult,
        error: mockDb.selectError,
      })
    )
    return chain
  }

  return {
    createServerClient: vi.fn(() => {
      const baseChain = createChain()

      // Track calls to differentiate select vs update
      let callCount = 0
      const originalFrom = baseChain.from as ReturnType<typeof vi.fn>
      baseChain.from = vi.fn((...args: unknown[]) => {
        callCount++
        const result = originalFrom(...args)
        // For update calls (second .from call), override single to return updateError
        if (callCount > 1) {
          (result as Record<string, unknown>).single = vi.fn(() =>
            Promise.resolve({ data: null, error: mockDb.updateError })
          )
        }
        return result
      })

      return baseChain
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

// ---- Import handler after mocks --------------------------------------------

import { GET } from '@/app/api/integrations/[id]/health/route'

// ---- Helpers ---------------------------------------------------------------

function makeGetRequest(id: string) {
  const req = new NextRequest(`http://localhost/api/integrations/${id}/health`)
  const context = { params: Promise.resolve({ id }) }
  return { req, context }
}

// ---- Tests -----------------------------------------------------------------

describe('GET /api/integrations/[id]/health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.selectResult = null
    mockDb.selectError = null
    mockDb.updateError = null
  })

  it('should return 400 when connector ID is missing', async () => {
    const req = new NextRequest('http://localhost/api/integrations//health')
    const context = { params: Promise.resolve({ id: '' }) }

    const res = await GET(req, context)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error.code).toBe('validation/missing-id')
  })

  it('should return 404 when connector not found', async () => {
    mockDb.selectResult = null
    mockDb.selectError = { code: 'PGRST116', message: 'No rows found' }

    const { req, context } = makeGetRequest('non-existent-id')
    const res = await GET(req, context)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('db/not-found')
  })

  it('should return healthy status for webhook connector with reachable URL', async () => {
    // Mock a webhook connector
    mockDb.selectResult = {
      id: 'conn-1',
      provider: 'webhook',
      config: { base_url: 'https://example.com/webhook' },
      status: 'active',
      capabilities: null,
      health_status: null,
      last_health_check: null,
    }

    // Mock fetch for the webhook URL check
    const originalFetch = global.fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    })

    try {
      const { req, context } = makeGetRequest('conn-1')
      const res = await GET(req, context)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.health_status).toBe('healthy')
      expect(body.data.provider).toBe('webhook')
      expect(body.data.connector_id).toBe('conn-1')
      expect(body.data.response_time_ms).toBeTypeOf('number')
    } finally {
      global.fetch = originalFetch
    }
  })

  it('should return unhealthy for google connector with no tokens', async () => {
    mockDb.selectResult = {
      id: 'conn-google-1',
      provider: 'google',
      config: {},
      status: 'active',
      capabilities: null,
      health_status: null,
      last_health_check: null,
    }

    const { req, context } = makeGetRequest('conn-google-1')
    const res = await GET(req, context)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.health_status).toBe('unhealthy')
    expect(body.data.message).toContain('No OAuth tokens')
  })

  it('should return healthy for google connector with tokens', async () => {
    mockDb.selectResult = {
      id: 'conn-google-2',
      provider: 'google',
      config: { access_token: 'ya29.test', refresh_token: 'rt_test' },
      status: 'active',
      capabilities: null,
      health_status: null,
      last_health_check: null,
    }

    const { req, context } = makeGetRequest('conn-google-2')
    const res = await GET(req, context)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.health_status).toBe('healthy')
    expect(body.data.message).toContain('OAuth tokens present')
  })

  it('should return default capabilities by provider type', async () => {
    mockDb.selectResult = {
      id: 'conn-google-3',
      provider: 'google',
      config: { access_token: 'ya29.test' },
      status: 'active',
      capabilities: null, // null capabilities triggers default lookup
      health_status: null,
      last_health_check: null,
    }

    const { req, context } = makeGetRequest('conn-google-3')
    const res = await GET(req, context)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.capabilities).toEqual({
      calendar_sync: true,
      email_send: true,
      docs_push: true,
    })
  })

  it('should return webhook default capabilities', async () => {
    mockDb.selectResult = {
      id: 'conn-wh-1',
      provider: 'webhook',
      config: {},
      status: 'active',
      capabilities: null,
      health_status: null,
      last_health_check: null,
    }

    const { req, context } = makeGetRequest('conn-wh-1')
    const res = await GET(req, context)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.capabilities).toEqual({
      receive_events: true,
      send_events: false,
    })
  })

  it('should use existing capabilities when present on connector', async () => {
    const existingCapabilities = { custom_cap: true, another: false }
    mockDb.selectResult = {
      id: 'conn-custom',
      provider: 'google',
      config: { access_token: 'ya29.test' },
      status: 'active',
      capabilities: existingCapabilities,
      health_status: null,
      last_health_check: null,
    }

    const { req, context } = makeGetRequest('conn-custom')
    const res = await GET(req, context)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.capabilities).toEqual(existingCapabilities)
  })

  it('should return unknown status for webhook with no base_url configured', async () => {
    mockDb.selectResult = {
      id: 'conn-wh-nourl',
      provider: 'webhook',
      config: {},
      status: 'active',
      capabilities: null,
      health_status: null,
      last_health_check: null,
    }

    const { req, context } = makeGetRequest('conn-wh-nourl')
    const res = await GET(req, context)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.health_status).toBe('unknown')
    expect(body.data.message).toContain('No base_url configured')
  })

  it('should return status-based health for unknown provider type', async () => {
    mockDb.selectResult = {
      id: 'conn-unknown',
      provider: 'some_new_provider',
      config: {},
      status: 'active',
      capabilities: null,
      health_status: null,
      last_health_check: null,
    }

    const { req, context } = makeGetRequest('conn-unknown')
    const res = await GET(req, context)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.health_status).toBe('healthy')
    expect(body.data.message).toContain('status-based check')
  })

  it('should include last_checked timestamp in response', async () => {
    mockDb.selectResult = {
      id: 'conn-ts',
      provider: 'google',
      config: { access_token: 'ya29.test' },
      status: 'active',
      capabilities: null,
      health_status: null,
      last_health_check: null,
    }

    const { req, context } = makeGetRequest('conn-ts')
    const res = await GET(req, context)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.last_checked).toBeDefined()
    // Verify it is a valid ISO timestamp
    const parsed = new Date(body.data.last_checked)
    expect(parsed.getTime()).not.toBeNaN()
  })
})
