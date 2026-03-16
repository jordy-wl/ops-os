import { Skeleton } from '@/components/ui/skeleton'
import { PageContainer } from '@/components/shell/page-container'

/**
 * Template Library loading skeleton.
 * Shown by Next.js App Router while library/templates/page.tsx fetches data.
 */
export default function TemplateLibraryLoading() {
  return (
    <PageContainer aria-label="Loading template library" role="status">
      {/* Page header skeleton */}
      <Skeleton className="h-8 w-48 mb-1" />
      <Skeleton className="h-4 w-80 mb-6" />

      {/* Stats + upload button skeleton */}
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-36 rounded-md" />
      </div>

      {/* Search bar + filter pills skeleton */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Skeleton className="h-9 w-64 rounded-md" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-16 rounded-full" />
          ))}
        </div>
      </div>

      {/* 6-card grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-5 w-16 rounded" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-48" />
            <div className="flex items-center justify-between pt-2">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    </PageContainer>
  )
}
