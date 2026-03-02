import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { onboardingHandler } from '@/lib/workflow/handlers/onboarding'

// ─── Supabase mock factory ─────────────────────────────────────────────────

function makeSupabase(insertError: { message: string } | null = null) {
  const insert = vi.fn().mockResolvedValue({ data: null, error: insertError })
  const from   = vi.fn().mockReturnValue({ insert })
  return {
    from,
    _insert: insert,
    _from:   from,
  } as unknown as SupabaseClient & { _insert: typeof insert; _from: typeof from }
}

const BASE_CTX = {
  jobId:   'job-uuid-1',
  orgId:   'org-uuid-1',
  blockId: 'block-uuid-1',
  payload: { client_name: 'Thornfield Capital', jurisdiction: 'UK' },
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('onboardingHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates 3 events in order: document.requested, kyc.check.started, aml.check.started', async () => {
    const supabase = makeSupabase()

    await onboardingHandler({ ...BASE_CTX, supabase })

    expect(supabase._from).toHaveBeenCalledTimes(3)
    expect(supabase._insert).toHaveBeenCalledTimes(3)

    const calls = supabase._insert.mock.calls
    expect(calls[0][0]).toMatchObject({ type: 'document.requested', block_id: BASE_CTX.blockId })
    expect(calls[1][0]).toMatchObject({ type: 'kyc.check.started',  block_id: BASE_CTX.blockId })
    expect(calls[2][0]).toMatchObject({ type: 'aml.check.started',  block_id: BASE_CTX.blockId })
  })

  it('all events have actor_type = "system" and the correct org_id', async () => {
    const supabase = makeSupabase()

    await onboardingHandler({ ...BASE_CTX, supabase })

    for (const call of supabase._insert.mock.calls) {
      expect(call[0]).toMatchObject({
        actor_type: 'system',
        org_id:     BASE_CTX.orgId,
      })
    }
  })

  it('includes workflow_job_id and jurisdiction in event payload', async () => {
    const supabase = makeSupabase()

    await onboardingHandler({ ...BASE_CTX, supabase })

    for (const call of supabase._insert.mock.calls) {
      expect(call[0].payload).toMatchObject({
        workflow_job_id: BASE_CTX.jobId,
        jurisdiction:    'UK',
      })
    }
  })

  it('throws when block_id is null', async () => {
    const supabase = makeSupabase()

    await expect(
      onboardingHandler({ ...BASE_CTX, blockId: null, supabase })
    ).rejects.toThrow('onboarding handler requires a block_id')
  })

  it('throws when an event insert fails (stops at first failure)', async () => {
    const supabase = makeSupabase({ message: 'DB insert failed' })

    await expect(
      onboardingHandler({ ...BASE_CTX, supabase })
    ).rejects.toThrow('document.requested')

    // Only one insert attempted before the throw
    expect(supabase._insert).toHaveBeenCalledTimes(1)
  })

  it('handles missing jurisdiction gracefully (null in payload)', async () => {
    const supabase = makeSupabase()
    const ctx = { ...BASE_CTX, payload: { client_name: 'Acme Ltd' } }

    await onboardingHandler({ ...ctx, supabase })

    for (const call of supabase._insert.mock.calls) {
      expect(call[0].payload.jurisdiction).toBeNull()
    }
  })
})
