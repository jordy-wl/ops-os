import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { withAuth, AuthContext } from '@/lib/auth/withAuth'

// Helpers
const makeReq = () => new NextRequest('http://localhost/api/test')
const makeCtx = (params: Record<string, string> = {}) => ({ params: Promise.resolve(params) })
const makeHandler = () =>
  vi.fn<(req: NextRequest, ctx: AuthContext, params: Record<string, string>) => Promise<NextResponse>>().mockResolvedValue(
    NextResponse.json({ data: 'ok' }, { status: 200 })
  )

type MockResult = { data: unknown; error: unknown }

/**
 * Build a Supabase mock that routes queries by table name.
 * - orgsResult: response(s) for from('orgs') queries (single or sequential array)
 * - userRolesResult: response for from('user_roles') .select().single()
 *   Defaults to { data: { role: 'ops-admin' }, error: null }
 */
function makeSupabaseMock({
  orgsResult,
  userRolesResult = { data: { role: 'ops-admin' }, error: null },
}: {
  orgsResult: MockResult | MockResult[]
  userRolesResult?: MockResult | MockResult[]
}) {
  const orgsSingle = vi.fn()
  if (Array.isArray(orgsResult)) {
    orgsResult.forEach(r => orgsSingle.mockResolvedValueOnce(r))
  } else {
    orgsSingle.mockResolvedValue(orgsResult)
  }

  const orgsChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    single: orgsSingle,
  }

  const rolesSingle = vi.fn()
  if (Array.isArray(userRolesResult)) {
    userRolesResult.forEach(r => rolesSingle.mockResolvedValueOnce(r))
  } else {
    rolesSingle.mockResolvedValue(userRolesResult)
  }

  // insert on user_roles is terminal (awaited directly, no .select().single() chaining)
  const rolesChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: rolesSingle,
  }

  const mock = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'user_roles') return rolesChain
      return orgsChain
    }),
  }

  vi.mocked(createServerClient).mockReturnValue(mock as unknown as ReturnType<typeof createServerClient>)
  return { orgsChain, rolesChain, mock }
}

