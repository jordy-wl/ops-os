/**
 * Workflow Template Metrics API — Phase 4, Sprint 12
 *
 * GET /api/workflow-templates/[id]/metrics
 *
 * Returns aggregated metrics for a workflow template:
 *   - total_runs, completed, failed, in_progress
 *   - avg_completion_seconds, median_completion_seconds
 *   - success_rate
 *   - bottleneck_steps (from events)
 *   - daily_runs (last 30 days)
 */

import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError } from '@/lib/api/responses'

function extractTemplateId(url: string): string | null {
  const match = url.match(/\/workflow-templates\/([0-9a-f-]{36})\/metrics/)
  return match?.[1] ?? null
}

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const templateId = extractTemplateId(req.url)
  if (!templateId) return apiError('Missing template ID', 'validation/missing-id', 400)

  const { searchParams } = new URL(req.url)
  const days = Math.min(Math.max(Number(searchParams.get('days') ?? 30), 1), 90)

  const supabase = createServerClient()

  // Verify template exists and belongs to org
  const { data: template } = await supabase
    .from('blocks')
    .select('id, name')
    .eq('id', templateId)
    .eq('org_id', ctx.orgId)
    .eq('type', 'workflow_template')
    .single()

  if (!template) return apiError('Template not found', 'validation/not-found', 404)

  const sinceDate = new Date(Date.now() - days * 86400000).toISOString()

  // Fetch workflow jobs for this template (jobs reference template via payload.template_id or type)
  const { data: jobs } = await supabase
    .from('workflow_jobs')
    .select('id, status, started_at, completed_at, payload, created_at')
    .eq('org_id', ctx.orgId)
    .gte('created_at', sinceDate)
    .order('created_at', { ascending: true })

  // Filter jobs belonging to this template
  const templateJobs = (jobs ?? []).filter((j) => {
    const p = j.payload as Record<string, unknown> | null
    return p?.template_id === templateId
  })

  const total = templateJobs.length
  const completed = templateJobs.filter((j) => j.status === 'done').length
  const failed = templateJobs.filter((j) => j.status === 'failed').length
  const running = templateJobs.filter((j) => j.status === 'running').length
  const pending = templateJobs.filter((j) => j.status === 'pending').length

  // Completion times (seconds)
  const completionTimes = templateJobs
    .filter((j) => j.status === 'done' && j.started_at && j.completed_at)
    .map((j) => (new Date(j.completed_at!).getTime() - new Date(j.started_at!).getTime()) / 1000)
    .sort((a, b) => a - b)

  const avgCompletion = completionTimes.length > 0
    ? Math.round(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length)
    : null

  const medianCompletion = completionTimes.length > 0
    ? Math.round(completionTimes[Math.floor(completionTimes.length / 2)])
    : null

  const successRate = total > 0 ? Math.round((completed / total) * 100) : null

  // Daily runs breakdown (last N days)
  const dailyRuns: { date: string; count: number; completed: number; failed: number }[] = []
  const dayMap = new Map<string, { count: number; completed: number; failed: number }>()

  for (const job of templateJobs) {
    const day = job.created_at.split('T')[0]
    const entry = dayMap.get(day) ?? { count: 0, completed: 0, failed: 0 }
    entry.count++
    if (job.status === 'done') entry.completed++
    if (job.status === 'failed') entry.failed++
    dayMap.set(day, entry)
  }

  for (const [date, stats] of dayMap) {
    dailyRuns.push({ date, ...stats })
  }

  // Bottleneck steps — events with longest avg duration per step
  const { data: stepEvents } = await supabase
    .from('events')
    .select('type, payload, occurred_at')
    .eq('org_id', ctx.orgId)
    .like('type', 'workflow.step.%')
    .gte('occurred_at', sinceDate)

  const stepDurations = new Map<string, number[]>()

  for (const ev of stepEvents ?? []) {
    const p = ev.payload as Record<string, unknown> | null
    if (p?.template_id !== templateId) continue

    const stepName = (p?.step_name as string) ?? 'unknown'
    const durationMs = (p?.duration_ms as number) ?? 0

    if (durationMs > 0) {
      const existing = stepDurations.get(stepName) ?? []
      existing.push(durationMs)
      stepDurations.set(stepName, existing)
    }
  }

  const bottleneckSteps = [...stepDurations.entries()]
    .map(([step, durations]) => ({
      step,
      avg_duration_ms: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      executions: durations.length,
    }))
    .sort((a, b) => b.avg_duration_ms - a.avg_duration_ms)
    .slice(0, 10)

  return ok({
    template_id: templateId,
    template_name: template.name,
    period_days: days,
    total_runs: total,
    completed,
    failed,
    running,
    pending,
    success_rate: successRate,
    avg_completion_seconds: avgCompletion,
    median_completion_seconds: medianCompletion,
    daily_runs: dailyRuns,
    bottleneck_steps: bottleneckSteps,
  })
})
