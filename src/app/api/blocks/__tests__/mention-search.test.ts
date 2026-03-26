import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { AuthContext } from '@/lib/auth/withAuth'

// --- Auth mock (ops-admin with all permissions) ---
const ALL_PERMS = new Set([
  'manage_blocks', 'edit_blocks', 'view_blocks', 'manage_workflows',
  'execute_workflows', 'approve_tasks', 'manage_team', 'manage_settings',
  'manage_integrations', 'view_audit_log',
])

const mockCtx: AuthContext = {
  userId: 'user_111',
  clerkOrgId: 'org_abc',
  orgId: 'uuid-org-1',
  role: 'ops-admin' as const,
  roleId: 'role-uuid-admin',
  permissions: ALL_PERMS,
}

vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: vi.fn(
    (handler: (req: NextRequest, ctx: AuthContext, params: Record<string, string>) => Promise<Response>) =>
      async (req: NextRequest, context: { params: Promise<Record<string, string>> }) => {
        const params = await context.params
        return handler(req, mockCtx, params)
      }
  ),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

import { createServerClient } from '@/lib/supabase/server'

// ---- Mock DB helper (same pattern as blocks.test.ts) ----
function makeDb(...responses: { data: unknown; error: unknown }[]) {
  const queue = [...responses]
  let i = 0

  const singleFn = vi.fn().mockImplementation(() => Promise.resolve(queue[i++] ?? { data: null, error: null }))
  const maybeSingleFn = vi.fn().mockImplementation(() => Promise.resolve(queue[i++] ?? { data: null, error: null }))
  const rpcFn = vi.fn().mockImplementation(() => Promise.resolve(queue[i++] ?? { data: null, error: null }))

  const chain: Record<string, unknown> = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: singleFn,
    maybeSingle: maybeSingleFn,
    rpc: rpcFn,
    then: (resolve: (v: unknown) => void, reject: (r: unknown) => void) =>
      Promise.resolve(queue[i++] ?? { data: [], error: null }).then(resolve, reject),
  }

  vi.mocked(createServerClient).mockReturnValue(chain as unknown as ReturnType<typeof createServerClient>)
  return { chain, singleFn, maybeSingleFn }
}

const makeReq = (url: string) =>
  new NextRequest(url, undefined as unknown as ConstructorParameters<typeof NextRequest>[1])

// Import route after mocks
const { GET } = await import('@/app/api/blocks/mention-search/route')

// ---- Tests ----

