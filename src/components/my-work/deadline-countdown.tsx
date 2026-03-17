'use client'

import { cn } from '@/lib/utils'
import { Clock } from 'lucide-react'

interface DeadlineCountdownProps {
  deadline: string | null
  className?: string
}

export function DeadlineCountdown({ deadline, className }: DeadlineCountdownProps) {
  if (!deadline) return null

  const now = Date.now()
  const target = new Date(deadline).getTime()
  const diff = target - now

  // Already past
  if (diff < 0) {
    const overdue = Math.abs(diff)
    const hours = Math.floor(overdue / 3600000)
    const label = hours < 24 ? `${hours}h overdue` : `${Math.floor(hours / 24)}d overdue`
    return (
      <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium text-destructive', className)} title={`Deadline: ${new Date(deadline).toLocaleString()}`}>
        <Clock className="h-3 w-3" />
        {label}
      </span>
    )
  }

  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(hours / 24)

  // Urgent: less than 4 hours
  if (hours < 4) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium text-destructive', className)} title={`Due in ${hours}h`}>
        <Clock className="h-3 w-3" />
        {hours}h left
      </span>
    )
  }

  // Warning: less than 24 hours
  if (hours < 24) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium text-warning', className)} title={`Due in ${hours}h`}>
        <Clock className="h-3 w-3" />
        {hours}h left
      </span>
    )
  }

  // Normal
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] text-muted-foreground', className)} title={`Due in ${days}d`}>
      <Clock className="h-3 w-3" />
      {days}d left
    </span>
  )
}
