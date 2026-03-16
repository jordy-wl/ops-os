import { describe, it, expect, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac/middleware'
import type { AuthContext, RouteHandler } from '@/lib/auth/withAuth'
import type { Permission } from '@/lib/rbac/types'

const ALL_PERMS = new Set<Permission>([
  'manage_blocks', 'edit_blocks', 'view_blocks', 'manage_workflows',
  'execute_workflows', 'approve_tasks', 'manage_team', 'manage_settings',
  'manage_integrations', 'view_audit_log',
])

const USER_PERMS = new Set<Permission>([
  'view_blocks', 'edit_blocks', 'execute_workflows', 'approve_tasks', 'view_audit_log',
])

const makeCtx = (permissions: Set<Permission>): AuthContext => ({
  userId: 'user_111',
  clerkOrgId: 'org_abc',
  orgId: 'uuid-org-1',
  role: 'ops-admin',
  roleId: 'role-uuid',
  permissions,
})

const makeReq = () => new NextRequest('http://localhost/api/test')
const makeHandler = (): RouteHandler =>
  vi.fn<RouteHandler>().mockResolvedValue(
    NextResponse.json({ data: 'ok' }, { status: 200 })
  )

describe('requirePermission', () => {
  it('passes through when user has all required permissions', async () => {
    const inner = makeHandler()
    const handler = requirePermission(['manage_blocks'], inner)
    const ctx = makeCtx(ALL_PERMS)

    const res = await handler(makeReq(), ctx, {})
    expect(res.status).toBe(200)
    expect(inner).toHaveBeenCalledOnce()
  })

  it('passes through when multiple permissions are all present', async () => {
    const inner = makeHandler()
    const handler = requirePermission(['manage_blocks', 'manage_settings'], inner)
    const ctx = makeCtx(ALL_PERMS)

    const res = await handler(makeReq(), ctx, {})
    expect(res.status).toBe(200)
    expect(inner).toHaveBeenCalledOnce()
  })

  it('returns 403 when user lacks a required permission', async () => {
    const inner = makeHandler()
    const handler = requirePermission(['manage_blocks'], inner)
    const ctx = makeCtx(USER_PERMS) // ops-user has no manage_blocks

    const res = await handler(makeReq(), ctx, {})
    expect(res.status).toBe(403)

    const body = await res.json()
    expect(body.error.code).toBe('auth/insufficient-permission')
    expect(body.error.message).toContain('manage_blocks')
    expect(inner).not.toHaveBeenCalled()
  })

  it('returns 403 when user has only some of multiple required permissions', async () => {
    const inner = makeHandler()
    const handler = requirePermission(['view_blocks', 'manage_blocks'], inner)
    const ctx = makeCtx(USER_PERMS) // has view_blocks but not manage_blocks

    const res = await handler(makeReq(), ctx, {})
    expect(res.status).toBe(403)
    expect(inner).not.toHaveBeenCalled()
  })

  it('passes through with empty required permissions array', async () => {
    const inner = makeHandler()
    const handler = requirePermission([], inner)
    const ctx = makeCtx(new Set())

    const res = await handler(makeReq(), ctx, {})
    expect(res.status).toBe(200)
    expect(inner).toHaveBeenCalledOnce()
  })

  it('forwards request, context, and params to inner handler', async () => {
    const inner = makeHandler()
    const handler = requirePermission(['view_blocks'], inner)
    const req = makeReq()
    const ctx = makeCtx(ALL_PERMS)
    const params = { id: 'block-xyz' }

    await handler(req, ctx, params)
    expect(inner).toHaveBeenCalledWith(req, ctx, params)
  })
})
