import { Skeleton } from '@/components/ui/skeleton'
import { PageContainer } from '@/components/shell/page-container'

/**
 * Dashboard loading skeleton.
 * Shown by Next.js App Router while dashboard/page.tsx fetches data.
 * Layout: 4 stat cards in a grid + event feed placeholder.
 */
export default function DashboardLoading() {
  return (
    <PageContainer aria-label="Loading dashboard" role="status">
      {/* Page header skeleton */}
      <Skeleton className="h-8 w-40 mb-1" />
      <Skeleton className="h-4 w-64 mb-6" />

      {/* Stat cards: 2-col on mobile, 4-col on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>

      {/* Event feed skeleton */}
      <div className="rounded-lg border p-4 space-y-3">
        <Skeleton className="h-5 w-32 mb-2" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <Skeleton className="h-2.5 w-2.5 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-16 ml-auto" />
          </div>
        ))}
      </div>
    </PageContainer>
  )
}
