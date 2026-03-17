/**
 * tests/sprint17/google-oauth.test.ts
 *
 * Unit tests for GET /api/auth/google — Google OAuth initiation route.
 * Covers the clerkOrgId fallback path: when clerkOrgId is null, the route
 * falls back to the user's primary org membership via
 * clerk.users.getOrganizationMembershipList().
 *
 * All external dependencies are mocked: Clerk, resolve-org, google-client, logger.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---- Mutable mock state (shared with vi.mock factories) --------------------

const mockState = vi.hoisted(() => ({
  userId: 'user_abc123' as string | null,
  clerkOrgId: 'org_clerk_xyz' as string | null,
  resolvedOrgId: 'uuid-org-1' as string | null,
  memberships: [
    { organization: { id: 'org_clerk_fallback' } },
  ] as Array<{ organization: { id: string } }>,
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=xyz',
}))

// ---- Mocks -----------------------------------------------------------------

vi.mock('@clerk/nextjs/server', () => {
  const mockAuth = () =>
    Promise.resolve({
      userId: mockState.userId,
      orgId: mockState.clerkOrgId,
    })

  const mockClerkClient = () =>
    Promise.resolve({
      users: {
        getOrganizationMembershipList: vi.fn().mockImplementation(() =>
          Promise.resolve({ data: mockState.memberships })
        ),
      },
    })

  return {
    auth: mockAuth,
    clerkClient: mockClerkClient,
  }
})

vi.mock('@/lib/auth/resolve-org', () => ({
  resolveOrgId: vi.fn().mockImplementation(() => Promise.resolve(mockState.resolvedOrgId)),
}))

vi.mock('@/lib/integrations/google-client', () => ({
  getAuthUrl: vi.fn().mockImplementation(() => mockState.authUrl),
}))

vi.mock('@/lib/api/responses', () => ({
  apiError: vi.fn().mockImplementation((message: string, code: string, status: number) => {
    return new Response(JSON.stringify({ data: null, error: { message, code } }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// ---- Import the handler after mocks are wired --------------------------------

import { GET } from '@/app/api/auth/google/route'

// ---- Tests -------------------------------------------------------------------

describe('GET /api/auth/google', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to defaults
    mockState.userId = 'user_abc123'
    mockState.clerkOrgId = 'org_clerk_xyz'
    mockState.resolvedOrgId = 'uuid-org-1'
    mockState.memberships = [{ organization: { id: 'org_clerk_fallback' } }]
    mockState.authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?state=xyz'
  })

  it('should return 401 when userId is null (not authenticated)', async () => {
    mockState.userId = null

    const req = new NextRequest('http://localhost/api/auth/google')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('auth/unauthenticated')
  })

  it('should fall back to primary org when clerkOrgId is null', async () => {
    mockState.clerkOrgId = null
    mockState.memberships = [{ organization: { id: 'org_clerk_fallback' } }]
    mockState.resolvedOrgId = 'uuid-fallback-org'

    const req = new NextRequest('http://localhost/api/auth/google')
    const res = await GET(req)

    // Should redirect (302 or 307)
    expect(res.status).toBeGreaterThanOrEqual(300)
    expect(res.status).toBeLessThan(400)

    const { resolveOrgId } = await import('@/lib/auth/resolve-org')
    expect(resolveOrgId).toHaveBeenCalledWith('org_clerk_fallback')
  })

  it('should return 403 when no org memberships found and clerkOrgId is null', async () => {
    mockState.clerkOrgId = null
    mockState.memberships = []

    const req = new NextRequest('http://localhost/api/auth/google')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('auth/no-org')
    expect(body.error.message).toContain('organization')
  })

  it('should return 403 when resolveOrgId returns null', async () => {
    mockState.resolvedOrgId = null

    const req = new NextRequest('http://localhost/api/auth/google')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('auth/no-org')
  })

  it('should redirect to Google auth URL on success with direct org', async () => {
    const req = new NextRequest('http://localhost/api/auth/google')
    const res = await GET(req)

    // Response.redirect returns a 302
    expect(res.status).toBeGreaterThanOrEqual(300)
    expect(res.status).toBeLessThan(400)

    const { getAuthUrl } = await import('@/lib/integrations/google-client')
    expect(getAuthUrl).toHaveBeenCalledTimes(1)

    // Verify state parameter was encoded
    const callArgs = vi.mocked(getAuthUrl).mock.calls[0]
    const state = callArgs[0]
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString())
    expect(decoded.orgId).toBe('uuid-org-1')
    expect(decoded.userId).toBe('user_abc123')
  })

  it('should redirect to Google auth URL on success with fallback org', async () => {
    mockState.clerkOrgId = null
    mockState.memberships = [{ organization: { id: 'org_clerk_fallback' } }]
    mockState.resolvedOrgId = 'uuid-fallback-org'

    const req = new NextRequest('http://localhost/api/auth/google')
    const res = await GET(req)

    expect(res.status).toBeGreaterThanOrEqual(300)
    expect(res.status).toBeLessThan(400)

    const { getAuthUrl } = await import('@/lib/integrations/google-client')
    expect(getAuthUrl).toHaveBeenCalledTimes(1)

    const callArgs = vi.mocked(getAuthUrl).mock.calls[0]
    const state = callArgs[0]
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString())
    expect(decoded.orgId).toBe('uuid-fallback-org')
    expect(decoded.userId).toBe('user_abc123')
  })

  it('should return 403 when memberships data has null organization id', async () => {
    mockState.clerkOrgId = null
    mockState.memberships = [{ organization: { id: '' } }]
    // An empty string orgId means effectiveClerkOrgId is falsy after the first check,
    // but the code checks ?? null — '' is truthy, so resolveOrgId receives ''
    // and returns null
    mockState.resolvedOrgId = null

    const req = new NextRequest('http://localhost/api/auth/google')
    const res = await GET(req)

    expect(res.status).toBe(403)
  })

  it('should log the fallback when using membership org', async () => {
    mockState.clerkOrgId = null
    mockState.memberships = [{ organization: { id: 'org_clerk_fallback' } }]
    mockState.resolvedOrgId = 'uuid-fallback-org'

    const req = new NextRequest('http://localhost/api/auth/google')
    await GET(req)

    const { logger } = await import('@/lib/logger')
    expect(logger.info).toHaveBeenCalledWith(
      'google-oauth',
      'oauth.fallback_org',
      expect.objectContaining({
        user_id: 'user_abc123',
        org_id: 'org_clerk_fallback',
      })
    )
  })
})
