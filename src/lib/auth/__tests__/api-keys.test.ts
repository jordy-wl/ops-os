import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { AuthContext } from '@/lib/auth/withAuth'
import type { Permission } from '@/lib/rbac/types'

// ─── Mock auth ─────────────────────────────────────────────────────────────────

const mockState = vi.hoisted(() => ({
  permissions: new Set<string>([
    'manage_blocks', 'edit_blocks', 'view_blocks', 'manage_workflows',
    'execute_workflows', 'approve_tasks', 'manage_team', 'manage_settings',
    'manage_integrations', 'view_audit_log',
  ]),
}))

const ALL_PERMS = new Set<Permission>([
  'manage_blocks', 'edit_blocks', 'view_blocks', 'manage_workflows',
  'execute_workflows', 'approve_tasks', 'manage_team', 'manage_settings',
  'manage_integrations', 'view_audit_log',
])

const USER_PERMS = new Set<Permission>([
  'view_blocks', 'edit_blocks', 'execute_workflows', 'approve_tasks', 'view_audit_log',
])

vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: vi.fn(
    (handler: (req: NextRequest, ctx: AuthContext, params: Record<string, string>) => Promise<Response>) =>
      async (req: NextRequest, context: { params: Promise<Record<string, string>> }) => {
        const params = await context.params
        return handler(
          req,
          {
            userId: 'user_111', clerkOrgId: 'org_abc', orgId: 'uuid-org-1',
            role: 'ops-admin' as const, roleId: 'role-uuid-admin',
            permissions: mockState.permissions as Set<Permission>,
          },
          params
        )
      }
  ),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

import { createServerClient } from '@/lib/supabase/server'

// ─── Mock DB helper ────────────────────────────────────────────────────────────

function makeDb(...responses: { data: unknown; error: unknown }[]) {
  const queue = [...responses]
  let i = 0

  const singleFn = vi.fn().mockImplementation(() =>
    Promise.resolve(queue[i++] ?? { data: null, error: null })
  )

  const thenFn = (resolve: (v: unknown) => void, reject: (r: unknown) => void) =>
    Promise.resolve(queue[i++] ?? { data: [], error: null }).then(resolve, reject)

  const chain: Record<string, unknown> = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: singleFn,
    then: thenFn,
  }

  vi.mocked(createServerClient).mockReturnValue(chain as unknown as ReturnType<typeof createServerClient>)
  return { chain, singleFn }
}

const makeReq = (url = 'http://localhost/api/keys', opts?: RequestInit) =>
  new NextRequest(url, opts as ConstructorParameters<typeof NextRequest>[1])

// ─── Import modules after mocks ─────────────────────────────────────────────

const { generateApiKey, hashApiKey } = await import('@/lib/auth/api-keys')
const { GET: listKeys, POST: createKey } = await import('@/app/api/keys/route')
const { DELETE: deleteKey } = await import('@/app/api/keys/[id]/route')

const KEY_ID = '00000000-0000-0000-0000-000000000099'

// ─── Unit tests for key utilities ───────────────────────────────────────────

describe('generateApiKey', () => {
  it('produces key with ops_ prefix and 32 hex chars', () => {
    const { key, prefix, hash } = generateApiKey()

    expect(key).toMatch(/^ops_[0-9a-f]{32}$/)
    expect(key.length).toBe(36) // 'ops_' (4) + 32 hex chars
    expect(prefix).toBe(key.substring(0, 8))
    expect(hash).toBeTruthy()
    expect(hash.length).toBe(64) // SHA-256 hex digest = 64 chars
  })

  it('produces unique keys on repeated calls', () => {
    const a = generateApiKey()
    const b = generateApiKey()

    expect(a.key).not.toBe(b.key)
    expect(a.hash).not.toBe(b.hash)
  })
})

