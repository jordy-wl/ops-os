import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/auth/resolve-org'
import { WorkflowJobsClient } from '@/components/workflows/workflow-jobs-client'
import { WorkflowTemplatesClient } from '@/components/workflows/workflow-templates-client'
import { mapBlockToTemplate } from '@/lib/workflows/template-mapper'
import { WorkflowTabShell } from '@/components/workflows/workflow-tab-shell'
import { logger } from '@/lib/logger'
import type { WorkflowJob } from '@/components/workflows/workflow-jobs-client'

/**
 * WorkflowsPage — server component that fetches workflow templates and jobs.
 *
 * Four parallel concerns handled at render time:
 *   1. workflow_template blocks for this org (template list)
 *   2. workflow_jobs rows for this org (ordered newest first)
 *   3. block names resolved from block_ids (for display in the jobs table)
 *   4. workflow.failed event payloads for any failed jobs (surfaces error reason)
 *
 * Passes pre-fetched data to client components via a tabbed shell.
 */
export default async function WorkflowsPage() {
  const { userId, orgId } = await auth()

  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/org-setup')

  const internalOrgId = await resolveOrgId(orgId)

  const supabase = createServerClient()

  // ── 1. Fetch workflow templates ───────────────────────────────────────────
  const { data: templateBlocks, error: templatesError } = await supabase
    .from('blocks')
    .select('id, name, metadata, created_at')
    .eq('org_id', internalOrgId)
    .eq('type', 'workflow_template')
    .order('created_at', { ascending: false })
    .limit(100)

  if (templatesError) {
    logger.error('workflows-page', 'db.templates_query_failed', {
      error_code: templatesError.code,
      org_id: internalOrgId,
    })
  }

  const initialTemplates = templatesError
    ? null
    : (templateBlocks ?? []).map((b) => mapBlockToTemplate(b as Record<string, unknown>))

  // ── 2. Fetch workflow jobs ────────────────────────────────────────────────
  const { data: jobs, error: jobsError } = await supabase
    .from('workflow_jobs')
    .select('id, block_id, type, status, attempts, scheduled_at, started_at, completed_at, created_at')
    .eq('org_id', internalOrgId)
    .order('scheduled_at', { ascending: false })
    .limit(100)

  if (jobsError) {
    logger.error('workflows-page', 'db.jobs_query_failed', {
      error_code: jobsError.code,
      org_id: internalOrgId,
    })
  }

  let initialJobs: WorkflowJob[] | null = null

  if (!jobsError) {
    // ── 3. Resolve block names ──────────────────────────────────────────────
    const blockIds = [
      ...new Set(
        (jobs ?? [])
          .map((j) => j.block_id)
          .filter((id): id is string => typeof id === 'string')
      ),
    ]

    const blockNameMap = new Map<string, string>()
    if (blockIds.length > 0) {
      const { data: blocks } = await supabase
        .from('blocks')
        .select('id, name')
        .in('id', blockIds)
        .eq('org_id', internalOrgId)
      for (const b of blocks ?? []) blockNameMap.set(b.id, b.name)
    }

    // ── 4. Fetch last error reason for failed jobs ──────────────────────────
    const failedJobIds = (jobs ?? []).filter((j) => j.status === 'failed').map((j) => j.id)
    const errorMap = new Map<string, string>()

    if (failedJobIds.length > 0) {
      const { data: failedEvents } = await supabase
        .from('events')
        .select('payload, occurred_at')
        .eq('org_id', internalOrgId)
        .eq('type', 'workflow.failed')
        .order('occurred_at', { ascending: false })

      for (const event of failedEvents ?? []) {
        const payload = event.payload as Record<string, unknown> | null
        const jobId = payload?.job_id as string | undefined
        if (jobId && !errorMap.has(jobId)) {
          errorMap.set(jobId, (payload?.reason as string | undefined) ?? 'Unknown error')
        }
      }
    }

    // ── Build typed job list ────────────────────────────────────────────────
    initialJobs = (jobs ?? []).map((j) => ({
      id:            j.id,
      block_id:      j.block_id ?? null,
      workflow_type: j.type,
      status:        j.status as WorkflowJob['status'],
      attempts:      j.attempts,
      scheduled_at:  j.scheduled_at,
      claimed_at:    j.started_at ?? null,
      completed_at:  j.completed_at ?? null,
      created_at:    j.created_at,
      block_name:    j.block_id ? (blockNameMap.get(j.block_id) ?? null) : null,
      last_error:    errorMap.get(j.id) ?? null,
    }))
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold text-foreground mb-6">Workflows</h1>
      <WorkflowTabShell
        templatesPanel={<WorkflowTemplatesClient initialTemplates={initialTemplates} />}
        jobsPanel={<WorkflowJobsClient initialJobs={initialJobs} />}
        templateIds={(templateBlocks ?? []).map((b) => b.id)}
      />
    </div>
  )
}
