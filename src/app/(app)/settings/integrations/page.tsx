import Link from 'next/link'
import { IntegrationHealthDashboard } from '@/components/settings/integration-health-dashboard'

export const metadata = { title: 'Integrations — Settings — Ops OS' }

export default function IntegrationsSettingsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Integrations</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor health and manage connected services.
          </p>
        </div>
        <Link
          href="/library/integrations"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Integration Library
        </Link>
      </div>

      <IntegrationHealthDashboard />
    </div>
  )
}
