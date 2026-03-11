import { PageContainer } from '@/components/shell/page-container'

/**
 * Loading skeleton for the Block List page.
 * Automatically shown while page.tsx fetches blocks from Supabase.
 */
export default function BlockListLoading() {
  return (
    <PageContainer className="animate-pulse" aria-label="Loading blocks" role="status">
      {/* Header */}
      <div className="h-8 w-40 rounded bg-muted mb-6" />

      {/* Filter + search bar */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="h-9 w-80 rounded-md bg-muted" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-9 w-20 rounded-md bg-muted" />
          ))}
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-5 w-16 rounded-full bg-muted" />
              <div className="h-4 w-28 rounded bg-muted" />
            </div>
            <div className="h-4 w-40 rounded bg-muted" />
            <div className="h-3 w-24 rounded bg-muted" />
          </div>
        ))}
      </div>
    </PageContainer>
  )
}
