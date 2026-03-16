import { PageContainer } from '@/components/shell/page-container'

/**
 * Loading skeleton for the Workflows page.
 * Automatically shown by Next.js while page.tsx fetches from Supabase.
 */
export default function WorkflowsLoading() {
  return (
    <PageContainer className="animate-pulse" aria-label="Loading workflows" role="status">
      {/* Page heading */}
      <div className="h-8 w-36 rounded bg-muted mb-6" />

      {/* Filter buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        {['w-16', 'w-16', 'w-20', 'w-16', 'w-16'].map((w, i) => (
          <div key={i} className={`h-8 rounded-md bg-muted ${w}`} />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="rounded-lg border border-border overflow-hidden">
        {/* Header row */}
        <div className="bg-muted/50 border-b border-border px-4 py-2 flex gap-8">
          {['w-[120px]', 'w-[140px]', 'w-20', 'w-[140px]', 'w-[140px]'].map((w, i) => (
            <div key={i} className={`h-3 rounded bg-muted ${w}`} />
          ))}
        </div>

        {/* Data rows */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="px-4 py-2 border-b border-border last:border-0 flex gap-8 items-center"
          >
            <div className="h-4 w-32 rounded bg-muted shrink-0" />
            <div className="h-4 w-36 rounded bg-muted shrink-0" />
            <div className="h-5 w-16 rounded-full bg-muted shrink-0" />
            <div className="h-4 w-32 rounded bg-muted shrink-0" />
            <div className="h-4 w-32 rounded bg-muted shrink-0" />
          </div>
        ))}
      </div>
    </PageContainer>
  )
}
