import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { AuthContext, UserRole } from '@/lib/auth/withAuth'

// Configurable mock role — change per test to verify requireRole behavior
const mockCtx = vi.hoisted(() => ({
  role: 'ops-admin' as UserRole,
}))

vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: vi.fn(
    (handler: (req: NextRequest, ctx: AuthContext, params: Record<string, string>) => Promise<Response>) =>
      async (req: NextRequest, context: { params: Promise<Record<string, string>> }) => {
        const params = await context.params
        return handler(
          req,
          { userId: 'user_111', clerkOrgId: 'org_abc', orgId: 'uuid-org-1', role: mockCtx.role },
          params
        )
      }
  ),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

import { createServerClient } from '@/lib/supabase/server'

// ─── Mock DB helper (same pattern as blocks.test.ts) ──────────────────────────
function makeDb(...responses: { data: unknown; error: unknown; count?: number }[]) {
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
    or: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(next),
    then: (resolve: (v: unknown) => void, reject: (r: unknown) => void) =>
      next().then(resolve, reject),
  }

  vi.mocked(createServerClient).mockReturnValue(chain as unknown as ReturnType<typeof createServerClient>)
  return chain
}

const makeReq = (url = 'http://localhost/api/block-types', opts?: RequestInit) =>
  new NextRequest(url, opts as ConstructorParameters<typeof NextRequest>[1])

// ─── Import routes after mocks ────────────────────────────────────────────────
const { GET: listTypes, POST: createType } = await import('@/app/api/block-types/route')
const { PATCH: patchType, DELETE: deleteType } = await import('@/app/api/block-types/[id]/route')

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/block-types', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCtx.role = 'ops-admin'
  })

  it('returns block types for org', async () => {
    const types = [
      { id: 'bt-1', type_name: 'client', display_name: 'Client' },
      { id: 'bt-2', type_name: 'deal', display_name: 'Deal' },
    ]
    makeDb({ data: types, error: null })

    const res = await listTypes(makeReq(), { params: Promise.resolve({}) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(2)
  })

  it('ops-user can also list types (no role restriction on GET)', async () => {
    mockCtx.role = 'ops-user'
    makeDb({ data: [], error: null })

    const res = await listTypes(makeReq(), { params: Promise.resolve({}) })
    expect(res.status).toBe(200)
  })
})

