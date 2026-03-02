import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { AppNav } from '@/components/shell/app-nav'

/**
 * Authenticated app layout — wraps all routes under (app)/.
 *
 * Auth check (userId) is handled by Clerk middleware; this layout
 * additionally enforces org membership and redirects to /org-setup
 * when the user has not yet created or joined an organisation.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { orgId } = await auth()

  // No org → redirect to setup wizard before showing any app UI
  if (!orgId) {
    redirect('/org-setup')
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppNav />
      <main id="main-content" className="flex-1">
        {children}
      </main>
    </div>
  )
}