describe('GET /api/blocks/mention-search', () => {
  beforeEach(() => vi.clearAllMocks())

  // ===== Validation =====

  describe('validation', () => {
    it('returns 400 when stage is missing', async () => {
      makeDb()
      const res = await GET(
        makeReq('http://localhost/api/blocks/mention-search'),
        { params: Promise.resolve({}) }
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('validation/invalid-stage')
    })

    it('returns 400 when stage is invalid', async () => {
      makeDb()
      const res = await GET(
        makeReq('http://localhost/api/blocks/mention-search?stage=invalid'),
        { params: Promise.resolve({}) }
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('validation/invalid-stage')
    })

    it('returns 400 when stage=field but type is missing', async () => {
      makeDb()
      const res = await GET(
        makeReq('http://localhost/api/blocks/mention-search?stage=field'),
        { params: Promise.resolve({}) }
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('validation/missing-type')
    })

    it('returns 400 when stage=value but type is missing', async () => {
      makeDb()
      const res = await GET(
        makeReq('http://localhost/api/blocks/mention-search?stage=value&field=jurisdiction'),
        { params: Promise.resolve({}) }
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('validation/missing-type')
    })

    it('returns 400 when stage=value but field is missing', async () => {
      makeDb()
      const res = await GET(
        makeReq('http://localhost/api/blocks/mention-search?stage=value&type=client'),
        { params: Promise.resolve({}) }
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('validation/missing-field')
    })
  })

  // ===== Permission =====

  describe('permissions', () => {
    it('returns 403 when user lacks view_blocks permission', async () => {
      // Override permissions for this test
      const originalPerms = mockCtx.permissions
      mockCtx.permissions = new Set(['manage_workflows'])

      makeDb()
      const res = await GET(
        makeReq('http://localhost/api/blocks/mention-search?stage=type'),
        { params: Promise.resolve({}) }
      )
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('auth/forbidden')

      // Restore
      mockCtx.permissions = originalPerms
    })
  })

  // ===== Stage 1: type =====

  describe('stage=type', () => {
    it('returns block types with counts', async () => {
      const types = [
        { type_name: 'client', display_name: 'Client', icon: 'building' },
        { type_name: 'deal', display_name: 'Deal', icon: 'dollar' },
      ]
      // Count query returns individual rows for counting
      const countRows = [
        { type: 'client' },
        { type: 'client' },
        { type: 'client' },
        { type: 'deal' },
      ]
      makeDb(
        { data: types, error: null },     // type definitions query
        { data: countRows, error: null },  // block counts query
      )

      const res = await GET(
        makeReq('http://localhost/api/blocks/mention-search?stage=type'),
        { params: Promise.resolve({}) }
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
      expect(body.data[0]).toEqual({
        type_name: 'client',
        display_name: 'Client',
        icon: 'building',
        block_count: 3,
      })
      expect(body.data[1]).toEqual({
        type_name: 'deal',
        display_name: 'Deal',
        icon: 'dollar',
        block_count: 1,
      })
    })

    it('returns empty array when no types match', async () => {
      makeDb({ data: [], error: null })

      const res = await GET(
        makeReq('http://localhost/api/blocks/mention-search?stage=type&q=zzz'),
        { params: Promise.resolve({}) }
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toEqual([])
    })

    it('returns 500 on DB error', async () => {
      makeDb({ data: null, error: { code: 'DB_ERR' } })

      const res = await GET(
        makeReq('http://localhost/api/blocks/mention-search?stage=type'),
        { params: Promise.resolve({}) }
      )
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error.code).toBe('db/query-failed')
    })
  })

  // ===== Stage 2: field =====

  describe('stage=field', () => {
    it('returns fields from type schema', async () => {
      const typeDef = {
        field_schema: {
          properties: {
            jurisdiction: { type: 'string' },
            contact_email: { type: 'string' },
            annual_revenue: { type: 'number' },
          },
        },
      }
      makeDb({ data: typeDef, error: null })

      const res = await GET(
        makeReq('http://localhost/api/blocks/mention-search?stage=field&type=client'),
        { params: Promise.resolve({}) }
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(3)
      expect(body.data).toContainEqual({
        field: 'jurisdiction',
        label: 'Jurisdiction',
        field_type: 'string',
      })
      expect(body.data).toContainEqual({
        field: 'contact_email',
        label: 'Contact Email',
        field_type: 'string',
      })
      expect(body.data).toContainEqual({
        field: 'annual_revenue',
        label: 'Annual Revenue',
        field_type: 'number',
      })
    })

    it('filters fields by query string', async () => {
      const typeDef = {
        field_schema: {
          properties: {
            jurisdiction: { type: 'string' },
            contact_email: { type: 'string' },
          },
        },
      }
      makeDb({ data: typeDef, error: null })

      const res = await GET(
        makeReq('http://localhost/api/blocks/mention-search?stage=field&type=client&q=jur'),
        { params: Promise.resolve({}) }
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].field).toBe('jurisdiction')
    })

    it('returns empty array when type has no field_schema', async () => {
      makeDb({ data: null, error: null })

      const res = await GET(
        makeReq('http://localhost/api/blocks/mention-search?stage=field&type=client'),
        { params: Promise.resolve({}) }
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toEqual([])
    })

    it('returns 500 on DB error', async () => {
      makeDb({ data: null, error: { code: 'DB_ERR' } })

      const res = await GET(
        makeReq('http://localhost/api/blocks/mention-search?stage=field&type=client'),
        { params: Promise.resolve({}) }
      )
      expect(res.status).toBe(500)
    })
  })

  // ===== Stage 3: value =====

  describe('stage=value', () => {
    it('returns distinct values with counts', async () => {
      const typeDef = {
        field_schema: {
          properties: {
            jurisdiction: { type: 'string' },
          },
        },
      }
      const blocks = [
        { metadata: { jurisdiction: 'AU' } },
        { metadata: { jurisdiction: 'AU' } },
        { metadata: { jurisdiction: 'GB' } },
        { metadata: { jurisdiction: 'US' } },
      ]
      makeDb(
        { data: typeDef, error: null },  // schema validation
        { data: blocks, error: null },   // block metadata query
      )

      const res = await GET(
        makeReq('http://localhost/api/blocks/mention-search?stage=value&type=client&field=jurisdiction'),
        { params: Promise.resolve({}) }
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(3)
      // Sorted by count desc — AU=2, then GB and US tied at 1
      expect(body.data[0]).toEqual({ value: 'AU', count: 2 })
    })

    it('filters values by query string', async () => {
      const typeDef = {
        field_schema: { properties: { jurisdiction: { type: 'string' } } },
      }
      const blocks = [
        { metadata: { jurisdiction: 'Australia' } },
        { metadata: { jurisdiction: 'Austria' } },
        { metadata: { jurisdiction: 'UK' } },
      ]
      makeDb(
        { data: typeDef, error: null },
        { data: blocks, error: null },
      )

      const res = await GET(
        makeReq('http://localhost/api/blocks/mention-search?stage=value&type=client&field=jurisdiction&q=aus'),
        { params: Promise.resolve({}) }
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
      // Both Australia and Austria contain "aus"
      expect(body.data.map((d: { value: string }) => d.value).sort()).toEqual(['Australia', 'Austria'])
    })

    it('returns 400 when field does not exist in schema', async () => {
      const typeDef = {
        field_schema: { properties: { jurisdiction: { type: 'string' } } },
      }
      makeDb({ data: typeDef, error: null })

      const res = await GET(
        makeReq('http://localhost/api/blocks/mention-search?stage=value&type=client&field=nonexistent'),
        { params: Promise.resolve({}) }
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('validation/unknown-field')
    })

    it('returns 400 when type has no schema', async () => {
      makeDb({ data: null, error: null })

      const res = await GET(
        makeReq('http://localhost/api/blocks/mention-search?stage=value&type=client&field=jurisdiction'),
        { params: Promise.resolve({}) }
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('validation/unknown-type')
    })

    it('skips blocks with null metadata', async () => {
      const typeDef = {
        field_schema: { properties: { jurisdiction: { type: 'string' } } },
      }
      const blocks = [
        { metadata: null },
        { metadata: { jurisdiction: 'AU' } },
        { metadata: { other_field: 'x' } },
      ]
      makeDb(
        { data: typeDef, error: null },
        { data: blocks, error: null },
      )

      const res = await GET(
        makeReq('http://localhost/api/blocks/mention-search?stage=value&type=client&field=jurisdiction'),
        { params: Promise.resolve({}) }
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0]).toEqual({ value: 'AU', count: 1 })
    })

    it('returns 500 on DB error fetching blocks', async () => {
      const typeDef = {
        field_schema: { properties: { jurisdiction: { type: 'string' } } },
      }
      makeDb(
        { data: typeDef, error: null },
        { data: null, error: { code: 'DB_ERR' } },
      )

      const res = await GET(
        makeReq('http://localhost/api/blocks/mention-search?stage=value&type=client&field=jurisdiction'),
        { params: Promise.resolve({}) }
      )
      expect(res.status).toBe(500)
    })
  })
})
