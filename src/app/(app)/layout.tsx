import { cookies } from 'next/headers'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { AppSidebar } from '@/components/shell/app-sidebar'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { ChatWidgetShell } from '@/components/chat/chat-widget-shell'
import { ThemeToggle } from '@/components/ui/theme-toggle'

/**
 * Authenticated app layout — wraps all routes under (app)/.
 *
 * Auth check (userId) is handled by Clerk middleware; this layout
 * additionally enforces org membership and redirects to /org-setup
 * when the user has not yet created or joined an organisation.
 *
 * Uses persistent collapsible left sidebar (shadcn Sidebar).
 * Sidebar state persisted via cookie. Toggle with Cmd/Ctrl+B.
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

  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get('sidebar_state')?.value !== 'false'

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <main id="main-content" className="flex-1 animate-page-in">
          {children}
        </main>
      </SidebarInset>
      <ChatWidgetShell />
    </SidebarProvider>
  )
}
