import { cn } from '@/lib/utils'

/**
 * Skeleton — animated placeholder shown while content is loading.
 * Used in Next.js loading.tsx files to prevent cumulative layout shift.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-muted animate-pulse rounded', className)}
      {...props}
    />
  )
}
