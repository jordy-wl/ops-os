'use client'

import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ToolCallChunk } from '@/lib/chat/parse-sse'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ActionNavigationProps {
  toolCall: ToolCallChunk
  className?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Derive a navigation path from a completed tool call result */
function getNavigationPath(toolCall: ToolCallChunk): { href: string; label: string } | null {
  if (!toolCall.result.success) return null

  const data = toolCall.result.data as Record<string, unknown> | undefined
  const input = toolCall.input as Record<string, unknown> | undefined

  switch (toolCall.name) {
    case 'create_block': {
      const blockId = data?.block_id ?? data?.id
      if (blockId) return { href: `/blocks/${blockId}`, label: 'View block' }
      return null
    }
    case 'update_block': {
      const blockId = input?.block_id ?? input?.id ?? data?.block_id ?? data?.id
      if (blockId) return { href: `/blocks/${blockId}`, label: 'View block' }
      return null
    }
    case 'trigger_workflow': {
      const instanceId = data?.instance_id ?? data?.workflow_instance_id
      if (instanceId) return { href: `/workflows/${instanceId}`, label: 'View workflow' }
      return null
    }
    case 'configure_block_type':
    case 'create_block_type':
      return { href: '/settings/block-types', label: 'View block types' }
    default:
      return null
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * ActionNavigation — renders a "View →" link after a successful tool execution.
 * Derives the navigation target from the tool call name and result data.
 * Returns null if no navigation is applicable.
 */
export function ActionNavigation({ toolCall, className }: ActionNavigationProps) {
  const nav = getNavigationPath(toolCall)
  if (!nav) return null

  return (
    <a
      href={nav.href}
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80',
        'transition-colors mt-0.5',
        className
      )}
    >
      {nav.label}
      <ExternalLink className="h-3 w-3" aria-hidden="true" />
    </a>
  )
}
