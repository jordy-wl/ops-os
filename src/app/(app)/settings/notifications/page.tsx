import { NotificationPreferencesPanel } from '@/components/settings/notification-preferences'

export const metadata = { title: 'Notifications — Settings — Ops OS' }

/**
 * Notification preferences settings page.
 * Server component wrapper that renders the client-side preferences panel.
 * P3-S8-FE-03: per-user toggles for event types and delivery channels.
 */
export default function NotificationSettingsPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Control which events trigger notifications and how they are delivered.
        </p>
      </div>

      <NotificationPreferencesPanel />
    </div>
  )
}
