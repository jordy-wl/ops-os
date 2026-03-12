import { redirect } from 'next/navigation'

/**
 * Settings index — redirects to the first section (Org Profile).
 */
export default function SettingsIndexPage() {
  redirect('/settings/org-profile')
}
