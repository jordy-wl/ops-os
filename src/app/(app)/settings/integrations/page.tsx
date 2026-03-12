import Link from 'next/link'

export const metadata = { title: 'Integrations — Settings — Ops OS' }

export default function IntegrationsSettingsPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Integrations</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage connected services and external integrations.
        </p>
      </div>

      <div className="rounded-lg border bg-background p-6">
        <p className="text-sm text-muted-foreground mb-4">
          Configure and manage your integrations from the dedicated integrations page.
        </p>
        <Link
          href="/integrations"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Go to Integrations
        </Link>
      </div>
    </div>
  )
}
