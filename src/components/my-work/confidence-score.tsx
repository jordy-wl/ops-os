'use client'

import { cn } from '@/lib/utils'

interface ConfidenceScoreProps {
  score: number // 0.0 - 1.0
  label?: string
  className?: string
}

export function ConfidenceScore({ score, label, className }: ConfidenceScoreProps) {
  const percent = Math.round(score * 100)

  const color = percent >= 80
    ? 'text-success bg-success/10'
    : percent >= 50
      ? 'text-warning bg-warning/10'
      : 'text-destructive bg-destructive/10'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
        color,
        className
      )}
      title={label ? `${label}: ${percent}%` : `Confidence: ${percent}%`}
    >
      {percent}%
      {label && <span className="hidden sm:inline">{label}</span>}
    </span>
  )
}
