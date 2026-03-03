/**
 * tests/api/workflow.test.ts — Workflow Engine Contract Tests (BE-01)
 *
 * Tests run against a REAL local Supabase instance.
 * Requires: supabase start + SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Also requires the 20260302000003_workflow_engine migration to be applied:
 *   npm run db:reset   (or supabase db reset)
 *
 * QA-01 will extend these tests with concurrency and full lifecycle coverage.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'
import { hasSupabase, getTestSupabase } from './helpers'

// ─── Auth mock (same pattern as blocks / events contract tests) ───────────────
const ctx = vi.hoisted(() => ({
  orgId:      '',
  userId:     'user_workflow_test',
  clerkOrgId: '',
}))

vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: vi.fn(
    (handler) =>
      async (req: NextRequest, context: { params: Promise<Record<string, string>> }) =>
        handler(req, { userId: ctx.userId, clerkOrgId: ctx.clerkOrgId, orgId: ctx.orgId },
          await (context.params ?? Promise.resolve({})))
  ),
}))

vi.mock('@/lib/supabase/server', async () => {
  const { createClient } = await import('@supabase/supabase-js')
  return {
    createServerClient: () =>
      createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      ),
  }
})

import { POST as actionsPost } from '@/app/api/actions/[type]/route'
import { GET  as workflowJobsGet } from '@/app/api/workflow-jobs/route'
import { runProcessingCycle } from '@/lib/workflow/engine'

describe.skipIf(!hasSupabase)('Workflow Engine — contract tests (real Supabase)', () => {
  beforeAll(async () => {
    const supabase = getTestSupabase()

    // Create a test org for this suite
    const clerkId = `org_workflow_test_${Date.now()}`
    const { data: org } = await supabase
      .from('orgs')
      .insert({ clerk_org_id: clerkId, name: 'Workflow Test Org' })
      .select('id')
      .single()

    ctx.orgId      = org!.id
    ctx.clerkOrgId = clerkId
  })

  it('onboarding.start action creates a workflow_job with status = pending', async () => {
    const req = new NextRequest('http://localhost/api/actions/onboarding.start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientName: 'Test Client Alpha', jurisdiction: 'UK' }),
    })

    const res  = await actionsPost(req, { params: Promise.resolve({ type: 'onboarding.start' }) })
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.data.workflowJobId).toBeTypeOf('string')
    expect(json.data.status).toBe('pending')
  })

  it('runProcessingCycle picks up pending job and transitions it to done', async () => {
    // Enqueue a new onboarding job
    const req = new NextRequest('http://localhost/api/actions/onboarding.start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientName: 'Test Client Beta', jurisdiction: 'UK' }),
    })
    const actionRes  = await actionsPost(req, { params: Promise.resolve({ type: 'onboarding.start' }) })
    const actionJson = await actionRes.json()
    const jobId      = actionJson.data.workflowJobId as string

    const supabase = getTestSupabase()
    await runProcessingCycle(supabase)

    // Job should now be done
    const { data: job } = await supabase
      .from('workflow_jobs')
      .select('status, completed_at')
      .eq('id', jobId)
      .single()

    expect(job?.status).toBe('done')
    expect(job?.completed_at).not.toBeNull()
  })

  it('workflow.completed event is created with the correct org_id after job succeeds', async () => {
    const req = new NextRequest('http://localhost/api/actions/onboarding.start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientName: 'Test Client Gamma' }),
    })
    const actionRes  = await actionsPost(req, { params: Promise.resolve({ type: 'onboarding.start' }) })
    const actionJson = await actionRes.json()
    const jobId      = actionJson.data.workflowJobId as string

    const supabase = getTestSupabase()
    await runProcessingCycle(supabase)

    const { data: event } = await supabase
      .from('events')
      .select('type, org_id, actor_type')
      .eq('org_id', ctx.orgId)
      .eq('type', 'workflow.completed')
      .order('occurred_at', { ascending: false })
      .limit(1)
      .single()

    expect(event?.type).toBe('workflow.completed')
    expect(event?.org_id).toBe(ctx.orgId)
    expect(event?.actor_type).toBe('system')

    // Suppress unused var warning
    void jobId
  })

  it('GET /api/workflow-jobs returns correct status for org; no cross-org jobs visible', async () => {
    const req = new NextRequest(
      `http://localhost/api/workflow-jobs?status=done`,
      { method: 'GET' }
    )

    const res  = await workflowJobsGet(req, { params: Promise.resolve({}) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.workflow_jobs).toBeInstanceOf(Array)
    // All returned jobs must belong to this org
    for (const job of json.data.workflow_jobs) {
      expect(job.org_id).toBe(ctx.orgId)
    }
  })

  it('GET /api/workflow-jobs returns 400 for invalid status value', async () => {
    const req = new NextRequest(
      `http://localhost/api/workflow-jobs?status=invalid_status`,
      { method: 'GET' }
    )

    const res  = await workflowJobsGet(req, { params: Promise.resolve({}) })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('validation/invalid-status')
  })

  it('job with unregistered workflow type is immediately marked failed (no retries)', async () => {
    // Inserts a pending job with a type that has no handler in WORKFLOW_REGISTRY.
    // Bypasses the actions API (which only creates 'onboarding' type) via service-role
    // client — legitimate for contract tests that need to probe engine edge cases.
    const supabase = getTestSupabase()

    const { data: job } = await supabase
      .from('workflow_jobs')
      .insert({
        org_id:       ctx.orgId,
        type:         'unregistered_test_type',
        status:       'pending',
        payload:      {},
        scheduled_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    expect(job).not.toBeNull()
    const jobId = job!.id

    await runProcessingCycle(supabase)

    const { data: updated } = await supabase
      .from('workflow_jobs')
      .select('status, attempts')
      .eq('id', jobId)
      .single()

    // Engine must immediately mark failed — no retry loop for unknown types
    expect(updated?.status).toBe('failed')
    expect(updated?.attempts).toBe(1) // markFailed called exactly once
  })

  it('concurrent engine cycles do not double-process the same job (FOR UPDATE SKIP LOCKED)', async () => {
    // Enqueue exactly one new job
    const req = new NextRequest('http://localhost/api/actions/onboarding.start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientName: 'Concurrency Test Client', jurisdiction: 'AU' }),
    })
    const actionRes  = await actionsPost(req, { params: Promise.resolve({ type: 'onboarding.start' }) })
    const actionJson = await actionRes.json()
    const jobId      = actionJson.data.workflowJobId as string

    const supabase = getTestSupabase()

    // Two concurrent processing cycles — the claim_workflow_job() RPC uses
    // FOR UPDATE SKIP LOCKED so only one connection can claim the same job
    await Promise.all([
      runProcessingCycle(supabase),
      runProcessingCycle(supabase),
    ])

    // The job must be done
    const { data: job } = await supabase
      .from('workflow_jobs')
      .select('status')
      .eq('id', jobId)
      .single()

    expect(job?.status).toBe('done')

    // The engine emits workflow.completed on success. Double-processing would
    // produce 2 events for this job_id — verify exactly 1 exists.
    const { data: completionEvents } = await supabase
      .from('events')
      .select('payload')
      .eq('org_id', ctx.orgId)
      .eq('type', 'workflow.completed')

    const forThisJob = (completionEvents ?? []).filter(
      (e) => (e.payload as { job_id?: string }).job_id === jobId
    )
    expect(forThisJob).toHaveLength(1)
  })
})
