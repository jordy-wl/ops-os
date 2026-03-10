import { Skeleton } from '@/components/ui/skeleton'

/**
 * My Work loading skeleton.
 * Shown by Next.js App Router while my-work/page.tsx fetches data.
 * Layout: 4 sections (tasks, workflows, recent blocks, recent events).
 */
export default function MyWorkLoading() {
  return (
    <div className="p-6 lg:p-8" aria-label="Loading my work" role="status">
      {/* Page header skeleton */}
      <Skeleton className="h-8 w-32 mb-1" />
      <Skeleton className="h-4 w-56 mb-6" />

      {/* 4 section skeletons */}
      <div className="space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-3">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-full max-w-md" />
            <Skeleton className="h-4 w-full max-w-sm" />
            <Skeleton className="h-4 w-full max-w-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}
