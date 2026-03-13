import { cn } from '@/lib/utils'

/**
 * Single source of truth for block type visual identity.
 * Replaces duplicated TYPE_STYLES maps across 6+ component files.
 * All colors include dark mode variants.
 */
export const BLOCK_TYPE_CONFIG: Record<string, { label: string; classes: string }> = {
  client:      { label: 'Client',      classes: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  deal:        { label: 'Deal',        classes: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  project:     { label: 'Project',     classes: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  contract:    { label: 'Contract',    classes: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300' },
  contact:     { label: 'Contact',     classes: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  solution:    { label: 'Solution',    classes: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' },
  product:     { label: 'Product',     classes: 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300' },
  service:     { label: 'Service',     classes: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300' },
  team_member: { label: 'Team Member', classes: 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300' },
  policy:      { label: 'Policy',      classes: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300' },
  // Document-related types
  document_template: { label: 'Template', classes: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300' },
  brand_kit:   { label: 'Brand Kit',   classes: 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300' },
}

/** Fallback for unknown types */
const FALLBACK = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'

/**
 * Get the Tailwind classes for a block type badge.
 */
export function getBlockTypeClasses(type: string): string {
  return BLOCK_TYPE_CONFIG[type]?.classes ?? FALLBACK
}

/**
 * Get the display label for a block type.
 */
export function getBlockTypeLabel(type: string): string {
  return BLOCK_TYPE_CONFIG[type]?.label ?? type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Block type badge component.
 */
export function BlockTypeBadge({
  type,
  className,
}: {
  type: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        getBlockTypeClasses(type),
        className
      )}
    >
      {getBlockTypeLabel(type)}
    </span>
  )
}