describe('withAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('401 — missing or invalid JWT', () => {
    it('returns 401 when userId is null', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null, orgId: null } as unknown as (ReturnType<typeof auth> extends Promise<infer T> ? T : never))

      const handler = withAuth(makeHandler())
      const res = await handler(makeReq(), makeCtx())

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error.code).toBe('auth/unauthenticated')
      expect(body.data).toBeNull()
    })
  })

  describe('403 — auth problems', () => {
    it('returns 403 when user has no active org', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_111', orgId: null } as unknown as (ReturnType<typeof auth> extends Promise<infer T> ? T : never))

      const handler = withAuth(makeHandler())
      const res = await handler(makeReq(), makeCtx())

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('auth/no-org')
    })

    it('returns 403 when org lookup fails with unexpected DB error', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_111', orgId: 'org_abc' } as unknown as (ReturnType<typeof auth> extends Promise<infer T> ? T : never))
      makeSupabaseMock({ orgsResult: { data: null, error: { code: 'PGRST500', message: 'DB error' } } })

      const handler = withAuth(makeHandler())
      const res = await handler(makeReq(), makeCtx())

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('auth/unknown-org')
    })
  })

  describe('200 — valid JWT + known org', () => {
    it('calls handler with correct AuthContext including role when org exists', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_111', orgId: 'org_abc' } as unknown as (ReturnType<typeof auth> extends Promise<infer T> ? T : never))
      makeSupabaseMock({
        orgsResult: { data: { id: 'uuid-org-1' }, error: null },
        userRolesResult: { data: { role: 'ops-admin' }, error: null },
      })

      const innerHandler = makeHandler()
      const handler = withAuth(innerHandler)
      const req = makeReq()
      const res = await handler(req, makeCtx())

      expect(res.status).toBe(200)
      expect(innerHandler).toHaveBeenCalledWith(
        req,
        { userId: 'user_111', clerkOrgId: 'org_abc', orgId: 'uuid-org-1', role: 'ops-admin' },
        {}
      )
    })

    it('passes awaited params to handler for dynamic routes', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_111', orgId: 'org_abc' } as unknown as (ReturnType<typeof auth> extends Promise<infer T> ? T : never))
      makeSupabaseMock({
        orgsResult: { data: { id: 'uuid-org-1' }, error: null },
      })

      const innerHandler = makeHandler()
      const handler = withAuth(innerHandler)
      const req = makeReq()
      await handler(req, { params: Promise.resolve({ id: 'block-xyz' }) })

      expect(innerHandler).toHaveBeenCalledWith(
        req,
        expect.objectContaining({ orgId: 'uuid-org-1', role: 'ops-admin' }),
        { id: 'block-xyz' }
      )
    })
  })

  describe('org auto-provisioning', () => {
    it('creates org row on first login and calls handler with ops-admin role', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_new', orgId: 'org_new' } as unknown as (ReturnType<typeof auth> extends Promise<infer T> ? T : never))

      const { orgsChain, rolesChain } = makeSupabaseMock({
        orgsResult: [
          { data: null, error: { code: 'PGRST116', message: 'not found' } }, // org lookup → not found
          { data: { id: 'uuid-org-new' }, error: null },                      // org insert → success
        ],
        userRolesResult: { data: null, error: { code: 'PGRST116', message: 'not found' } }, // no role yet
      })

      const innerHandler = makeHandler()
      const handler = withAuth(innerHandler)
      const req = makeReq()
      const res = await handler(req, makeCtx())

      expect(res.status).toBe(200)
      expect(innerHandler).toHaveBeenCalledWith(
        req,
        { userId: 'user_new', clerkOrgId: 'org_new', orgId: 'uuid-org-new', role: 'ops-admin' },
        {}
      )
      expect(orgsChain.insert).toHaveBeenCalledWith({ clerk_org_id: 'org_new' })
      expect(rolesChain.insert).toHaveBeenCalledWith({ org_id: 'uuid-org-new', user_id: 'user_new', role: 'ops-admin' })
    })

    it('returns 403 when org auto-provision insert fails', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_new', orgId: 'org_new' } as unknown as (ReturnType<typeof auth> extends Promise<infer T> ? T : never))

      makeSupabaseMock({
        orgsResult: [
          { data: null, error: { code: 'PGRST116', message: 'not found' } },
          { data: null, error: { code: 'DB_ERR', message: 'insert failed' } },
        ],
      })

      const handler = withAuth(makeHandler())
      const res = await handler(makeReq(), makeCtx())

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('auth/org-provision-failed')
    })
  })

  describe('RBAC role resolution', () => {
    it('returns ops-user role when user has ops-user in user_roles', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_111', orgId: 'org_abc' } as unknown as (ReturnType<typeof auth> extends Promise<infer T> ? T : never))
      makeSupabaseMock({
        orgsResult: { data: { id: 'uuid-org-1' }, error: null },
        userRolesResult: { data: { role: 'ops-user' }, error: null },
      })

      const innerHandler = makeHandler()
      await withAuth(innerHandler)(makeReq(), makeCtx())

      expect(innerHandler).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ role: 'ops-user' }),
        expect.anything()
      )
    })

    it('returns compliance-approver role when user has compliance-approver in user_roles', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_111', orgId: 'org_abc' } as unknown as (ReturnType<typeof auth> extends Promise<infer T> ? T : never))
      makeSupabaseMock({
        orgsResult: { data: { id: 'uuid-org-1' }, error: null },
        userRolesResult: { data: { role: 'compliance-approver' }, error: null },
      })

      const innerHandler = makeHandler()
      await withAuth(innerHandler)(makeReq(), makeCtx())

      expect(innerHandler).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ role: 'compliance-approver' }),
        expect.anything()
      )
    })

    it('assigns ops-user default and inserts row when existing org has no role for this user', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_new', orgId: 'org_abc' } as unknown as (ReturnType<typeof auth> extends Promise<infer T> ? T : never))
      const { rolesChain } = makeSupabaseMock({
        orgsResult: { data: { id: 'uuid-org-1' }, error: null },
        userRolesResult: { data: null, error: { code: 'PGRST116', message: 'not found' } },
      })

      const innerHandler = makeHandler()
      const res = await withAuth(innerHandler)(makeReq(), makeCtx())

      expect(res.status).toBe(200)
      expect(innerHandler).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ role: 'ops-user' }),
        expect.anything()
      )
      expect(rolesChain.insert).toHaveBeenCalledWith({ org_id: 'uuid-org-1', user_id: 'user_new', role: 'ops-user' })
    })

    it('assigns ops-admin default when org is newly created (org creator)', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_creator', orgId: 'org_new' } as unknown as (ReturnType<typeof auth> extends Promise<infer T> ? T : never))
      const { rolesChain } = makeSupabaseMock({
        orgsResult: [
          { data: null, error: { code: 'PGRST116', message: 'not found' } },
          { data: { id: 'uuid-org-new' }, error: null },
        ],
        userRolesResult: { data: null, error: { code: 'PGRST116', message: 'not found' } },
      })

      const innerHandler = makeHandler()
      await withAuth(innerHandler)(makeReq(), makeCtx())

      expect(innerHandler).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ role: 'ops-admin' }),
        expect.anything()
      )
      expect(rolesChain.insert).toHaveBeenCalledWith({ org_id: 'uuid-org-new', user_id: 'user_creator', role: 'ops-admin' })
    })
  })
})
