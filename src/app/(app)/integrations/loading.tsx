import { PageContainer } from '@/components/shell/page-container'

export default function IntegrationsLoading() {
  return (
    <PageContainer className="animate-pulse" aria-label="Loading integrations" role="status">
      <div className="h-8 w-48 rounded bg-muted mb-6" />

      <div className="flex flex-wrap gap-2 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 w-20 rounded-md bg-muted" />
        ))}
      </div>

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
