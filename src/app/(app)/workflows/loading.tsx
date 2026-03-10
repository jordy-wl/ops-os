import { PageContainer } from '@/components/shell/page-container'

/**
 * Loading skeleton for the Workflows page.
 * Automatically shown by Next.js while page.tsx fetches from Supabase.
 */
export default function WorkflowsLoading() {
  return (
    <PageContainer className="animate-pulse" aria-label="Loading workflows" role="status">
      {/* Page heading */}
      <div className="h-8 w-36 rounded bg-gray-200 mb-6" />

      {/* Filter buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[64, 64, 80, 64, 64].map((w, i) => (
          <div key={i} className="h-9 rounded-md bg-gray-200" style={{ width: w }} />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        {/* Header row */}
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex gap-8">
          {[120, 140, 80, 140, 140].map((w, i) => (
            <div key={i} className="h-3 rounded bg-gray-200" style={{ width: w }} />
          ))}
        </div>

        {/* Data rows */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="px-4 py-3 border-b border-gray-100 last:border-0 flex gap-8 items-center"
          >
            <div className="h-4 w-32 rounded bg-gray-200 shrink-0" />
            <div className="h-4 w-36 rounded bg-gray-200 shrink-0" />
            <div className="h-5 w-16 rounded-full bg-gray-200 shrink-0" />
            <div className="h-4 w-32 rounded bg-gray-200 shrink-0" />
            <div className="h-4 w-32 rounded bg-gray-200 shrink-0" />
          </div>
        ))}
      </div>
    </PageContainer>
  )
}
