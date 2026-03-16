import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock Supabase before importing modules that use it ─────────────────────

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { createServerClient } from '@/lib/supabase/server'
import {
  getOrgRoutingPolicy,
  upsertOrgRoutingPolicy,
  RoutingPolicyInputSchema,
} from '../policy-settings'

// ─── Test Constants ─────────────────────────────────────────────────────────

const ORG_ID = '00000000-0000-0000-0000-000000000001'
const USER_ID = 'user_test_123'
const POLICY_ID = '00000000-0000-0000-0000-000000000010'

const VALID_CONFIG = {
  routing_mode: 'hybrid' as const,
  confidence_threshold: 0.7,
  risk_routing_map: {
    low: { mode: 'ai_only' as const, threshold: 0.5 },
    medium: { mode: 'hybrid' as const, threshold: 0.7 },
    high: { mode: 'human_only' as const, threshold: 1.0 },
    critical: { mode: 'escalation_chain' as const, threshold: 1.0 },
  },
  approval_chain: [],
  fallback_routing: 'human_only' as const,
  max_ai_attempts: 3,
}

// ─── Mock DB Helpers ────────────────────────────────────────────────────────

/**
 * Creates a Supabase chain mock. Each call to a terminal method (then/single)
 * dequeues the next response. This supports multiple sequential queries.
 */
function makeDb(...responses: { data: unknown; error: unknown }[]) {
  const queue = [...responses]
  let i = 0

  const singleFn = vi.fn().mockImplementation(() =>
    Promise.resolve(queue[i++] ?? { data: null, error: null })
  )

  const chain: Record<string, unknown> = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: singleFn,
    then: (resolve: (v: unknown) => void, reject: (r: unknown) => void) =>
      Promise.resolve(queue[i++] ?? { data: [], error: null }).then(resolve, reject),
  }

  vi.mocked(createServerClient).mockReturnValue(chain as unknown as ReturnType<typeof createServerClient>)
  return { chain, singleFn }
}

// ─── Tests: RoutingPolicyInputSchema ────────────────────────────────────────

