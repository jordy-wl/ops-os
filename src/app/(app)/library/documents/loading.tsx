import { Skeleton } from '@/components/ui/skeleton'
import { PageContainer } from '@/components/shell/page-container'

/**
 * Document Library loading skeleton.
 * Shown by Next.js App Router while library/documents/page.tsx fetches data.
 * Layout: search bar + 6-card grid matching the DocumentBrowser layout.
 */
export default function DocumentLibraryLoading() {
  return (
    <PageContainer aria-label="Loading document library" role="status">
      {/* Page header skeleton */}
      <Skeleton className="h-8 w-44 mb-1" />
      <Skeleton className="h-4 w-72 mb-6" />

      {/* Search bar skeleton */}
      <Skeleton className="h-9 w-80 rounded-md mb-6" />

      {/* 6-card grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    </PageContainer>
  )
}