describe('hashApiKey', () => {
  it('returns deterministic SHA-256 hex digest', () => {
    const key = 'ops_abcdef1234567890abcdef12345678'
    const hash1 = hashApiKey(key)
    const hash2 = hashApiKey(key)

    expect(hash1).toBe(hash2)
    expect(hash1.length).toBe(64)
    expect(hash1).toMatch(/^[0-9a-f]{64}$/)
  })

  it('produces different hashes for different keys', () => {
    const hashA = hashApiKey('ops_aaaa')
    const hashB = hashApiKey('ops_bbbb')

    expect(hashA).not.toBe(hashB)
  })
})

describe('key prefix extraction', () => {
  it('prefix is first 8 characters of the key', () => {
    const { key, prefix } = generateApiKey()

    expect(prefix).toBe(key.substring(0, 8))
    expect(prefix.length).toBe(8)
    expect(prefix.startsWith('ops_')).toBe(true)
  })
})

// ─── POST /api/keys — createApiKey stores hash, not cleartext ───────────────

describe('POST /api/keys', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.permissions = ALL_PERMS
  })

  it('creates a key and returns full key once — 201', async () => {
    const { chain } = makeDb(
      { data: { id: KEY_ID }, error: null },  // single: insert api_key
      { data: null, error: null },             // insert: event
    )

    const req = makeReq('http://localhost/api/keys', {
      method: 'POST',
      body: JSON.stringify({ name: 'My Integration Key' }),
    })
    const res = await createKey(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.key).toMatch(/^ops_[0-9a-f]{32}$/)
    expect(body.data.key_id).toBe(KEY_ID)
    expect(body.data.prefix).toBe(body.data.key.substring(0, 8))

    // Verify the insert call used a hash, not the cleartext key
    const insertCalls = vi.mocked(chain.insert as ReturnType<typeof vi.fn>).mock.calls
    expect(insertCalls.length).toBeGreaterThan(0)
    const insertedRow = insertCalls[0][0] as Record<string, unknown>
    // The inserted row should have key_hash, not a 'key' field
    expect(insertedRow).toHaveProperty('key_hash')
    expect(insertedRow).not.toHaveProperty('key')
    // key_hash should be a 64-char hex string (SHA-256)
    expect(String(insertedRow.key_hash)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('returns 400 for missing name', async () => {
    const req = makeReq('http://localhost/api/keys', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await createKey(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON', async () => {
    const req = makeReq('http://localhost/api/keys', {
      method: 'POST',
      body: 'not json',
      headers: { 'content-type': 'application/json' },
    })
    const res = await createKey(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(400)
  })

  it('returns 403 when user lacks manage_settings permission', async () => {
    mockState.permissions = USER_PERMS

    const req = makeReq('http://localhost/api/keys', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
    })
    const res = await createKey(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(403)
  })

  it('returns 500 when DB insert fails', async () => {
    makeDb({ data: null, error: { code: 'DB_ERR' } })

    const req = makeReq('http://localhost/api/keys', {
      method: 'POST',
      body: JSON.stringify({ name: 'Fail Key' }),
    })
    const res = await createKey(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(500)
  })
})

// ─── GET /api/keys — listApiKeys returns masked keys ────────────────────────

describe('GET /api/keys', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.permissions = ALL_PERMS
  })

  it('returns masked keys for the org', async () => {
    const keys = [
      { id: 'k1', name: 'Prod Key', key_prefix: 'ops_ab12', created_by: 'user_111', created_at: '2026-03-01', revoked_at: null, last_used_at: '2026-03-10', rate_limit: 100 },
      { id: 'k2', name: 'Test Key', key_prefix: 'ops_cd34', created_by: 'user_222', created_at: '2026-03-02', revoked_at: '2026-03-05', last_used_at: null, rate_limit: 50 },
    ]
    makeDb({ data: keys, error: null })

    const res = await listKeys(makeReq(), { params: Promise.resolve({}) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.keys).toHaveLength(2)
    expect(body.data.keys[0].display_key).toBe('ops_ab12****')
    expect(body.data.keys[1].display_key).toBe('ops_cd34****')
    // Verify no full key is returned
    for (const key of body.data.keys) {
      expect(key).not.toHaveProperty('key')
      expect(key).not.toHaveProperty('key_hash')
    }
  })

  it('returns 403 when user lacks manage_settings', async () => {
    mockState.permissions = USER_PERMS

    const res = await listKeys(makeReq(), { params: Promise.resolve({}) })
    expect(res.status).toBe(403)
  })

  it('returns 500 on DB error', async () => {
    makeDb({ data: null, error: { code: 'DB_ERR' } })

    const res = await listKeys(makeReq(), { params: Promise.resolve({}) })
    expect(res.status).toBe(500)
  })
})

// ─── DELETE /api/keys/:id — revokeApiKey sets revoked_at ────────────────────

describe('DELETE /api/keys/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.permissions = ALL_PERMS
  })

  it('revokes an active key — returns 200', async () => {
    makeDb(
      { data: { id: KEY_ID, key_prefix: 'ops_ab12', revoked_at: null }, error: null }, // single: fetch key
      { data: null, error: null },  // update: set revoked_at
      { data: null, error: null },  // insert: event
    )

    const res = await deleteKey(
      makeReq(`http://localhost/api/keys/${KEY_ID}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: KEY_ID }) }
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.revoked).toBe(true)
    expect(body.data.key_id).toBe(KEY_ID)
  })

  it('returns 404 for unknown key', async () => {
    makeDb({ data: null, error: { code: 'PGRST116' } })

    const res = await deleteKey(
      makeReq(`http://localhost/api/keys/unknown`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'unknown' }) }
    )
    expect(res.status).toBe(404)
  })

  it('returns 409 when key is already revoked', async () => {
    makeDb({
      data: { id: KEY_ID, key_prefix: 'ops_ab12', revoked_at: '2026-03-10T00:00:00Z' },
      error: null,
    })

    const res = await deleteKey(
      makeReq(`http://localhost/api/keys/${KEY_ID}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: KEY_ID }) }
    )
    expect(res.status).toBe(409)
  })

  it('returns 403 when user lacks manage_settings', async () => {
    mockState.permissions = USER_PERMS

    const res = await deleteKey(
      makeReq(`http://localhost/api/keys/${KEY_ID}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: KEY_ID }) }
    )
    expect(res.status).toBe(403)
  })
})

// ─── Validation rejects revoked keys ────────────────────────────────────────

describe('validateApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.permissions = ALL_PERMS
  })

  it('returns valid: false for a revoked key', async () => {
    // Need to re-import to get fresh mock context
    const { validateApiKey } = await import('@/lib/auth/api-keys')

    makeDb({
      data: { id: KEY_ID, revoked_at: '2026-03-10T00:00:00Z' },
      error: null,
    })

    const result = await validateApiKey('ops_abcdef1234567890abcdef12345678', 'uuid-org-1')
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.reason).toBe('Key has been revoked')
    }
  })

  it('returns valid: false when key not found', async () => {
    const { validateApiKey } = await import('@/lib/auth/api-keys')

    makeDb({ data: null, error: { code: 'PGRST116' } })

    const result = await validateApiKey('ops_nonexistent12345678901234567', 'uuid-org-1')
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.reason).toBe('Key not found')
    }
  })

  it('returns valid: true for an active key', async () => {
    const { validateApiKey } = await import('@/lib/auth/api-keys')

    makeDb(
      { data: { id: KEY_ID, revoked_at: null }, error: null }, // single: fetch key
      { data: null, error: null },  // update: last_used_at
    )

    const result = await validateApiKey('ops_abcdef1234567890abcdef12345678', 'uuid-org-1')
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.keyId).toBe(KEY_ID)
    }
  })
})
