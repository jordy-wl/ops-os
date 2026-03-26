'use client'

import { useState, useCallback } from 'react'
import { Check, X, ChevronDown, Shield, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ActionPreview } from '@/lib/chat/parse-sse'

// ── Types ──────────────────────────────────────────────────────────────────────

type ActionStatus = 'pending' | 'approved' | 'skipped'

interface ChangePreviewProps {
  actions: ActionPreview[]
  onApprove: (actionId: string, editedInput?: Record<string, unknown>) => void
  onSkip: (actionId: string) => void
  onApproveAll: () => void
  trustedToolTypes: Set<string>
  onTrustToolType: (toolName: string) => void
}

// ── Constants ──────────────────────────────────────────────────────────────────

const MAX_KEY_VALUE_PAIRS = 5

const RISK_STYLES = {
  low: {
    dot: 'bg-green-500',
    border: 'border-green-200 dark:border-green-800',
  },
  medium: {
    dot: 'bg-amber-500',
    border: 'border-amber-200 dark:border-amber-800',
  },
  high: {
    dot: 'bg-red-500',
    border: 'border-red-200 dark:border-red-800',
  },
} as const

const RISK_LABELS: Record<ActionPreview['riskLevel'], string> = {
  low: 'Low risk',
  medium: 'Medium risk',
  high: 'High risk',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Format a tool name into a more readable label (e.g. create_block -> Create Block) */
function formatToolName(toolName: string): string {
  return toolName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Render a value as a readable string, truncating long values */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'string') {
    return value.length > 80 ? value.slice(0, 77) + '...' : value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  const json = JSON.stringify(value)
  return json.length > 80 ? json.slice(0, 77) + '...' : json
}

// ── ActionCard sub-component ───────────────────────────────────────────────────

interface ActionCardProps {
  action: ActionPreview
  status: ActionStatus
  isTrusted: boolean
  onApprove: (actionId: string) => void
  onSkip: (actionId: string) => void
  onTrustToolType: (toolName: string) => void
}

function ActionCard({
  action,
  status,
  isTrusted,
  onApprove,
  onSkip,
  onTrustToolType,
}: ActionCardProps) {
  const [technicalOpen, setTechnicalOpen] = useState(false)

  const risk = RISK_STYLES[action.riskLevel]
  const inputKeys = Object.keys(action.input).slice(0, MAX_KEY_VALUE_PAIRS)
  const hasMoreKeys = Object.keys(action.input).length > MAX_KEY_VALUE_PAIRS
  const isAutoApproved = isTrusted && status === 'pending'

  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-opacity',
        risk.border,
        status === 'approved' && 'opacity-60',
        status === 'skipped' && 'opacity-40',
        isAutoApproved && 'opacity-60',
      )}
      role="article"
      aria-label={`Action: ${action.description}`}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className={cn('h-2.5 w-2.5 shrink-0 rounded-full', risk.dot)}
          aria-label={RISK_LABELS[action.riskLevel]}
          role="img"
        />
        <span
          className={cn(
            'flex-1 text-sm font-medium text-foreground',
            status === 'skipped' && 'line-through',
          )}
        >
          {action.description}
        </span>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {formatToolName(action.toolName)}
        </span>
      </div>

      {/* Key-value pairs (non-technical view) */}
      {inputKeys.length > 0 && (
        <div className="mb-2 space-y-1">
          {inputKeys.map((key) => (
            <div key={key} className="flex items-baseline gap-2 text-xs">
              <span className="shrink-0 text-muted-foreground">{key}:</span>
              <span className="text-foreground truncate">
                {formatValue(action.input[key])}
              </span>
            </div>
          ))}
          {hasMoreKeys && (
            <p className="text-xs text-muted-foreground">
              + {Object.keys(action.input).length - MAX_KEY_VALUE_PAIRS} more fields
            </p>
          )}
        </div>
      )}

      {/* Technical toggle */}
      <div className="mb-2">
        <button
          type="button"
          onClick={() => setTechnicalOpen((prev) => !prev)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-expanded={technicalOpen}
        >
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 transition-transform',
              technicalOpen && 'rotate-180',
            )}
            aria-hidden="true"
          />
          Technical details
        </button>
        {technicalOpen && (
          <div className="mt-1.5 rounded-md bg-muted/50 p-2.5 border border-border">
            <p className="text-xs text-muted-foreground mb-1">
              Tool: <span className="font-mono text-foreground">{action.toolName}</span>
            </p>
            <pre className="text-xs text-foreground font-mono whitespace-pre-wrap break-all overflow-auto max-h-48">
              {JSON.stringify(action.input, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Action buttons or status indicator */}
      {isAutoApproved ? (
        <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          Auto-approved (trusted)
        </div>
      ) : status === 'approved' ? (
        <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          Approved
        </div>
      ) : status === 'skipped' ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Skipped
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onApprove(action.id)}
            className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 transition-colors"
          >
            <Check className="h-3 w-3" aria-hidden="true" />
            Approve
          </button>
          <button
            type="button"
            onClick={() => onSkip(action.id)}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="h-3 w-3" aria-hidden="true" />
            Skip
          </button>
          <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              onChange={() => onTrustToolType(action.toolName)}
              className="h-3 w-3 rounded border-border accent-green-600"
            />
            <Shield className="h-3 w-3" aria-hidden="true" />
            <span className="hidden sm:inline">
              Trust {formatToolName(action.toolName)}
            </span>
            <span className="sm:hidden">Trust</span>
          </label>
        </div>
      )}
    </div>
  )
}

