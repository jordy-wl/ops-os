'use client'

import { useState } from 'react'
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

type StatusFilter = 'all' | 'pending' | 'running' | 'done' | 'failed'

const STATUS_STYLES: Record<WorkflowJob['status'], string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  running: 'bg-blue-100 text-blue-800',
  done:    'bg-green-100 text-green-800',
  failed:  'bg-red-100 text-red-800',
}

const FILTERS: StatusFilter[] = ['all', 'pending', 'running', 'done', 'failed']

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function formatWorkflowType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

interface WorkflowJobsClientProps {
  initialJobs: WorkflowJob[] | null
}

/**
 * WorkflowJobsClient — renders the workflow jobs list with client-side status filtering.
 *
 * Receives pre-fetched data from the server component. No additional network requests
 * for filtering — all filter logic runs in the browser against the initial dataset.
 *
 * @param initialJobs - Pre-fetched workflow jobs (null = SSR error state)
 */
export function WorkflowJobsClient({ initialJobs }: WorkflowJobsClientProps) {
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all')

  if (!initialJobs) {
    return (
      <div
        className="rounded-lg border border-red-200 bg-red-50 p-6 text-center"
        role="alert"
        aria-live="assertive"
      >
        <p className="text-sm font-medium text-red-800">Failed to load workflows.</p>
        <p className="mt-1 text-sm text-red-600">
          Refresh the page to try again.
        </p>
      </div>
    )
  }

  const filtered =
    activeFilter === 'all'
      ? initialJobs
      : initialJobs.filter((j) => j.status === activeFilter)

  return (
    <div>
      {/* Status filter buttons */}
      <div
        className="flex flex-wrap gap-2 mb-6"
        role="group"
        aria-label="Filter workflows by status"
      >
        {FILTERS.map((f) => {
          const count = f === 'all' ? initialJobs.length : initialJobs.filter((j) => j.status === f).length
          return (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              aria-pressed={activeFilter === f}
              className={cn(
                'h-9 px-3 rounded-md text-sm font-medium capitalize transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900',
                activeFilter === f
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              )}
            >
              {f}
              {count > 0 && (
                <span className="ml-1.5 text-xs opacity-70">({count})</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          {initialJobs.length === 0 ? (
            <>
              <p className="text-lg font-semibold text-gray-900 mb-2">No workflows yet</p>
              <p className="text-sm text-gray-500 mb-6">
                Trigger an onboarding workflow from any block to get started.
              </p>
              <Link
                href="/blocks"
                className={cn(
                  'px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium',
                  'hover:bg-gray-700 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900'
                )}
              >
                Go to Blocks
              </Link>
            </>
          ) : (
            <p className="text-sm text-gray-500">
              No workflows match this filter.{' '}
              <button
                onClick={() => setActiveFilter('all')}
                className="underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 rounded"
              >
                Show all
              </button>
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm" aria-label="Workflow jobs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                >
                  Workflow
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                >
                  Block
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                >
                  Created
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                >
                  Completed
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filtered.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                  {/* Workflow type */}
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                    {formatWorkflowType(job.workflow_type)}
                  </td>

                  {/* Block link → /blocks/:id */}
                  <td className="px-4 py-3">
                    {job.block_id ? (
                      <Link
                        href={`/blocks/${job.block_id}`}
                        className={cn(
                          'text-blue-700 hover:underline',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 rounded'
                        )}
                        aria-label={`View block: ${job.block_name ?? job.block_id}`}
                      >
                        {job.block_name ?? job.block_id}
                      </Link>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>

                  {/* Status badge + failure details */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span
                        className={cn(
                          'inline-flex self-start rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                          STATUS_STYLES[job.status]
                        )}
                      >
                        {job.status}
                      </span>
                      {job.status === 'failed' && (
                        <div className="text-xs text-red-700 space-y-0.5">
                          <span>Attempts: {job.attempts}</span>
                          {job.last_error && (
                            <p
                              className="text-red-600 max-w-xs truncate"
                              title={job.last_error}
                            >
                              {job.last_error}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Created at */}
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    <time dateTime={job.created_at}>{formatDate(job.created_at)}</time>
                  </td>

                  {/* Completed at */}
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {job.completed_at ? (
                      <time dateTime={job.completed_at}>{formatDate(job.completed_at)}</time>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
