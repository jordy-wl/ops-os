import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Mock the workflow registry so we control handler behaviour ───────────────
const mockHandlers = vi.hoisted(() => ({
  success_workflow: vi.fn().mockResolvedValue(undefined),
  failing_workflow: vi.fn().mockRejectedValue(new Error('handler error')),
}))

vi.mock('@/lib/workflow/registry', () => ({
  WORKFLOW_REGISTRY: {
    success_workflow: mockHandlers.success_workflow,
    failing_workflow: mockHandlers.failing_workflow,
  },
}))

import { processNextJob } from '@/lib/workflow/engine'
import type { WorkflowJob } from '@/lib/workflow/types'

// ─── Supabase mock factory ────────────────────────────────────────────────────

function makeJob(overrides: Partial<WorkflowJob> = {}): WorkflowJob {
  return {
    id:           'job-uuid-1',
    org_id:       'org-uuid-1',
    block_id:     'block-uuid-1',
    type:         'success_workflow',
    status:       'running',
    payload:      {},
    attempts:     0,
    scheduled_at: new Date().toISOString(),
    started_at:   new Date().toISOString(),
    completed_at: null,
    created_at:   new Date().toISOString(),
    updated_at:   new Date().toISOString(),
    ...overrides,
  }
}

interface MockOptions {
  rpcData?:    WorkflowJob[] | null
  rpcError?:   { code: string } | null
  updateError?: { code: string; message: string } | null
  insertError?: { code: string; message: string } | null
}

function makeSupabase({
  rpcData    = null,
  rpcError   = null,
  updateError = null,
  insertError = null,
}: MockOptions = {}) {
  const eq     = vi.fn().mockResolvedValue({ data: null, error: updateError })
  const update = vi.fn().mockReturnValue({ eq })
  const insert = vi.fn().mockResolvedValue({ data: null, error: insertError })
  const from   = vi.fn().mockReturnValue({ update, insert })
  const rpc    = vi.fn().mockResolvedValue({ data: rpcData, error: rpcError })

  return {
    rpc,
    from,
    _eq:     eq,
    _update: update,
    _insert: insert,
    _from:   from,
  } as unknown as SupabaseClient & {
    _eq: typeof eq
    _update: typeof update
    _insert: typeof insert
    _from: typeof from
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('processNextJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHandlers.success_workflow.mockResolvedValue(undefined)
    mockHandlers.failing_workflow.mockRejectedValue(new Error('handler error'))
  })

  // ── No pending jobs ────────────────────────────────────────────────────────

  it('returns false when no jobs are pending (empty rpc result)', async () => {
    const supabase = makeSupabase({ rpcData: [] })
    const result = await processNextJob(supabase)
    expect(result).toBe(false)
    expect((supabase as ReturnType<typeof makeSupabase>)._from).not.toHaveBeenCalled()
  })

  it('returns false when rpc returns null data', async () => {
    const supabase = makeSupabase({ rpcData: null })
    const result = await processNextJob(supabase)
    expect(result).toBe(false)
  })

  it('returns false when rpc claim errors', async () => {
    const supabase = makeSupabase({ rpcError: { code: 'PGRST500' } })
    const result = await processNextJob(supabase)
    expect(result).toBe(false)
    expect((supabase as ReturnType<typeof makeSupabase>)._from).not.toHaveBeenCalled()
  })

  // ── Success path ───────────────────────────────────────────────────────────

  it('returns true and calls handler when job is claimed', async () => {
    const job = makeJob({ type: 'success_workflow' })
    const supabase = makeSupabase({ rpcData: [job] })
    const result = await processNextJob(supabase)

    expect(result).toBe(true)
    expect(mockHandlers.success_workflow).toHaveBeenCalledOnce()
    expect(mockHandlers.success_workflow).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: job.id, orgId: job.org_id, blockId: job.block_id })
    )
  })

  it('marks job done and emits workflow.completed event on success', async () => {
    const job = makeJob({ type: 'success_workflow', block_id: 'block-uuid-1' })
    const supabase = makeSupabase({ rpcData: [job] }) as ReturnType<typeof makeSupabase>

    await processNextJob(supabase)

    // update call: status → 'done'
    expect(supabase._update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'done', completed_at: expect.any(String) })
    )
    // insert call: workflow.completed event
    expect(supabase._insert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'workflow.completed', org_id: job.org_id, block_id: job.block_id })
    )
  })

  it('does NOT emit workflow.completed event when job has no block_id', async () => {
    const job = makeJob({ type: 'success_workflow', block_id: null })
    const supabase = makeSupabase({ rpcData: [job] }) as ReturnType<typeof makeSupabase>

    await processNextJob(supabase)

    expect(supabase._update).toHaveBeenCalledWith(expect.objectContaining({ status: 'done' }))
    expect(supabase._insert).not.toHaveBeenCalled()
  })

  // ── Unknown handler ────────────────────────────────────────────────────────

  it('marks job failed immediately when no handler is registered', async () => {
    const job = makeJob({ type: 'unknown_type' })
    const supabase = makeSupabase({ rpcData: [job] }) as ReturnType<typeof makeSupabase>

    const result = await processNextJob(supabase)

    expect(result).toBe(true)
    expect(supabase._update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' })
    )
  })

  // ── Failure + retry logic ──────────────────────────────────────────────────

  it('reschedules job when handler fails and attempts < 3', async () => {
    const job = makeJob({ type: 'failing_workflow', attempts: 0 })
    const supabase = makeSupabase({ rpcData: [job] }) as ReturnType<typeof makeSupabase>

    await processNextJob(supabase)

    expect(supabase._update).toHaveBeenCalledWith(
      expect.objectContaining({
        status:   'pending',
        attempts: 1,
        scheduled_at: expect.any(String),
      })
    )
    // No workflow.failed event on retry
    expect(supabase._insert).not.toHaveBeenCalled()
  })

  it('reschedules with attempts = 2 on second failure', async () => {
    const job = makeJob({ type: 'failing_workflow', attempts: 1 })
    const supabase = makeSupabase({ rpcData: [job] }) as ReturnType<typeof makeSupabase>

    await processNextJob(supabase)

    expect(supabase._update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending', attempts: 2 })
    )
  })

  // ── 3-strike permanent failure ─────────────────────────────────────────────

  it('marks job permanently failed when attempts reaches 3', async () => {
    const job = makeJob({ type: 'failing_workflow', attempts: 2 })
    const supabase = makeSupabase({ rpcData: [job] }) as ReturnType<typeof makeSupabase>

    await processNextJob(supabase)

    expect(supabase._update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', attempts: 3 })
    )
    // workflow.failed event emitted because job has a block_id
    expect(supabase._insert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'workflow.failed', org_id: job.org_id })
    )
  })

  it('does NOT emit workflow.failed event when job has no block_id', async () => {
    const job = makeJob({ type: 'failing_workflow', attempts: 2, block_id: null })
    const supabase = makeSupabase({ rpcData: [job] }) as ReturnType<typeof makeSupabase>

    await processNextJob(supabase)

    expect(supabase._update).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }))
    expect(supabase._insert).not.toHaveBeenCalled()
  })
})
