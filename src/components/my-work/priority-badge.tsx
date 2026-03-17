'use client'

import { cn } from '@/lib/utils'
import { AlertTriangle, ArrowUp, ArrowRight, ArrowDown } from 'lucide-react'

export type Priority = 'urgent' | 'high' | 'medium' | 'low'

const PRIORITY_CONFIG: Record<Priority, { icon: React.ElementType; color: string; label: string }> = {
  urgent: { icon: AlertTriangle, color: 'bg-destructive/10 text-destructive border-destructive/20', label: 'Urgent' },
  high: { icon: ArrowUp, color: 'bg-orange-500/10 text-orange-600 border-orange-500/20', label: 'High' },
  medium: { icon: ArrowRight, color: 'bg-primary/10 text-primary border-primary/20', label: 'Medium' },
  low: { icon: ArrowDown, color: 'bg-muted text-muted-foreground border-border', label: 'Low' },
}

interface PriorityBadgeProps {
  priority: Priority | string
  size?: 'sm' | 'md'
}

export function PriorityBadge({ priority, size = 'sm' }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority as Priority] ?? PRIORITY_CONFIG.medium
  const Icon = config.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium',
        config.color,
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
      )}
      title={`Priority: ${config.label}`}
    >
      <Icon className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      {config.label}
    </span>
  )
}
