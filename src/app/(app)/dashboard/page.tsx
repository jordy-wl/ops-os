export default function DashboardPage() {
  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
      <p className="mt-2 text-gray-500">
        Sprint 1 — navigate to{' '}
        <a href="/blocks" className="underline hover:text-gray-700">
          Blocks
        </a>{' '}
        to browse your organisation&apos;s entities.
      </p>
    </div>
  )
}
