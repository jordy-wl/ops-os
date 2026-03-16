'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { User, Bot, Link2, ChevronDown, ChevronUp, ScrollText, CheckCircle2, XCircle, PenLine, AlertCircle } from 'lucide-react'
import type { TaskItem, TaskFormSchema, TaskFormField, TaskFormAction } from '@/app/(app)/tasks/page'

interface TaskListClientProps {
  initialTasks: TaskItem[] | null
  currentUserId: string
}

type FilterStatus = 'all' | 'open' | 'claimed' | 'completed'

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-success/10 text-success',
  claimed: 'bg-warning/10 text-warning',
  completed: 'bg-muted text-muted-foreground',
}

const ROUTING_META: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  human: { icon: User, label: 'Human', color: 'text-muted-foreground bg-muted' },
  agent: { icon: Bot, label: 'AI Agent', color: 'text-muted-foreground bg-muted' },
  approval_chain: { icon: Link2, label: 'Approval Chain', color: 'text-muted-foreground bg-muted' },
}

const DECISION_STYLES: Record<string, string> = {
  approved: 'text-green-700 dark:text-green-400',
  rejected: 'text-destructive',
  modified: 'text-amber-700 dark:text-amber-400',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color =
    score >= 0.8 ? 'text-success bg-success/10' :
    score >= 0.5 ? 'text-warning bg-warning/10' :
    'text-destructive bg-destructive/10'
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', color)} title={`AI confidence: ${pct}%`}>
      {pct}%
    </span>
  )
}

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  high: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  urgent: 'bg-destructive/10 text-destructive',
}

// ─── Dynamic Task Form Renderer ─────────────────────────────────────────────

