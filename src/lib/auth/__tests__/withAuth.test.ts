import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/rbac/resolve', () => ({
  resolvePermissions: vi.fn(),
}))

import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { resolvePermissions } from '@/lib/rbac/resolve'
import { withAuth, AuthContext } from '@/lib/auth/withAuth'
import type { Permission } from '@/lib/rbac/types'

// ─── Helpers ────────────────────────────────────────────────────────────────

const makeReq = () => new NextRequest('http://localhost/api/test')
const makeCtx = (params: Record<string, string> = {}) => ({ params: Promise.resolve(params) })
const makeHandler = () =>
  vi.fn<(req: NextRequest, ctx: AuthContext, params: Record<string, string>) => Promise<NextResponse>>().mockResolvedValue(
    NextResponse.json({ data: 'ok' }, { status: 200 })
  )

const ALL_PERMS = new Set<Permission>([
  'manage_blocks', 'edit_blocks', 'view_blocks', 'manage_workflows',
  'execute_workflows', 'approve_tasks', 'manage_team', 'manage_settings',
  'manage_integrations', 'view_audit_log',
])

const USER_PERMS = new Set<Permission>([
  'view_blocks', 'edit_blocks', 'execute_workflows', 'approve_tasks', 'view_audit_log',
])

type MockResult = { data: unknown; error: unknown }

/**
 * Build a Supabase mock for org lookup/insert only.
 * Role resolution is handled by the mocked resolvePermissions module.
 */
function makeSupabaseMock({ orgsResult }: { orgsResult: MockResult | MockResult[] }) {
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
    update: vi.fn().mockReturnThis(),
    single: orgsSingle,
  }

  const mock = { from: vi.fn().mockReturnValue(orgsChain) }

  vi.mocked(createServerClient).mockReturnValue(mock as unknown as ReturnType<typeof createServerClient>)
  return { orgsChain, mock }
}

