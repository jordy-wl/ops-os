'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface WorkflowJob {
  id: string
  block_id: string | null
  workflow_type: string
  status: 'pending' | 'running' | 'done' | 'failed'
  attempts: number
  scheduled_at: string
  claimed_at: string | null
  completed_at: string | null
  created_at: string
  block_name: string | null
  last_error: string | null
}

interface StepResult {
  step_name: string
  step_type: string
  status: 'completed' | 'failed' | 'waiting'
  output?: Record<string, unknown>
  error?: string
  executed_at: string
}

interface InstanceDetail {
  status: string
  current_step_index: number
  step_results: StepResult[]
  started_at: string | null
  completed_at: string | null
}

type StatusFilter = 'all' | 'pending' | 'running' | 'done' | 'failed'

const STATUS_STYLES: Record<WorkflowJob['status'], string> = {
  pending: 'bg-warning/10 text-warning',
  running: 'bg-primary/10 text-primary',
  done:    'bg-success/10 text-success',
  failed:  'bg-destructive/10 text-destructive',
}

const STEP_STATUS_STYLES: Record<string, string> = {
  completed: 'bg-success/10 text-success',
  failed:    'bg-destructive/10 text-destructive',
  waiting:   'bg-warning/10 text-warning',
}

const FILTERS: StatusFilter[] = ['all', 'pending', 'running', 'done', 'failed']

const POLL_INTERVAL_MS = 10_000

