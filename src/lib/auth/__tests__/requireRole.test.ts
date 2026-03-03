import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import type { AuthContext } from '@/lib/auth/withAuth'

const makeReq = () => new NextRequest('http://localhost/api/test')

const makeCtx = (role: AuthContext['role']): AuthContext => ({
  userId: 'user_111',
  clerkOrgId: 'org_abc',
  orgId: 'uuid-org-1',
  role,
})

const okHandler = vi.fn<Parameters<typeof requireRole>[1]>().mockResolvedValue(
  NextResponse.json({ data: 'ok' }, { status: 200 })
)

describe('requireRole', () => {
  beforeEach(() => vi.clearAllMocks())

  it('passes ops-admin through when in allowed list', async () => {
    const handler = requireRole(['ops-admin', 'ops-user'], okHandler)
    const res = await handler(makeReq(), makeCtx('ops-admin'), {})

    expect(res.status).toBe(200)
    expect(okHandler).toHaveBeenCalledOnce()
  })

  it('passes ops-user through when in allowed list', async () => {
    const handler = requireRole(['ops-admin', 'ops-user'], okHandler)
    const res = await handler(makeReq(), makeCtx('ops-user'), {})

    expect(res.status).toBe(200)
    expect(okHandler).toHaveBeenCalledOnce()
  })

  it('returns 403 for compliance-approver when not in allowed list', async () => {
    const handler = requireRole(['ops-admin', 'ops-user'], okHandler)
    const res = await handler(makeReq(), makeCtx('compliance-approver'), {})

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('auth/insufficient-role')
    expect(body.data).toBeNull()
    expect(okHandler).not.toHaveBeenCalled()
  })

  it('passes compliance-approver through when included in allowed list', async () => {
    const handler = requireRole(['compliance-approver'], okHandler)
    const res = await handler(makeReq(), makeCtx('compliance-approver'), {})

    expect(res.status).toBe(200)
    expect(okHandler).toHaveBeenCalledOnce()
  })

  it('returns 403 for ops-user when only ops-admin is allowed', async () => {
    const handler = requireRole(['ops-admin'], okHandler)
    const res = await handler(makeReq(), makeCtx('ops-user'), {})

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('auth/insufficient-role')
    expect(okHandler).not.toHaveBeenCalled()
  })
})