describe('withAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: resolvePermissions returns ops-admin with all permissions
    vi.mocked(resolvePermissions).mockResolvedValue({
      role: 'ops-admin',
      roleId: 'role-uuid-admin',
      permissions: ALL_PERMS,
    })
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
    it('calls handler with correct AuthContext including permissions when org exists', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_111', orgId: 'org_abc' } as unknown as (ReturnType<typeof auth> extends Promise<infer T> ? T : never))
      makeSupabaseMock({ orgsResult: { data: { id: 'uuid-org-1', name: 'Test Org' }, error: null } })

      const innerHandler = makeHandler()
      const handler = withAuth(innerHandler)
      const req = makeReq()
      const res = await handler(req, makeCtx())

      expect(res.status).toBe(200)
      expect(resolvePermissions).toHaveBeenCalledWith(
        expect.anything(), 'uuid-org-1', 'user_111', 'ops-user'
      )
      expect(innerHandler).toHaveBeenCalledWith(
        req,
        {
          userId: 'user_111', clerkOrgId: 'org_abc', orgId: 'uuid-org-1',
          role: 'ops-admin', roleId: 'role-uuid-admin', permissions: ALL_PERMS,
        },
        {}
      )
    })

    it('passes awaited params to handler for dynamic routes', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_111', orgId: 'org_abc' } as unknown as (ReturnType<typeof auth> extends Promise<infer T> ? T : never))
      makeSupabaseMock({ orgsResult: { data: { id: 'uuid-org-1', name: 'Test Org' }, error: null } })

      const innerHandler = makeHandler()
      const handler = withAuth(innerHandler)
      const req = makeReq()
      await handler(req, { params: Promise.resolve({ id: 'block-xyz' }) })

      expect(innerHandler).toHaveBeenCalledWith(
        req,
        expect.objectContaining({ orgId: 'uuid-org-1', role: 'ops-admin', permissions: ALL_PERMS }),
        { id: 'block-xyz' }
      )
    })
  })

  describe('org auto-provisioning', () => {
    it('creates org row on first login and calls handler with ops-admin permissions', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_new', orgId: 'org_new' } as unknown as (ReturnType<typeof auth> extends Promise<infer T> ? T : never))

      const { orgsChain } = makeSupabaseMock({
        orgsResult: [
          { data: null, error: { code: 'PGRST116', message: 'not found' } }, // org lookup → not found
          { data: { id: 'uuid-org-new' }, error: null },                      // org insert → success
        ],
      })

      const innerHandler = makeHandler()
      const handler = withAuth(innerHandler)
      const req = makeReq()
      const res = await handler(req, makeCtx())

      expect(res.status).toBe(200)
      expect(orgsChain.insert).toHaveBeenCalledWith({ clerk_org_id: 'org_new' })
      expect(resolvePermissions).toHaveBeenCalledWith(
        expect.anything(), 'uuid-org-new', 'user_new', 'ops-admin'
      )
      expect(innerHandler).toHaveBeenCalledWith(
        req,
        expect.objectContaining({ userId: 'user_new', orgId: 'uuid-org-new', role: 'ops-admin' }),
        {}
      )
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

  describe('RBAC permission resolution', () => {
    it('passes ops-user permissions when resolvePermissions returns ops-user', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_111', orgId: 'org_abc' } as unknown as (ReturnType<typeof auth> extends Promise<infer T> ? T : never))
      makeSupabaseMock({ orgsResult: { data: { id: 'uuid-org-1', name: 'Test Org' }, error: null } })

      vi.mocked(resolvePermissions).mockResolvedValueOnce({
        role: 'ops-user', roleId: 'role-uuid-user', permissions: USER_PERMS,
      })

      const innerHandler = makeHandler()
      await withAuth(innerHandler)(makeReq(), makeCtx())

      expect(innerHandler).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ role: 'ops-user', roleId: 'role-uuid-user', permissions: USER_PERMS }),
        expect.anything()
      )
    })

    it('passes compliance-approver permissions when resolvePermissions returns compliance-approver', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_111', orgId: 'org_abc' } as unknown as (ReturnType<typeof auth> extends Promise<infer T> ? T : never))
      makeSupabaseMock({ orgsResult: { data: { id: 'uuid-org-1', name: 'Test Org' }, error: null } })

      const approverPerms = new Set<Permission>(['view_blocks', 'approve_tasks', 'view_audit_log'])
      vi.mocked(resolvePermissions).mockResolvedValueOnce({
        role: 'compliance-approver', roleId: 'role-uuid-approver', permissions: approverPerms,
      })

      const innerHandler = makeHandler()
      await withAuth(innerHandler)(makeReq(), makeCtx())

      expect(innerHandler).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ role: 'compliance-approver', permissions: approverPerms }),
        expect.anything()
      )
    })

    it('uses ops-user as default role for existing orgs', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_new', orgId: 'org_abc' } as unknown as (ReturnType<typeof auth> extends Promise<infer T> ? T : never))
      makeSupabaseMock({ orgsResult: { data: { id: 'uuid-org-1', name: 'Test Org' }, error: null } })

      await withAuth(makeHandler())(makeReq(), makeCtx())

      expect(resolvePermissions).toHaveBeenCalledWith(
        expect.anything(), 'uuid-org-1', 'user_new', 'ops-user'
      )
    })

    it('uses ops-admin as default role for newly created orgs', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_creator', orgId: 'org_new' } as unknown as (ReturnType<typeof auth> extends Promise<infer T> ? T : never))
      makeSupabaseMock({
        orgsResult: [
          { data: null, error: { code: 'PGRST116', message: 'not found' } },
          { data: { id: 'uuid-org-new' }, error: null },
        ],
      })

      await withAuth(makeHandler())(makeReq(), makeCtx())

      expect(resolvePermissions).toHaveBeenCalledWith(
        expect.anything(), 'uuid-org-new', 'user_creator', 'ops-admin'
      )
    })
  })
})
