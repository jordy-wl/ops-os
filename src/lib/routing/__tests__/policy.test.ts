import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

import { createServerClient } from '@/lib/supabase/server'
import { resolvePolicy } from '../policy'

// ─── Mock DB helper ────────────────────────────────────────────────────────────

function makeDb(...responses: { data: unknown; error: unknown }[]) {
  const queue = [...responses]
  let i = 0

  const singleFn = vi.fn().mockImplementation(() =>
    Promise.resolve(queue[i++] ?? { data: null, error: null })
  )

  const chain: Record<string, unknown> = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
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

const ORG_ID = '00000000-0000-0000-0000-000000000001'
const POLICY_ID = '00000000-0000-0000-0000-000000000010'

describe('resolvePolicy', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns step-level policy when stepPolicyId is provided', async () => {
    makeDb({
      data: {
        id: POLICY_ID,
        name: 'Step Policy',
        metadata: {
          policy_type: 'routing',
          status: 'active',
          routing_mode: 'ai_only',
          confidence_threshold: 0.85,
          risk_routing_map: { low: { mode: 'ai_only', threshold: 0.7 } },
          approval_chain: [],
          max_ai_attempts: 5,
        },
      },
      error: null,
    })

    const result = await resolvePolicy(ORG_ID, { stepPolicyId: POLICY_ID })

    expect(result.policyId).toBe(POLICY_ID)
    expect(result.config.routing_mode).toBe('ai_only')
    expect(result.config.confidence_threshold).toBe(0.85)
    expect(result.config.max_ai_attempts).toBe(5)
  })

  it('falls back to workflow-level policy when step policy not found', async () => {
    const WORKFLOW_POLICY_ID = '00000000-0000-0000-0000-000000000020'
    makeDb(
      { data: null, error: { code: 'PGRST116' } }, // step policy not found
      {
        data: {
          id: WORKFLOW_POLICY_ID,
          name: 'Workflow Policy',
          metadata: {
            policy_type: 'routing',
            status: 'active',
            routing_mode: 'hybrid',
            confidence_threshold: 0.9,
          },
        },
        error: null,
      }
    )

    const result = await resolvePolicy(ORG_ID, {
      stepPolicyId: POLICY_ID,
      workflowPolicyId: WORKFLOW_POLICY_ID,
    })

    expect(result.policyId).toBe(WORKFLOW_POLICY_ID)
    expect(result.config.routing_mode).toBe('hybrid')
  })

  it('falls back to org default when no specific policy provided', async () => {
    makeDb({
      data: [
        {
          id: POLICY_ID,
          name: 'Org Default Policy',
          metadata: {
            policy_type: 'routing',
            status: 'active',
            routing_mode: 'human_only',
            confidence_threshold: 0.95,
          },
        },
        {
          id: '00000000-0000-0000-0000-000000000099',
          name: 'Compliance Policy',
          metadata: {
            policy_type: 'compliance',
            status: 'active',
          },
        },
      ],
      error: null,
    })

    const result = await resolvePolicy(ORG_ID)

    expect(result.policyId).toBe(POLICY_ID)
    expect(result.config.routing_mode).toBe('human_only')
  })

  it('returns default config when no policies exist', async () => {
    makeDb({ data: [], error: null })

    const result = await resolvePolicy(ORG_ID)

    expect(result.policyId).toBeNull()
    expect(result.config.routing_mode).toBe('human_only')
    expect(result.config.confidence_threshold).toBe(1.0)
    expect(result.config.fallback_routing).toBe('human_only')
    expect(result.config.max_ai_attempts).toBe(3)
  })

  it('skips inactive policies when searching for org default', async () => {
    makeDb({
      data: [
        {
          id: POLICY_ID,
          name: 'Archived Policy',
          metadata: {
            policy_type: 'routing',
            status: 'archived',
          },
        },
      ],
      error: null,
    })

    const result = await resolvePolicy(ORG_ID)

    expect(result.policyId).toBeNull()
    expect(result.config.routing_mode).toBe('human_only')
  })

  it('handles missing metadata fields gracefully', async () => {
    makeDb({
      data: {
        id: POLICY_ID,
        name: 'Sparse Policy',
        metadata: {
          policy_type: 'routing',
          status: 'active',
        },
      },
      error: null,
    })

    const result = await resolvePolicy(ORG_ID, { stepPolicyId: POLICY_ID })

    expect(result.policyId).toBe(POLICY_ID)
    expect(result.config.routing_mode).toBe('human_only')
    expect(result.config.confidence_threshold).toBe(1.0)
    expect(result.config.risk_routing_map).toEqual({})
    expect(result.config.approval_chain).toEqual([])
  })
})
