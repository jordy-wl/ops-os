import { Skeleton } from '@/components/ui/skeleton'
import { PageContainer } from '@/components/shell/page-container'

/**
 * Block Library loading skeleton.
 * Shown by Next.js App Router while library/blocks/page.tsx fetches data.
 * Layout: search bar + 6-card grid matching the BlockBrowser layout.
 */
export default function BlockLibraryLoading() {
  return (
    <PageContainer aria-label="Loading block library" role="status">
      {/* Page header skeleton */}
      <Skeleton className="h-8 w-36 mb-1" />
      <Skeleton className="h-4 w-64 mb-6" />

      {/* Search bar skeleton */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Skeleton className="h-9 w-80 rounded-md" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-20 rounded-md" />
          ))}
        </div>
      </div>

      {/* 6-card grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    </PageContainer>
  )
}
