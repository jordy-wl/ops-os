/**
 * Workflow Optimization Suggestions API — Phase 4, Sprint 12
 *
 * GET /api/workflow-templates/[id]/optimize
 *
 * Analyzes workflow template vs actual execution data and returns
 * AI-generated optimization suggestions.
 */

import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'

function extractTemplateId(url: string): string | null {
  const match = url.match(/\/workflow-templates\/([0-9a-f-]{36})\/optimize/)
  return match?.[1] ?? null
}

interface Suggestion {
  type: 'remove_step' | 'optimize_step' | 'reorder' | 'add_condition' | 'routing_change' | 'general'
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  step_name?: string
  evidence: string
}

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const templateId = extractTemplateId(req.url)
  if (!templateId) return apiError('Missing template ID', 'validation/missing-id', 400)

  const supabase = createServerClient()

  // Fetch template
  const { data: template } = await supabase
    .from('blocks')
    .select('id, name, metadata')
    .eq('id', templateId)
    .eq('org_id', ctx.orgId)
    .eq('type', 'workflow_template')
    .single()

  if (!template) return apiError('Template not found', 'validation/not-found', 404)

  const meta = template.metadata as Record<string, unknown>
  const steps = (meta.steps ?? []) as { name: string; type: string; config?: Record<string, unknown> }[]

  // Fetch recent jobs for this template (last 90 days)
  const sinceDate = new Date(Date.now() - 90 * 86400000).toISOString()

  const { data: jobs } = await supabase
    .from('workflow_jobs')
    .select('id, status, started_at, completed_at, payload')
    .eq('org_id', ctx.orgId)
    .gte('created_at', sinceDate)

  const templateJobs = (jobs ?? []).filter((j) => {
    const p = j.payload as Record<string, unknown> | null
    return p?.template_id === templateId
  })

  // Fetch step-level events
  const { data: stepEvents } = await supabase
    .from('events')
    .select('type, payload, occurred_at')
    .eq('org_id', ctx.orgId)
    .like('type', 'workflow.step.%')
    .gte('occurred_at', sinceDate)

  const relevantEvents = (stepEvents ?? []).filter((ev) => {
    const p = ev.payload as Record<string, unknown> | null
    return p?.template_id === templateId
  })

  // Analyze and generate suggestions
  const suggestions: Suggestion[] = []

  const totalRuns = templateJobs.length
  const failedRuns = templateJobs.filter((j) => j.status === 'failed').length
  // completedRuns intentionally removed — not used in current analysis

  // 1. High failure rate
  if (totalRuns >= 5 && failedRuns / totalRuns > 0.3) {
    suggestions.push({
      type: 'general',
      severity: 'critical',
      title: 'High failure rate detected',
      description: `${Math.round((failedRuns / totalRuns) * 100)}% of runs have failed. Review error logs and consider adding error handling or retry logic.`,
      evidence: `${failedRuns}/${totalRuns} runs failed in the last 90 days`,
    })
  }

  // 2. Step-level analysis
  const stepExecutions = new Map<string, { count: number; failures: number; totalMs: number }>()

  for (const ev of relevantEvents) {
    const p = ev.payload as Record<string, unknown>
    const stepName = p.step_name as string
    const durationMs = (p.duration_ms as number) ?? 0
    const failure = ev.type === 'workflow.step.failed'

    const entry = stepExecutions.get(stepName) ?? { count: 0, failures: 0, totalMs: 0 }
    entry.count++
    if (failure) entry.failures++
    entry.totalMs += durationMs
    stepExecutions.set(stepName, entry)
  }

  // Find steps that never executed (potentially unused)
  for (const step of steps) {
    const exec = stepExecutions.get(step.name)
    if (!exec && totalRuns >= 3) {
      suggestions.push({
        type: 'remove_step',
        severity: 'warning',
        title: `Step "${step.name}" never executed`,
        description: `This step has not been reached in any of the ${totalRuns} recent runs. It may be unreachable due to conditions, or it could be removed.`,
        step_name: step.name,
        evidence: `0 executions across ${totalRuns} workflow runs`,
      })
    }
  }

  // Find bottleneck steps (avg > 30s)
  for (const [stepName, data] of stepExecutions) {
    const avgMs = data.count > 0 ? data.totalMs / data.count : 0

    if (avgMs > 30000 && data.count >= 3) {
      suggestions.push({
        type: 'optimize_step',
        severity: 'warning',
        title: `Step "${stepName}" is slow`,
        description: `Average execution time is ${(avgMs / 1000).toFixed(1)}s. Consider optimizing the step logic, reducing external API timeouts, or running it asynchronously.`,
        step_name: stepName,
        evidence: `Avg ${(avgMs / 1000).toFixed(1)}s across ${data.count} executions`,
      })
    }

    // Step failure rate
    if (data.failures > 0 && data.count >= 3 && data.failures / data.count > 0.2) {
      suggestions.push({
        type: 'optimize_step',
        severity: 'critical',
        title: `Step "${stepName}" frequently fails`,
        description: `${Math.round((data.failures / data.count) * 100)}% failure rate. Add error handling, increase retry count, or verify the step configuration.`,
        step_name: stepName,
        evidence: `${data.failures}/${data.count} executions failed`,
      })
    }
  }

  // 3. Completion time analysis
  const completionTimes = templateJobs
    .filter((j) => j.status === 'done' && j.started_at && j.completed_at)
    .map((j) => (new Date(j.completed_at!).getTime() - new Date(j.started_at!).getTime()) / 1000)

  if (completionTimes.length >= 5) {
    const avg = completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
    const sorted = [...completionTimes].sort((a, b) => a - b)
    const p90 = sorted[Math.floor(sorted.length * 0.9)]

    if (p90 > avg * 2.5) {
      suggestions.push({
        type: 'general',
        severity: 'info',
        title: 'Inconsistent completion times',
        description: `The p90 completion time (${(p90 / 60).toFixed(1)} min) is much higher than average (${(avg / 60).toFixed(1)} min). Some runs may be hitting edge cases that cause delays.`,
        evidence: `Avg: ${(avg / 60).toFixed(1)}min, P90: ${(p90 / 60).toFixed(1)}min across ${completionTimes.length} completed runs`,
      })
    }
  }

  // 4. Auto-routing suggestion
  const hasConditions = steps.some((s) => s.type === 'condition')
  if (!hasConditions && steps.length > 5) {
    suggestions.push({
      type: 'add_condition',
      severity: 'info',
      title: 'Consider adding conditional logic',
      description: `This workflow has ${steps.length} steps but no conditions. Adding If/Else branches could skip unnecessary steps and improve efficiency.`,
      evidence: `${steps.length} sequential steps with no branching`,
    })
  }

  // Sort by severity
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 }
  suggestions.sort((a, b) => (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2))

  logger.info('api-workflow-optimize', 'suggestions.generated', {
    template_id: templateId,
    total_runs: totalRuns,
    suggestion_count: suggestions.length,
  })

  return ok({
    template_id: templateId,
    template_name: template.name,
    total_runs: totalRuns,
    analysis_period_days: 90,
    suggestions,
  })
})