function formatDate(iso: string | null): string {
  if (!iso) return '\u2014'
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function formatWorkflowType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

interface WorkflowJobsClientProps {
  initialJobs: WorkflowJob[] | null
}

/**
 * WorkflowJobsClient — renders the workflow jobs list with client-side status filtering
 * and auto-refresh polling when active (pending/running) jobs exist.
 */
export function WorkflowJobsClient({ initialJobs }: WorkflowJobsClientProps) {
  const [jobs, setJobs] = useState<WorkflowJob[] | null>(initialJobs)
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all')
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)
  const [instanceDetails, setInstanceDetails] = useState<Record<string, InstanceDetail>>({})
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const hasActiveJobs = jobs?.some((j) => j.status === 'pending' || j.status === 'running') ?? false

  // Auto-refresh: poll /api/workflow-engine/jobs every 10s when active jobs exist
  const refreshJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/workflows/jobs')
      if (!res.ok) return
      const json = await res.json()
      if (json.data) setJobs(json.data)
    } catch {
      // Silent fail — polling will retry
    }
  }, [])

  useEffect(() => {
    if (hasActiveJobs) {
      pollRef.current = setInterval(refreshJobs, POLL_INTERVAL_MS)
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [hasActiveJobs, refreshJobs])

  // Fetch instance detail (step results) when a row is expanded
  const toggleDetail = useCallback(async (job: WorkflowJob) => {
    if (expandedJobId === job.id) {
      setExpandedJobId(null)
      return
    }
    setExpandedJobId(job.id)

    if (!job.block_id || instanceDetails[job.id]) return

    try {
      const res = await fetch(`/api/blocks/${job.block_id}`)
      if (!res.ok) return
      const json = await res.json()
      const meta = json.data?.metadata as InstanceDetail | undefined
      if (meta?.step_results) {
        setInstanceDetails((prev) => ({ ...prev, [job.id]: meta }))
      }
    } catch {
      // Silent fail
    }
  }, [expandedJobId, instanceDetails])

  if (!jobs) {
    return (
      <div
        className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center"
        role="alert"
        aria-live="assertive"
      >
        <p className="text-sm font-medium text-destructive">Failed to load workflows.</p>
        <p className="mt-1 text-[13px] text-destructive">Refresh the page to try again.</p>
      </div>
    )
  }

  const filtered =
    activeFilter === 'all'
      ? jobs
      : jobs.filter((j) => j.status === activeFilter)

  return (
    <div>
      {/* Status filter buttons */}
      <div
        className="flex flex-wrap items-center gap-2 mb-6"
        role="group"
        aria-label="Filter workflows by status"
      >
        {FILTERS.map((f) => {
          const count = f === 'all' ? jobs.length : jobs.filter((j) => j.status === f).length
          return (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              aria-pressed={activeFilter === f}
              className={cn(
                'h-8 px-3 rounded-md text-[13px] font-medium capitalize transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                activeFilter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background border border-border text-foreground hover:bg-muted'
              )}
            >
              {f}
              {count > 0 && (
                <span className="ml-1.5 text-xs opacity-70">({count})</span>
              )}
            </button>
          )
        })}

        {/* Auto-refresh indicator */}
        {hasActiveJobs && (
          <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">
            Auto-refreshing
          </span>
        )}
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          {jobs.length === 0 ? (
            <>
              <p className="text-title text-foreground mb-2">No workflows yet</p>
              <p className="text-[13px] text-muted-foreground mb-6">
                Trigger an onboarding workflow from any block to get started.
              </p>
              <Link
                href="/blocks"
                className={cn(
                  'px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium',
                  'hover:bg-primary/80 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                )}
              >
                Go to Blocks
              </Link>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No workflows match this filter.{' '}
              <button
                onClick={() => setActiveFilter('all')}
                className="underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                Show all
              </button>
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[700px] text-sm" aria-label="Workflow jobs">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide w-8" />
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Workflow
                </th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Block
                </th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Status
                </th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Created
                </th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Completed
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {filtered.map((job) => {
                const isExpanded = expandedJobId === job.id
                const detail = instanceDetails[job.id]

                return (
                  <JobRow
                    key={job.id}
                    job={job}
                    isExpanded={isExpanded}
                    detail={detail}
                    onToggle={() => toggleDetail(job)}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Job Row with expandable detail ─────────────────────────────────────────

interface JobRowProps {
  job: WorkflowJob
  isExpanded: boolean
  detail: InstanceDetail | undefined
  onToggle: () => void
}

function JobRow({ job, isExpanded, detail, onToggle }: JobRowProps) {
  return (
    <>
      <tr
        className={cn('hover:bg-muted transition-colors cursor-pointer', isExpanded && 'bg-muted')}
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        {/* Expand toggle */}
        <td className="px-4 py-2 text-muted-foreground">
          <span className={cn('inline-block transition-transform', isExpanded && 'rotate-90')} aria-hidden="true">
            &#9654;
          </span>
        </td>

        {/* Workflow type */}
        <td className="px-4 py-2 text-[13px] font-medium text-foreground whitespace-nowrap">
          {formatWorkflowType(job.workflow_type)}
        </td>

        {/* Block link */}
        <td className="px-4 py-2 text-[13px]">
          {job.block_id ? (
            <Link
              href={`/blocks/${job.block_id}`}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'text-blue-700 dark:text-blue-400 hover:underline',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded'
              )}
              aria-label={`View block: ${job.block_name ?? job.block_id}`}
            >
              {job.block_name ?? job.block_id}
            </Link>
          ) : (
            <span className="text-muted-foreground">{'\u2014'}</span>
          )}
        </td>

        {/* Status badge + failure details */}
        <td className="px-4 py-2">
          <div className="flex flex-col gap-1">
            <span className={cn(
              'inline-flex self-start rounded-full px-2 py-0.5 text-xs font-medium capitalize',
              STATUS_STYLES[job.status]
            )}>
              {job.status}
            </span>
            {job.status === 'failed' && (
              <div className="text-xs text-destructive space-y-0.5">
                <span>Attempts: {job.attempts}</span>
                {job.last_error && (
                  <p className="text-destructive max-w-xs truncate" title={job.last_error}>
                    {job.last_error}
                  </p>
                )}
              </div>
            )}
          </div>
        </td>

        {/* Created at */}
        <td className="px-4 py-2 text-[13px] text-muted-foreground whitespace-nowrap">
          <time dateTime={job.created_at}>{formatDate(job.created_at)}</time>
        </td>

        {/* Completed at */}
        <td className="px-4 py-2 text-[13px] text-muted-foreground whitespace-nowrap">
          {job.completed_at ? (
            <time dateTime={job.completed_at}>{formatDate(job.completed_at)}</time>
          ) : (
            <span className="text-muted-foreground">{'\u2014'}</span>
          )}
        </td>
      </tr>

      {/* Expanded detail row — step results timeline */}
      {isExpanded && (
        <tr>
          <td colSpan={6} className="px-4 py-4 bg-muted border-t border-border">
            {detail ? (
              <StepTimeline detail={detail} />
            ) : job.block_id ? (
              <p className="text-xs text-muted-foreground animate-pulse">Loading step results...</p>
            ) : (
              <p className="text-xs text-muted-foreground">No instance detail available for this job.</p>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Step Results Timeline ──────────────────────────────────────────────────

function StepTimeline({ detail }: { detail: InstanceDetail }) {
  if (detail.step_results.length === 0) {
    return <p className="text-xs text-muted-foreground">No steps executed yet.</p>
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <span className={cn(
          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
          detail.status === 'done' ? 'bg-success/10 text-success'
            : detail.status === 'failed' ? 'bg-destructive/10 text-destructive'
            : detail.status === 'running' ? 'bg-primary/10 text-primary'
            : 'bg-warning/10 text-warning'
        )}>
          {detail.status}
        </span>
        <span className="text-xs text-muted-foreground">
          Step {detail.current_step_index + 1} of {detail.step_results.length + (detail.status === 'running' ? 1 : 0)}
        </span>
        {detail.started_at && (
          <span className="text-xs text-muted-foreground">
            Started: {formatDate(detail.started_at)}
          </span>
        )}
      </div>

      <ol className="relative border-l border-border ml-2 space-y-3">
        {detail.step_results.map((step, i) => (
          <li key={i} className="ml-4">
            <div className={cn(
              'absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white dark:border-gray-900',
              step.status === 'completed' ? 'bg-success'
                : step.status === 'failed' ? 'bg-destructive'
                : 'bg-warning'
            )} />
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {step.step_name.replace(/_/g, ' ')}
              </span>
              <span className={cn(
                'inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize',
                STEP_STATUS_STYLES[step.status] ?? 'bg-muted text-muted-foreground'
              )}>
                {step.status}
              </span>
              <span className="text-[10px] text-muted-foreground">{step.step_type}</span>
            </div>
            {step.error && (
              <p className="text-xs text-destructive mt-0.5">{step.error}</p>
            )}
            {step.output && Object.keys(step.output).length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {Object.entries(step.output).map(([k, v]) => `${k}: ${v}`).join(', ')}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(step.executed_at)}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
