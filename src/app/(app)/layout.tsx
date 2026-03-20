import { cookies } from 'next/headers'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { AppSidebar } from '@/components/shell/app-sidebar'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { ChatWidgetShell } from '@/components/chat/chat-widget-shell'
import { TimerWidgetShell } from '@/components/timer/timer-widget-shell'
import { BottomTabBar } from '@/components/shell/bottom-tab-bar'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { CommandPalette } from '@/components/shell/command-palette'

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
    <TimerWidgetShell>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-30 flex h-11 shrink-0 items-center gap-2 border-b bg-background px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <div className="flex items-center gap-1 text-[13px] text-muted-foreground">
              <span>Ops OS</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <CommandPalette />
              <ThemeToggle />
            </div>
          </header>
          <main id="main-content" className="flex-1 overflow-x-hidden animate-page-in pb-16 md:pb-0">
            {children}
          </main>
        </SidebarInset>
        <ChatWidgetShell />
        <BottomTabBar />
      </SidebarProvider>
    </TimerWidgetShell>
  )
}
