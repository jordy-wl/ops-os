'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { TaskItem } from '@/app/(app)/tasks/page'

interface TaskListClientProps {
  initialTasks: TaskItem[] | null
  currentUserId: string
}

type FilterStatus = 'all' | 'open' | 'claimed' | 'completed'

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-green-100 text-green-800',
  claimed: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-gray-100 text-gray-600',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

export function TaskListClient({ initialTasks, currentUserId }: TaskListClientProps) {
  const [tasks, setTasks] = useState(initialTasks)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [showMine, setShowMine] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!tasks) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center" role="alert">
        <p className="text-sm font-medium text-red-800">Failed to load tasks.</p>
        <p className="mt-1 text-sm text-red-600">Refresh the page to try again.</p>
      </div>
    )
  }

  const filtered = tasks.filter((t) => {
    if (filter !== 'all' && t.status !== filter) return false
    if (showMine && t.assigned_to !== currentUserId) return false
    return true
  })

  const myTaskCount = tasks.filter((t) => t.assigned_to === currentUserId && t.status === 'claimed').length

  async function handleClaim(taskId: string) {
    setActionLoading(taskId)
    setError(null)
    try {
      const res = await fetch(`/api/tasks/${taskId}/claim`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error?.message ?? 'Failed to claim task')
        return
      }
      // Update local state
      setTasks((prev) =>
        (prev ?? []).map((t) =>
          t.id === taskId ? { ...t, status: 'claimed' as const, assigned_to: currentUserId } : t
        )
      )
    } catch {
      setError('Network error — please try again')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleComplete(taskId: string) {
    setActionLoading(taskId)
    setError(null)
    try {
      const res = await fetch(`/api/tasks/${taskId}/complete`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error?.message ?? 'Failed to complete task')
        return
      }
      setTasks((prev) =>
        (prev ?? []).map((t) =>
          t.id === taskId ? { ...t, status: 'completed' as const } : t
        )
      )
    } catch {
      setError('Network error — please try again')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-1">
          {(['all', 'open', 'claimed', 'completed'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900',
                filter === s
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showMine}
            onChange={(e) => setShowMine(e.target.checked)}
            className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
          />
          My tasks only
          {myTaskCount > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-yellow-100 text-yellow-800 text-xs font-medium px-1.5 min-w-[20px]">
              {myTaskCount}
            </span>
          )}
        </label>

        <span className="ml-auto text-xs text-gray-400">
          {filtered.length} task{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3" role="alert">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg font-semibold text-gray-900 mb-2">
            {tasks.length === 0 ? 'No tasks yet' : 'No matching tasks'}
          </p>
          <p className="text-sm text-gray-500">
            {tasks.length === 0
              ? 'Tasks appear here when workflows create them.'
              : 'Try adjusting your filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 transition-colors"
            >
              {/* Task info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-medium text-gray-900 truncate">{task.name}</h3>
                  <span
                    className={cn(
                      'shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                      STATUS_STYLES[task.status] ?? 'bg-gray-100 text-gray-600'
                    )}
                  >
                    {task.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {task.step_name && <span>Step: {task.step_name}</span>}
                  {task.workflow_instance_name && (
                    <span className="truncate max-w-[200px]" title={task.workflow_instance_name}>
                      Workflow: {task.workflow_instance_name}
                    </span>
                  )}
                  <span>{formatDate(task.created_at)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="shrink-0 flex gap-2">
                {task.status === 'open' && (
                  <button
                    onClick={() => handleClaim(task.id)}
                    disabled={actionLoading === task.id}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-medium bg-gray-900 text-white',
                      'hover:bg-gray-700 transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    {actionLoading === task.id ? 'Claiming…' : 'Claim'}
                  </button>
                )}
                {task.status === 'claimed' && task.assigned_to === currentUserId && (
                  <button
                    onClick={() => handleComplete(task.id)}
                    disabled={actionLoading === task.id}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-medium bg-green-700 text-white',
                      'hover:bg-green-600 transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    {actionLoading === task.id ? 'Completing…' : 'Complete'}
                  </button>
                )}
                {task.status === 'claimed' && task.assigned_to !== currentUserId && (
                  <span className="text-xs text-gray-400 italic">Assigned to another user</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