function TaskFormRenderer({
  schema,
  taskId,
  disabled,
  onSubmit,
}: {
  schema: TaskFormSchema
  taskId: string
  disabled: boolean
  onSubmit: (taskId: string, action: string, formData: Record<string, unknown>) => void
}) {
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const fields = schema.fields ?? []
  const actions = schema.actions ?? []

  function setField(name: string, value: unknown) {
    setFormData((prev) => ({ ...prev, [name]: value }))
    setValidationErrors((prev) => {
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  function validate(): boolean {
    const errors: Record<string, string> = {}
    for (const field of fields) {
      if (field.required) {
        const val = formData[field.name]
        if (val === undefined || val === null || val === '') {
          errors[field.name] = `${field.label || field.name} is required`
        }
      }
      if (field.max_length && typeof formData[field.name] === 'string') {
        if ((formData[field.name] as string).length > field.max_length) {
          errors[field.name] = `Max ${field.max_length} characters`
        }
      }
    }
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  function handleAction(action: TaskFormAction) {
    if (!validate()) return
    onSubmit(taskId, action.value, formData)
  }

  const ACTION_BTN_STYLES: Record<string, string> = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/80',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/80',
    outline: 'border border-border bg-background text-foreground hover:bg-muted',
    secondary: 'bg-muted text-foreground hover:bg-muted/80',
  }

  return (
    <div className="space-y-3">
      {schema.title && (
        <h4 className="text-sm font-semibold text-foreground">{schema.title}</h4>
      )}

      {/* Form fields */}
      {fields.map((field) => (
        <div key={field.name}>
          <label htmlFor={`${taskId}-${field.name}`} className="block text-xs font-medium text-foreground mb-1">
            {field.label || field.name}
            {field.required && <span className="text-destructive ml-0.5">*</span>}
          </label>

          {field.type === 'text' && (
            <input
              id={`${taskId}-${field.name}`}
              type="text"
              value={(formData[field.name] as string) ?? ''}
              onChange={(e) => setField(field.name, e.target.value)}
              disabled={disabled}
              maxLength={field.max_length}
              className="w-full rounded-md border border-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
          )}

          {field.type === 'textarea' && (
            <textarea
              id={`${taskId}-${field.name}`}
              value={(formData[field.name] as string) ?? ''}
              onChange={(e) => setField(field.name, e.target.value)}
              disabled={disabled}
              maxLength={field.max_length}
              rows={3}
              className="w-full rounded-md border border-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y disabled:opacity-50"
            />
          )}

          {field.type === 'select' && (
            <select
              id={`${taskId}-${field.name}`}
              value={(formData[field.name] as string) ?? ''}
              onChange={(e) => setField(field.name, e.target.value)}
              disabled={disabled}
              className="w-full rounded-md border border-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              <option value="">Select…</option>
              {(field.options ?? []).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          )}

          {field.type === 'number' && (
            <input
              id={`${taskId}-${field.name}`}
              type="number"
              value={(formData[field.name] as number) ?? ''}
              onChange={(e) => setField(field.name, e.target.value ? Number(e.target.value) : '')}
              disabled={disabled}
              className="w-full rounded-md border border-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
          )}

          {field.type === 'date' && (
            <input
              id={`${taskId}-${field.name}`}
              type="date"
              value={(formData[field.name] as string) ?? ''}
              onChange={(e) => setField(field.name, e.target.value)}
              disabled={disabled}
              className="w-full rounded-md border border-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
          )}

          {field.type === 'checkbox' && (
            <label className="flex items-center gap-2 mt-1">
              <input
                id={`${taskId}-${field.name}`}
                type="checkbox"
                checked={!!formData[field.name]}
                onChange={(e) => setField(field.name, e.target.checked)}
                disabled={disabled}
                className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
              />
              <span className="text-sm text-foreground">{field.label}</span>
            </label>
          )}

          {validationErrors[field.name] && (
            <p className="mt-0.5 text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {validationErrors[field.name]}
            </p>
          )}
        </div>
      ))}

      {/* Action buttons */}
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {actions.map((action) => (
            <button
              key={action.value}
              type="button"
              onClick={() => handleAction(action)}
              disabled={disabled}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                ACTION_BTN_STYLES[action.style ?? 'primary'] ?? ACTION_BTN_STYLES.primary
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function TaskListClient({ initialTasks, currentUserId }: TaskListClientProps) {
  const [tasks, setTasks] = useState(initialTasks)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [showMine, setShowMine] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (!tasks) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center" role="alert">
        <p className="text-sm font-medium text-destructive">Failed to load tasks.</p>
        <p className="mt-1 text-[13px] text-destructive">Refresh the page to try again.</p>
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

  async function handleFormAction(taskId: string, action: string, formData: Record<string, unknown>) {
    setActionLoading(taskId)
    setError(null)
    try {
      const res = await fetch(`/api/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, form_data: formData }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error?.message ?? 'Failed to submit task')
        return
      }
      setTasks((prev) =>
        (prev ?? []).map((t) =>
          t.id === taskId ? { ...t, status: 'completed' as const, decision: action as TaskItem['decision'] } : t
        )
      )
    } catch {
      setError('Network error — please try again')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDecision(taskId: string, decision: 'approved' | 'rejected' | 'modified') {
    setActionLoading(taskId)
    setError(null)
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error?.message ?? 'Failed to submit decision')
        return
      }
      setTasks((prev) =>
        (prev ?? []).map((t) =>
          t.id === taskId ? { ...t, decision } : t
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
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                filter === s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted'
              )}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showMine}
            onChange={(e) => setShowMine(e.target.checked)}
            className="rounded border-border text-primary focus:ring-ring"
          />
          My tasks only
          {myTaskCount > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 text-xs font-medium px-1.5 min-w-[20px]">
              {myTaskCount}
            </span>
          )}
        </label>

        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} task{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/20 bg-destructive/5 p-3" role="alert">
          <p className="text-[13px] text-destructive">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-title text-foreground mb-2">
            {tasks.length === 0 ? 'No tasks yet' : 'No matching tasks'}
          </p>
          <p className="text-sm text-muted-foreground">
            {tasks.length === 0
              ? 'Tasks appear here when workflows create them.'
              : 'Try adjusting your filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => {
            const isExpanded = expandedId === task.id
            const routing = task.routing_decision ? ROUTING_META[task.routing_decision] : null
            const hasForm = !!task.task_form_schema && ((task.task_form_schema.fields?.length ?? 0) > 0 || (task.task_form_schema.actions?.length ?? 0) > 0)
            const hasDetails = !!(task.instructions || task.ai_recommendation || task.routing_reason || hasForm)

            return (
              <div
                key={task.id}
                className="border-b border-border bg-background hover:bg-accent/50 transition-colors duration-150"
              >
                {/* Card header */}
                <div className="flex items-start gap-3 p-4">
                  {/* Task info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-sm font-medium text-foreground truncate">{task.name}</h3>
                      <span
                        className={cn(
                          'shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          STATUS_STYLES[task.status] ?? 'bg-gray-100 text-gray-600'
                        )}
                      >
                        {task.status}
                      </span>
                      {task.priority && task.priority !== 'medium' && (
                        <span className={cn('shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize', PRIORITY_STYLES[task.priority])}>
                          {task.priority}
                        </span>
                      )}
                      {routing && (
                        <span className={cn('shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', routing.color)}>
                          <routing.icon className="h-3 w-3" />
                          {routing.label}
                        </span>
                      )}
                      {task.confidence_score != null && (
                        <ConfidenceBadge score={task.confidence_score} />
                      )}
                      {task.decision && (
                        <span className={cn('shrink-0 text-xs font-medium capitalize', DECISION_STYLES[task.decision])}>
                          {task.decision}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {task.step_name && <span>Step: {task.step_name}</span>}
                      {task.workflow_instance_name && (
                        <span className="truncate max-w-[100px] sm:max-w-[160px] md:max-w-[200px]" title={task.workflow_instance_name}>
                          Workflow: {task.workflow_instance_name}
                        </span>
                      )}
                      <span>{formatDate(task.created_at)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 flex items-center gap-2">
                    {/* AI decision actions — show when claimed with an AI recommendation */}
                    {task.status === 'claimed' && task.assigned_to === currentUserId && task.ai_recommendation && !task.decision && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleDecision(task.id, 'approved')}
                          disabled={actionLoading === task.id}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-success bg-success/10 hover:bg-success/20 transition-colors disabled:opacity-50"
                          title="Approve AI recommendation"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleDecision(task.id, 'rejected')}
                          disabled={actionLoading === task.id}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 transition-colors disabled:opacity-50"
                          title="Reject AI recommendation"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </button>
                        <button
                          onClick={() => handleDecision(task.id, 'modified')}
                          disabled={actionLoading === task.id}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 dark:text-amber-300 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 transition-colors disabled:opacity-50"
                          title="Modify AI recommendation"
                        >
                          <PenLine className="h-3.5 w-3.5" />
                          Edit
                        </button>
                      </div>
                    )}

                    {/* Standard claim/complete actions */}
                    {task.status === 'open' && (
                      <button
                        onClick={() => handleClaim(task.id)}
                        disabled={actionLoading === task.id}
                        className={cn(
                          'px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground',
                          'hover:bg-primary/80 transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          'disabled:opacity-50 disabled:cursor-not-allowed'
                        )}
                      >
                        {actionLoading === task.id ? 'Claiming…' : 'Claim'}
                      </button>
                    )}
                    {task.status === 'claimed' && task.assigned_to === currentUserId && !task.ai_recommendation && !hasForm && (
                      <button
                        onClick={() => handleComplete(task.id)}
                        disabled={actionLoading === task.id}
                        className={cn(
                          'px-3 py-1.5 rounded-md text-xs font-medium bg-success text-success-foreground',
                          'hover:bg-success/90 transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          'disabled:opacity-50 disabled:cursor-not-allowed'
                        )}
                      >
                        {actionLoading === task.id ? 'Completing…' : 'Complete'}
                      </button>
                    )}
                    {task.status === 'claimed' && task.assigned_to !== currentUserId && (
                      <span className="text-xs text-muted-foreground italic">Assigned to another user</span>
                    )}

                    {/* Expand/collapse toggle */}
                    {hasDetails && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : task.id)}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && hasDetails && (
                  <div className="border-t border-border px-4 py-3 space-y-3 bg-muted/30">
                    {task.routing_reason && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-0.5">Routing Reason</p>
                        <p className="text-sm text-foreground">{task.routing_reason}</p>
                      </div>
                    )}
                    {task.instructions && (
                      <div>
                        <div className="flex items-center gap-1 mb-0.5">
                          <ScrollText className="h-3 w-3 text-muted-foreground" />
                          <p className="text-xs font-medium text-muted-foreground">Instructions</p>
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{task.instructions}</p>
                      </div>
                    )}
                    {task.ai_recommendation && (
                      <div>
                        <div className="flex items-center gap-1 mb-0.5">
                          <Bot className="h-3 w-3 text-muted-foreground" />
                          <p className="text-xs font-medium text-muted-foreground">AI Recommendation</p>
                        </div>
                        <pre className="text-xs text-foreground bg-background rounded border border-border p-2 overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(task.ai_recommendation, null, 2)}
                        </pre>
                      </div>
                    )}
                    {hasForm && task.task_form_schema && task.status !== 'completed' && (
                      <div className="pt-2 border-t border-border">
                        <TaskFormRenderer
                          schema={task.task_form_schema}
                          taskId={task.id}
                          disabled={actionLoading === task.id || (task.status === 'claimed' && task.assigned_to !== currentUserId)}
                          onSubmit={handleFormAction}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
