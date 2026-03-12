'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  OrganizationSwitcher,
  UserButton,
  ClerkLoading,
  ClerkLoaded,
} from '@clerk/nextjs'
import {
  LayoutDashboard,
  Briefcase,
  GitBranch,
  LayoutGrid,
  Plug,
  FileText,
  Settings,
  Building2,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
}

const MAIN_NAV: NavItem[] = [
  { href: '/org', label: 'Organisation', icon: Building2 },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/my-work', label: 'My Work', icon: Briefcase },
  { href: '/workflows', label: 'Workflows', icon: GitBranch },
]

const LIBRARY_NAV: NavItem[] = [
  { href: '/library/blocks', label: 'Blocks', icon: LayoutGrid },
  { href: '/library/documents', label: 'Documents', icon: FileText },
  { href: '/library/integrations', label: 'Integrations', icon: Plug },
]

const SETTINGS_NAV: NavItem[] = [
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function AppSidebar() {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-1 py-1.5">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-semibold text-sm group-data-[collapsible=icon]:hidden"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
              O
            </span>
            <span>Ops OS</span>
          </Link>
          <Link
            href="/dashboard"
            className="hidden group-data-[collapsible=icon]:flex items-center justify-center"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
              O
            </span>
          </Link>
        </div>
        <div className="group-data-[collapsible=icon]:hidden">
          <ClerkLoading>
            <div
              className="h-8 w-full rounded bg-sidebar-accent animate-pulse"
              role="status"
              aria-label="Loading organisation switcher"
            />
          </ClerkLoading>
          <ClerkLoaded>
            <OrganizationSwitcher
              hidePersonal
              afterSelectOrganizationUrl="/dashboard"
              afterLeaveOrganizationUrl="/org-setup"
              afterCreateOrganizationUrl="/dashboard"
              appearance={{
                elements: {
                  rootBox: 'w-full',
                  organizationSwitcherTrigger: 'w-full justify-between px-2 py-1.5 rounded-md hover:bg-sidebar-accent text-sm',
                },
              }}
            />
          </ClerkLoaded>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {MAIN_NAV.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)} tooltip={item.label}>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Library</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {LIBRARY_NAV.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)} tooltip={item.label}>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {SETTINGS_NAV.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)} tooltip={item.label}>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-1 py-1">
          <ClerkLoading>
            <div
              className="h-8 w-8 rounded-full bg-sidebar-accent animate-pulse"
              role="status"
              aria-label="Loading user menu"
            />
          </ClerkLoading>
          <ClerkLoaded>
            <UserButton
              afterSignOutUrl="/sign-in"
              appearance={{
                elements: {
                  avatarBox: 'h-7 w-7',
                },
              }}
            />
          </ClerkLoaded>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