describe('RoutingPolicyInputSchema', () => {
  it('accepts a valid complete config', () => {
    const result = RoutingPolicyInputSchema.safeParse(VALID_CONFIG)
    expect(result.success).toBe(true)
  })

  it('rejects confidence_threshold > 1', () => {
    const result = RoutingPolicyInputSchema.safeParse({
      ...VALID_CONFIG,
      confidence_threshold: 1.5,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('confidence_threshold')
    }
  })

  it('rejects confidence_threshold < 0', () => {
    const result = RoutingPolicyInputSchema.safeParse({
      ...VALID_CONFIG,
      confidence_threshold: -0.1,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('confidence_threshold')
    }
  })

  it('rejects incomplete risk_routing_map (missing levels)', () => {
    const result = RoutingPolicyInputSchema.safeParse({
      ...VALID_CONFIG,
      risk_routing_map: {
        low: { mode: 'ai_only', threshold: 0.5 },
        medium: { mode: 'hybrid', threshold: 0.7 },
        // missing high and critical
      },
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid routing_mode', () => {
    const result = RoutingPolicyInputSchema.safeParse({
      ...VALID_CONFIG,
      routing_mode: 'invalid_mode',
    })
    expect(result.success).toBe(false)
  })

  it('applies defaults for optional fields', () => {
    const result = RoutingPolicyInputSchema.safeParse({
      routing_mode: 'hybrid',
      confidence_threshold: 0.7,
      risk_routing_map: VALID_CONFIG.risk_routing_map,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.approval_chain).toEqual([])
      expect(result.data.fallback_routing).toBe('human_only')
      expect(result.data.max_ai_attempts).toBe(3)
    }
  })

  it('rejects risk entry threshold > 1', () => {
    const result = RoutingPolicyInputSchema.safeParse({
      ...VALID_CONFIG,
      risk_routing_map: {
        ...VALID_CONFIG.risk_routing_map,
        low: { mode: 'ai_only', threshold: 1.5 },
      },
    })
    expect(result.success).toBe(false)
  })
})

// ─── Tests: getOrgRoutingPolicy ─────────────────────────────────────────────

describe('getOrgRoutingPolicy', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns defaults when no policy blocks exist', async () => {
    makeDb({ data: [], error: null })

    const result = await getOrgRoutingPolicy(ORG_ID)

    expect(result.policy_id).toBeNull()
    expect(result.routing_mode).toBe('human_only')
    expect(result.confidence_threshold).toBe(1.0)
    expect(result.fallback_routing).toBe('human_only')
    expect(result.max_ai_attempts).toBe(3)
  })

  it('returns defaults when DB query fails', async () => {
    makeDb({ data: null, error: { code: 'UNKNOWN' } })

    const result = await getOrgRoutingPolicy(ORG_ID)

    expect(result.policy_id).toBeNull()
    expect(result.routing_mode).toBe('human_only')
  })

  it('returns config from active routing policy block', async () => {
    makeDb({
      data: [
        {
          id: POLICY_ID,
          name: 'Org Routing Policy',
          metadata: {
            policy_type: 'routing',
            status: 'active',
            routing_mode: 'hybrid',
            confidence_threshold: 0.8,
            risk_routing_map: VALID_CONFIG.risk_routing_map,
            approval_chain: [],
            max_ai_attempts: 5,
          },
        },
      ],
      error: null,
    })

    const result = await getOrgRoutingPolicy(ORG_ID)

    expect(result.policy_id).toBe(POLICY_ID)
    expect(result.routing_mode).toBe('hybrid')
    expect(result.confidence_threshold).toBe(0.8)
    expect(result.max_ai_attempts).toBe(5)
  })

  it('skips non-routing and inactive policy blocks', async () => {
    makeDb({
      data: [
        {
          id: '00000000-0000-0000-0000-000000000099',
          name: 'Compliance Policy',
          metadata: { policy_type: 'compliance', status: 'active' },
        },
        {
          id: '00000000-0000-0000-0000-000000000098',
          name: 'Archived Routing Policy',
          metadata: { policy_type: 'routing', status: 'archived' },
        },
      ],
      error: null,
    })

    const result = await getOrgRoutingPolicy(ORG_ID)

    expect(result.policy_id).toBeNull()
    expect(result.routing_mode).toBe('human_only')
  })
})

// ─── Tests: upsertOrgRoutingPolicy ──────────────────────────────────────────

describe('upsertOrgRoutingPolicy', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a new policy block when none exists', async () => {
    const NEW_POLICY_ID = '00000000-0000-0000-0000-000000000020'
    makeDb(
      // First query: find existing policies — none
      { data: [], error: null },
      // Second query: insert new block
      { data: { id: NEW_POLICY_ID }, error: null }
    )

    const result = await upsertOrgRoutingPolicy(ORG_ID, USER_ID, VALID_CONFIG)

    expect(result.policy_id).toBe(NEW_POLICY_ID)
    expect(result.routing_mode).toBe('hybrid')
    expect(result.confidence_threshold).toBe(0.7)
  })

  it('updates existing active policy block', async () => {
    makeDb(
      // First query: find existing policies — one active routing policy
      {
        data: [
          {
            id: POLICY_ID,
            metadata: { policy_type: 'routing', status: 'active' },
          },
        ],
        error: null,
      },
      // Second query: update succeeds
      { data: null, error: null }
    )

    const updatedConfig = {
      ...VALID_CONFIG,
      routing_mode: 'ai_only' as const,
      confidence_threshold: 0.9,
    }

    const result = await upsertOrgRoutingPolicy(ORG_ID, USER_ID, updatedConfig)

    expect(result.policy_id).toBe(POLICY_ID)
    expect(result.routing_mode).toBe('ai_only')
    expect(result.confidence_threshold).toBe(0.9)
  })

  it('throws when insert fails', async () => {
    makeDb(
      // First query: no existing policies
      { data: [], error: null },
      // Second query: insert fails
      { data: null, error: { code: 'DB_ERROR' } }
    )

    await expect(
      upsertOrgRoutingPolicy(ORG_ID, USER_ID, VALID_CONFIG)
    ).rejects.toThrow('Failed to create routing policy')
  })

  it('throws when update fails', async () => {
    const { chain } = makeDb(
      // First query: existing active policy
      {
        data: [
          {
            id: POLICY_ID,
            metadata: { policy_type: 'routing', status: 'active' },
          },
        ],
        error: null,
      }
    )

    // Override the then handler for the update call to return an error
    // The update path does not call .single(), it resolves via the chainable .then
    // We need the second .then call to return an error
    let thenCallCount = 0
    chain.then = (resolve: (v: unknown) => void, reject: (r: unknown) => void) => {
      thenCallCount++
      if (thenCallCount === 1) {
        // First: find policies query
        return Promise.resolve({
          data: [{ id: POLICY_ID, metadata: { policy_type: 'routing', status: 'active' } }],
          error: null,
        }).then(resolve, reject)
      }
      // Second: update query fails
      return Promise.resolve({ data: null, error: { code: 'DB_ERROR' } }).then(resolve, reject)
    }

    await expect(
      upsertOrgRoutingPolicy(ORG_ID, USER_ID, VALID_CONFIG)
    ).rejects.toThrow('Failed to update routing policy')
  })
})
