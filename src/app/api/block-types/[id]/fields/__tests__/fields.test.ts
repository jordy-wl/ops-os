import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { AuthContext, UserRole } from '@/lib/auth/withAuth'

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

// ─── Mock DB helper ──────────────────────────────────────────────────────────
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
    order: vi.fn().mockReturnThis(),
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

const makeReq = (url = 'http://localhost/api/block-types/bt-1/fields', body?: unknown) =>
  new NextRequest(url, body ? {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  } as ConstructorParameters<typeof NextRequest>[1] : undefined)

const makePatch = (url: string, body: unknown) =>
  new NextRequest(url, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  } as ConstructorParameters<typeof NextRequest>[1])

const makeDelete = (url: string) =>
  new NextRequest(url, { method: 'DELETE' } as ConstructorParameters<typeof NextRequest>[1])

// ─── Import routes after mocks ──────────────────────────────────────────────
const { GET: listFields, POST: addField } = await import('@/app/api/block-types/[id]/fields/route')
const { PATCH: patchField, DELETE: deleteField } = await import('@/app/api/block-types/[id]/fields/[fieldName]/route')

// ─── Test data ──────────────────────────────────────────────────────────────
const baseSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', 'x-field-type': 'text', 'x-display-order': 0, description: 'Name' },
    status: { type: 'string', 'x-field-type': 'select', 'x-display-order': 1, 'x-is-system': true, enum: ['active', 'inactive'] },
  },
  required: ['name'],
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/block-types/[id]/fields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCtx.role = 'ops-admin'
  })

  it('returns fields sorted by display order', async () => {
    makeDb({ data: { id: 'bt-1', field_schema: baseSchema }, error: null })

    const res = await listFields(makeReq(), { params: Promise.resolve({ id: 'bt-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(2)
    expect(body.data[0].name).toBe('name')
    expect(body.data[1].name).toBe('status')
  })

  it('returns 404 for nonexistent type', async () => {
    makeDb({ data: null, error: { code: 'PGRST116' } })

    const res = await listFields(makeReq(), { params: Promise.resolve({ id: 'nope' }) })
    expect(res.status).toBe(404)
  })

  it('ops-user can list fields', async () => {
    mockCtx.role = 'ops-user'
    makeDb({ data: { id: 'bt-1', field_schema: baseSchema }, error: null })

    const res = await listFields(makeReq(), { params: Promise.resolve({ id: 'bt-1' }) })
    expect(res.status).toBe(200)
  })
})

describe('POST /api/block-types/[id]/fields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCtx.role = 'ops-admin'
  })

  it('adds a text field and returns 201', async () => {
    makeDb(
      // fetch type
      { data: { id: 'bt-1', type_name: 'client', field_schema: baseSchema }, error: null },
      // update type
      { data: null, error: null }
    )

    const res = await addField(
      makeReq('http://localhost/api/block-types/bt-1/fields', {
        name: 'notes',
        field_type: 'text',
        description: 'Additional notes',
      }),
      { params: Promise.resolve({ id: 'bt-1' }) }
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.name).toBe('notes')
    expect(body.data['x-field-type']).toBe('text')
  })

  it('rejects duplicate field name with 409', async () => {
    makeDb(
      { data: { id: 'bt-1', type_name: 'client', field_schema: baseSchema }, error: null }
    )

    const res = await addField(
      makeReq('http://localhost/api/block-types/bt-1/fields', {
        name: 'name',
        field_type: 'text',
      }),
      { params: Promise.resolve({ id: 'bt-1' }) }
    )

    expect(res.status).toBe(409)
  })

  it('rejects invalid field type with 400', async () => {
    const res = await addField(
      makeReq('http://localhost/api/block-types/bt-1/fields', {
        name: 'foo',
        field_type: 'invalid_type',
      }),
      { params: Promise.resolve({ id: 'bt-1' }) }
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('validation/invalid-field-type')
  })

  it('rejects relation without target', async () => {
    makeDb(
      { data: { id: 'bt-1', type_name: 'client', field_schema: baseSchema }, error: null }
    )

    const res = await addField(
      makeReq('http://localhost/api/block-types/bt-1/fields', {
        name: 'related',
        field_type: 'relation',
      }),
      { params: Promise.resolve({ id: 'bt-1' }) }
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('validation/missing-relation-target')
  })

  it('rejects self-referencing relation', async () => {
    makeDb(
      { data: { id: 'bt-1', type_name: 'client', field_schema: baseSchema }, error: null }
    )

    const res = await addField(
      makeReq('http://localhost/api/block-types/bt-1/fields', {
        name: 'related',
        field_type: 'relation',
        config: { 'x-relation-target': 'client' },
      }),
      { params: Promise.resolve({ id: 'bt-1' }) }
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('validation/self-reference')
  })

  it('rejects non-ops-admin with 403', async () => {
    mockCtx.role = 'ops-user'

    const res = await addField(
      makeReq('http://localhost/api/block-types/bt-1/fields', {
        name: 'notes',
        field_type: 'text',
      }),
      { params: Promise.resolve({ id: 'bt-1' }) }
    )

    expect(res.status).toBe(403)
  })
})

describe('PATCH /api/block-types/[id]/fields/[fieldName]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCtx.role = 'ops-admin'
  })

  it('updates field description', async () => {
    makeDb(
      { data: { id: 'bt-1', type_name: 'client', field_schema: baseSchema }, error: null },
      { data: null, error: null }
    )

    const res = await patchField(
      makePatch('http://localhost/api/block-types/bt-1/fields/name', {
        description: 'Full name',
      }),
      { params: Promise.resolve({ id: 'bt-1', fieldName: 'name' }) }
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.description).toBe('Full name')
  })

  it('rejects update to system field with 403', async () => {
    makeDb(
      { data: { id: 'bt-1', type_name: 'client', field_schema: baseSchema }, error: null }
    )

    const res = await patchField(
      makePatch('http://localhost/api/block-types/bt-1/fields/status', {
        description: 'New desc',
      }),
      { params: Promise.resolve({ id: 'bt-1', fieldName: 'status' }) }
    )

    expect(res.status).toBe(403)
  })

  it('returns 404 for nonexistent field', async () => {
    makeDb(
      { data: { id: 'bt-1', type_name: 'client', field_schema: baseSchema }, error: null }
    )

    const res = await patchField(
      makePatch('http://localhost/api/block-types/bt-1/fields/nope', {
        description: 'Something',
      }),
      { params: Promise.resolve({ id: 'bt-1', fieldName: 'nope' }) }
    )

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/block-types/[id]/fields/[fieldName]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCtx.role = 'ops-admin'
  })

  it('deletes a non-system field', async () => {
    makeDb(
      { data: { id: 'bt-1', type_name: 'client', field_schema: baseSchema }, error: null },
      { data: null, error: null }
    )

    const res = await deleteField(
      makeDelete('http://localhost/api/block-types/bt-1/fields/name'),
      { params: Promise.resolve({ id: 'bt-1', fieldName: 'name' }) }
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.deleted).toBe(true)
  })

  it('rejects deletion of system field with 403', async () => {
    makeDb(
      { data: { id: 'bt-1', type_name: 'client', field_schema: baseSchema }, error: null }
    )

    const res = await deleteField(
      makeDelete('http://localhost/api/block-types/bt-1/fields/status'),
      { params: Promise.resolve({ id: 'bt-1', fieldName: 'status' }) }
    )

    expect(res.status).toBe(403)
  })

  it('returns 404 for nonexistent field', async () => {
    makeDb(
      { data: { id: 'bt-1', type_name: 'client', field_schema: baseSchema }, error: null }
    )

    const res = await deleteField(
      makeDelete('http://localhost/api/block-types/bt-1/fields/nope'),
      { params: Promise.resolve({ id: 'bt-1', fieldName: 'nope' }) }
    )

    expect(res.status).toBe(404)
  })

  it('rejects non-ops-admin with 403', async () => {
    mockCtx.role = 'ops-user'

    const res = await deleteField(
      makeDelete('http://localhost/api/block-types/bt-1/fields/name'),
      { params: Promise.resolve({ id: 'bt-1', fieldName: 'name' }) }
    )

    expect(res.status).toBe(403)
  })
})
