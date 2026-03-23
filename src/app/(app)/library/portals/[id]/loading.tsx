export default function PortalDetailLoading() {
  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto animate-pulse">
      <div className="h-4 w-32 bg-muted rounded mb-4" />
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="h-7 w-48 bg-muted rounded mb-2" />
          <div className="h-4 w-32 bg-muted rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-muted rounded" />
          <div className="h-9 w-24 bg-muted rounded" />
        </div>
      </div>
      <div className="h-10 w-full bg-muted rounded mb-6" />
      <div className="space-y-4">
        <div className="h-32 bg-muted rounded-lg" />
        <div className="h-32 bg-muted rounded-lg" />
      </div>
    </div>
  )
}
