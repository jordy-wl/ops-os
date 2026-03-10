import { Skeleton } from '@/components/ui/skeleton'
import { PageContainer } from '@/components/shell/page-container'

/**
 * Block Types loading skeleton.
 * Shown by Next.js App Router while block-types/page.tsx fetches data.
 * Layout: page header + 6-card grid matching the BlockTypes list page.
 */
export default function BlockTypesLoading() {
  return (
    <PageContainer maxWidth="xl" aria-label="Loading block types" role="status">
      {/* Page header skeleton */}
      <div className="border-b pb-4 mb-6">
        <Skeleton className="h-8 w-40 mb-1" />
        <Skeleton className="h-4 w-80 mt-1" />
      </div>

      {/* 6-card grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-l-4 border-l-gray-200 p-4 space-y-3"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </PageContainer>
  )
}
