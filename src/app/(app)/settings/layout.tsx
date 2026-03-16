import { SettingsSidebar } from '@/components/settings/settings-sidebar'
import { PageContainer } from '@/components/shell/page-container'
import { PageHeader } from '@/components/shell/page-header'

export const metadata = { title: 'Settings — Ops OS' }

/**
 * Settings layout — wraps all /settings/* pages with a persistent
 * sidebar navigation and consistent page structure.
 */
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <PageContainer maxWidth="2xl">
      <PageHeader
        title="Settings"
        subtitle="Manage your organisation, content, and system configuration."
      />

      <div className="flex gap-8">
        <SettingsSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </PageContainer>
  )
}
