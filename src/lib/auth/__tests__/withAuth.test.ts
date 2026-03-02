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
  vi.fn<[NextRequest, AuthContext, Record<string, string>], Promise<NextResponse>>().mockResolvedValue(
    NextResponse.json({ data: 'ok' }, { status: 200 })
  )

function makeSupabaseMock(result: { data: unknown; error: unknown }) {
  const mock = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  }
  vi.mocked(createServerClient).mockReturnValue(mock as ReturnType<typeof createServerClient>)
  return mock
}

describe('withAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('401 — missing or invalid JWT', () => {
    it('returns 401 when userId is null', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null, orgId: null } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

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
      vi.mocked(auth).mockResolvedValue({ userId: 'user_111', orgId: null } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

      const handler = withAuth(makeHandler())
      const res = await handler(makeReq(), makeCtx())

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('auth/no-org')
    })

    it('returns 403 when org lookup fails with unexpected DB error', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_111', orgId: 'org_abc' } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
      makeSupabaseMock({ data: null, error: { code: 'PGRST500', message: 'DB error' } })

      const handler = withAuth(makeHandler())
      const res = await handler(makeReq(), makeCtx())

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('auth/unknown-org')
    })
  })

  describe('200 — valid JWT + known org', () => {
    it('calls handler with correct AuthContext when org exists', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_111', orgId: 'org_abc' } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
      makeSupabaseMock({ data: { id: 'uuid-org-1' }, error: null })

      const innerHandler = makeHandler()
      const handler = withAuth(innerHandler)
      const req = makeReq()
      const res = await handler(req, makeCtx())

      expect(res.status).toBe(200)
      expect(innerHandler).toHaveBeenCalledWith(
        req,
        { userId: 'user_111', clerkOrgId: 'org_abc', orgId: 'uuid-org-1' },
        {}
      )
    })

    it('passes awaited params to handler for dynamic routes', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_111', orgId: 'org_abc' } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
      makeSupabaseMock({ data: { id: 'uuid-org-1' }, error: null })

      const innerHandler = makeHandler()
      const handler = withAuth(innerHandler)
      const req = makeReq()
      await handler(req, { params: Promise.resolve({ id: 'block-xyz' }) })

      expect(innerHandler).toHaveBeenCalledWith(
        req,
        expect.objectContaining({ orgId: 'uuid-org-1' }),
        { id: 'block-xyz' }
      )
    })
  })

  describe('org auto-provisioning', () => {
    it('creates org row on first login and calls handler', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_new', orgId: 'org_new' } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

      const singleSpy = vi.fn()
        // First call: org lookup → not found
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116', message: 'not found' } })
        // Second call: insert → returns new org
        .mockResolvedValueOnce({ data: { id: 'uuid-org-new' }, error: null })

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        single: singleSpy,
      }
      vi.mocked(createServerClient).mockReturnValue(mockSupabase as ReturnType<typeof createServerClient>)

      const innerHandler = makeHandler()
      const handler = withAuth(innerHandler)
      const req = makeReq()
      const res = await handler(req, makeCtx())

      expect(res.status).toBe(200)
      expect(innerHandler).toHaveBeenCalledWith(
        req,
        { userId: 'user_new', clerkOrgId: 'org_new', orgId: 'uuid-org-new' },
        {}
      )
      // insert was called
      expect(mockSupabase.insert).toHaveBeenCalledWith({ clerk_org_id: 'org_new' })
    })

    it('returns 403 when org auto-provision insert fails', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_new', orgId: 'org_new' } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

      const singleSpy = vi.fn()
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116', message: 'not found' } })
        .mockResolvedValueOnce({ data: null, error: { code: 'DB_ERR', message: 'insert failed' } })

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        single: singleSpy,
      }
      vi.mocked(createServerClient).mockReturnValue(mockSupabase as ReturnType<typeof createServerClient>)

      const handler = withAuth(makeHandler())
      const res = await handler(makeReq(), makeCtx())

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('auth/org-provision-failed')
    })
  })
})
