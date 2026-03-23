export default function PortalsLoading() {
  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto animate-pulse">
      <div className="h-8 w-32 bg-muted rounded mb-2" />
      <div className="h-4 w-64 bg-muted rounded mb-6" />
      <div className="h-10 w-full bg-muted rounded mb-4" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-40 bg-muted rounded-lg" />
        ))}
      </div>
    </div>
  )
}
