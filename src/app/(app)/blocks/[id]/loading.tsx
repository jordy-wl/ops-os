import { PageContainer } from '@/components/shell/page-container'

/**
 * Loading skeleton for the Block Detail page.
 * Automatically shown by Next.js App Router while page.tsx is fetching data.
 * Sized to match the final layout — prevents cumulative layout shift.
 */
export default function BlockDetailLoading() {
  return (
    <PageContainer maxWidth="md" className="animate-pulse" aria-label="Loading block details" role="status">
      {/* BlockHeader skeleton */}
      <div className="flex items-start gap-3">
        <div className="h-6 w-20 rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-7 w-64 rounded bg-muted" />
          <div className="h-5 w-24 rounded-full bg-muted" />
        </div>
      </div>

      {/* Content grid skeleton */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Left column: metadata + timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* BlockDataPanel skeleton */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="h-5 w-28 rounded bg-muted" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4">
                <div className="h-4 w-24 rounded bg-muted" />
                <div className="h-4 w-40 rounded bg-muted" />
              </div>
            ))}
          </div>

          {/* EventTimeline skeleton */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="h-5 w-28 rounded bg-muted" />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start gap-3 py-2">
                <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-32 rounded bg-muted" />
                  <div className="h-3 w-64 rounded bg-muted" />
                </div>
                <div className="h-4 w-16 rounded bg-muted shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Right column: connected blocks skeleton */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="h-5 w-32 rounded bg-muted" />
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2 py-1.5">
              <div className="h-5 w-14 rounded-full bg-muted" />
              <div className="h-4 w-28 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </PageContainer>
  )
}