describe('POST /api/block-types', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCtx.role = 'ops-admin'
  })

  it('creates a block type — returns 201', async () => {
    const created = { id: 'bt-new', type_name: 'invoice', display_name: 'Invoice', field_schema: {} }
    makeDb({ data: created, error: null })

    const req = makeReq('http://localhost/api/block-types', {
      method: 'POST',
      body: JSON.stringify({ type_name: 'invoice', display_name: 'Invoice' }),
    })
    const res = await createType(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.type_name).toBe('invoice')
  })

  it('returns 400 on invalid type_name (uppercase)', async () => {
    makeDb()
    const req = makeReq('http://localhost/api/block-types', {
      method: 'POST',
      body: JSON.stringify({ type_name: 'BadName', display_name: 'Bad' }),
    })
    const res = await createType(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(400)
  })

  it('returns 400 on missing display_name', async () => {
    makeDb()
    const req = makeReq('http://localhost/api/block-types', {
      method: 'POST',
      body: JSON.stringify({ type_name: 'valid_name' }),
    })
    const res = await createType(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid field_schema', async () => {
    makeDb()
    const req = makeReq('http://localhost/api/block-types', {
      method: 'POST',
      body: JSON.stringify({
        type_name: 'test_type',
        display_name: 'Test',
        field_schema: { type: 'invalid_type_value' },
      }),
    })
    const res = await createType(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(400)
  })

  it('accepts valid JSON Schema in field_schema', async () => {
    const validSchema = {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    }
    const created = { id: 'bt-x', type_name: 'custom', display_name: 'Custom', field_schema: validSchema }
    makeDb({ data: created, error: null })

    const req = makeReq('http://localhost/api/block-types', {
      method: 'POST',
      body: JSON.stringify({ type_name: 'custom', display_name: 'Custom', field_schema: validSchema }),
    })
    const res = await createType(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(201)
  })

  it('returns 409 on duplicate type_name', async () => {
    makeDb({ data: null, error: { code: '23505' } })

    const req = makeReq('http://localhost/api/block-types', {
      method: 'POST',
      body: JSON.stringify({ type_name: 'client', display_name: 'Client' }),
    })
    const res = await createType(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('block-types/duplicate')
  })

  it('returns 403 for ops-user role', async () => {
    mockCtx.role = 'ops-user'
    makeDb()

    const req = makeReq('http://localhost/api/block-types', {
      method: 'POST',
      body: JSON.stringify({ type_name: 'test', display_name: 'Test' }),
    })
    const res = await createType(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(403)
  })
})

describe('PATCH /api/block-types/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCtx.role = 'ops-admin'
  })

  it('updates a block type', async () => {
    const existing = { id: 'bt-1', is_system: false }
    const updated = { id: 'bt-1', display_name: 'Updated Name', is_system: false }
    makeDb(
      { data: existing, error: null }, // fetch existing
      { data: updated, error: null }   // update
    )

    const req = makeReq('http://localhost/api/block-types/bt-1', {
      method: 'PATCH',
      body: JSON.stringify({ display_name: 'Updated Name' }),
    })
    const res = await patchType(req, { params: Promise.resolve({ id: 'bt-1' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.display_name).toBe('Updated Name')
  })

  it('returns 404 when type not found', async () => {
    makeDb({ data: null, error: { code: 'PGRST116' } })

    const req = makeReq('http://localhost/api/block-types/unknown', {
      method: 'PATCH',
      body: JSON.stringify({ display_name: 'X' }),
    })
    const res = await patchType(req, { params: Promise.resolve({ id: 'unknown' }) })
    expect(res.status).toBe(404)
  })

  it('returns 400 on empty body', async () => {
    makeDb()
    const req = makeReq('http://localhost/api/block-types/bt-1', {
      method: 'PATCH',
      body: JSON.stringify({}),
    })
    const res = await patchType(req, { params: Promise.resolve({ id: 'bt-1' }) })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/block-types/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCtx.role = 'ops-admin'
  })

  it('deletes a block type with no blocks using it', async () => {
    const typeDef = { id: 'bt-1', type_name: 'custom_type', is_system: false }
    makeDb(
      { data: typeDef, error: null },              // fetch type
      { data: null, error: null, count: 0 },       // count blocks
      { data: null, error: null }                   // delete
    )

    const req = makeReq('http://localhost/api/block-types/bt-1', { method: 'DELETE' })
    const res = await deleteType(req, { params: Promise.resolve({ id: 'bt-1' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.deleted).toBe(true)
  })

  it('returns 409 when blocks of that type exist', async () => {
    const typeDef = { id: 'bt-1', type_name: 'client', is_system: false }
    makeDb(
      { data: typeDef, error: null },              // fetch type
      { data: null, error: null, count: 5 }        // count blocks — 5 exist
    )

    const req = makeReq('http://localhost/api/block-types/bt-1', { method: 'DELETE' })
    const res = await deleteType(req, { params: Promise.resolve({ id: 'bt-1' }) })

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('block-types/in-use')
  })

  it('returns 403 when trying to delete a system type', async () => {
    const typeDef = { id: 'bt-sys', type_name: 'client', is_system: true }
    makeDb({ data: typeDef, error: null })

    const req = makeReq('http://localhost/api/block-types/bt-sys', { method: 'DELETE' })
    const res = await deleteType(req, { params: Promise.resolve({ id: 'bt-sys' }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('block-types/system-protected')
  })

  it('returns 404 when type not found', async () => {
    makeDb({ data: null, error: { code: 'PGRST116' } })

    const req = makeReq('http://localhost/api/block-types/unknown', { method: 'DELETE' })
    const res = await deleteType(req, { params: Promise.resolve({ id: 'unknown' }) })
    expect(res.status).toBe(404)
  })
})