// ── ChangePreview component ────────────────────────────────────────────────────

/**
 * ChangePreview - Renders execute-mode action preview cards.
 *
 * When the AI emits `action_preview` SSE events, this component displays each
 * proposed action as an interactive card. The user can approve, skip, or
 * auto-approve by trusting specific tool types for the session.
 */
export function ChangePreview({
  actions,
  onApprove,
  onSkip,
  onApproveAll,
  trustedToolTypes,
  onTrustToolType,
}: ChangePreviewProps) {
  const [statuses, setStatuses] = useState<Map<string, ActionStatus>>(new Map())

  const getStatus = useCallback(
    (actionId: string): ActionStatus => statuses.get(actionId) ?? 'pending',
    [statuses],
  )

  const handleApprove = useCallback(
    (actionId: string) => {
      setStatuses((prev) => new Map(prev).set(actionId, 'approved'))
      onApprove(actionId)
    },
    [onApprove],
  )

  const handleSkip = useCallback(
    (actionId: string) => {
      setStatuses((prev) => new Map(prev).set(actionId, 'skipped'))
      onSkip(actionId)
    },
    [onSkip],
  )

  const handleApproveAll = useCallback(() => {
    setStatuses((prev) => {
      const next = new Map(prev)
      for (const action of actions) {
        if (!next.has(action.id) || next.get(action.id) === 'pending') {
          next.set(action.id, 'approved')
        }
      }
      return next
    })
    onApproveAll()
  }, [actions, onApproveAll])

  if (actions.length === 0) return null

  const hasHighRiskPending = actions.some(
    (a) =>
      a.riskLevel === 'high' &&
      getStatus(a.id) === 'pending' &&
      !trustedToolTypes.has(a.toolName),
  )
  const allReviewed = actions.every(
    (a) =>
      getStatus(a.id) !== 'pending' || trustedToolTypes.has(a.toolName),
  )
  const allLowRisk = actions.every((a) => a.riskLevel === 'low')
  const showApproveAll = actions.length >= 2
  const approveAllEnabled = (allLowRisk || allReviewed) && !hasHighRiskPending

  return (
    <section
      className="space-y-2"
      aria-label="Pending action previews"
    >
      {/* High-risk warning banner */}
      {hasHighRiskPending && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" aria-hidden="true" />
          <p className="text-xs text-red-700 dark:text-red-400">
            One or more actions are high risk. Please review each one individually.
          </p>
        </div>
      )}

      {/* Action cards */}
      {actions.map((action) => (
        <ActionCard
          key={action.id}
          action={action}
          status={
            trustedToolTypes.has(action.toolName) && getStatus(action.id) === 'pending'
              ? 'pending' // let the card render auto-approved state
              : getStatus(action.id)
          }
          isTrusted={trustedToolTypes.has(action.toolName)}
          onApprove={handleApprove}
          onSkip={handleSkip}
          onTrustToolType={onTrustToolType}
        />
      ))}

      {/* Approve All button */}
      {showApproveAll && !allReviewed && (
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={handleApproveAll}
            disabled={!approveAllEnabled}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              approveAllEnabled
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-muted text-muted-foreground cursor-not-allowed',
            )}
            aria-label="Approve all pending actions"
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            Approve All
          </button>
        </div>
      )}
    </section>
  )
}
