import { cn } from '@/lib/utils'

/**
 * Single source of truth for status badge visual identity.
 * Replaces duplicated STATUS_STYLES across task, workflow, and block components.
 * All colors include dark mode variants.
 */
export const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  // Task statuses
  open:        { label: 'Open',        classes: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  claimed:     { label: 'Claimed',     classes: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  completed:   { label: 'Completed',   classes: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },

  // Workflow statuses
  pending:     { label: 'Pending',     classes: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  running:     { label: 'Running',     classes: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  done:        { label: 'Done',        classes: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  failed:      { label: 'Failed',      classes: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300' },
  waiting:     { label: 'Waiting',     classes: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  cancelled:   { label: 'Cancelled',   classes: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500' },

  // Block/entity statuses
  active:      { label: 'Active',      classes: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  draft:       { label: 'Draft',       classes: 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  archived:    { label: 'Archived',    classes: 'bg-slate-50 text-slate-400 dark:bg-slate-800 dark:text-slate-500' },
  suspended:   { label: 'Suspended',   classes: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },

  // Integration statuses
  connected:   { label: 'Connected',   classes: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  disconnected:{ label: 'Disconnected',classes: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500' },
  error:       { label: 'Error',       classes: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300' },
}

/** Fallback for unknown statuses */
const FALLBACK = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'

/**
 * Get the Tailwind classes for a status badge.
 */
export function getStatusClasses(status: string): string {
  return STATUS_CONFIG[status?.toLowerCase()]?.classes ?? FALLBACK
}

/**
 * Get the display label for a status.
 */
export function getStatusLabel(status: string): string {
  return STATUS_CONFIG[status?.toLowerCase()]?.label ?? status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Status badge component.
 */
export function StatusBadge({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        getStatusClasses(status),
        className
      )}
    >
      {getStatusLabel(status)}
    </span>
  )
}
