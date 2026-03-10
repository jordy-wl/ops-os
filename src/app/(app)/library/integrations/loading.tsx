import { Skeleton } from '@/components/ui/skeleton'

/**
 * Integration Library loading skeleton.
 * Shown by Next.js App Router while library/integrations/page.tsx fetches data.
 * Layout: 4 capability card skeletons matching the IntegrationCatalog layout.
 */
export default function IntegrationLibraryLoading() {
  return (
    <div className="p-6 lg:p-8" aria-label="Loading integration library" role="status">
      {/* Page header skeleton */}
      <Skeleton className="h-8 w-48 mb-1" />
      <Skeleton className="h-4 w-72 mb-6" />

      {/* 4 capability card skeletons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="h-4 w-full max-w-xs" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
