import { cn } from '@/lib/utils'

/**
 * Skeleton — animated placeholder shown while content is loading.
 * Used in Next.js loading.tsx files to prevent cumulative layout shift.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-gray-100 animate-pulse rounded', className)} />
}
