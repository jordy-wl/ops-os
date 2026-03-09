'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { OrganizationSwitcher, UserButton, ClerkLoading, ClerkLoaded } from '@clerk/nextjs'
import { LayoutGrid, GitBranch, MessageSquare, ClipboardList, Plug } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavLink {
  href: string
  label: string
  icon: React.ElementType
  stub?: boolean
}

const NAV_LINKS: NavLink[] = [
  { href: '/blocks', label: 'Blocks', icon: LayoutGrid },
  { href: '/workflows', label: 'Workflows', icon: GitBranch },
  { href: '/tasks', label: 'Tasks', icon: ClipboardList },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/integrations', label: 'Integrations', icon: Plug },
]

/**
 * AppNav — primary application navigation shell.
 *
 * Contains: logo, nav links (Blocks, Workflows stub, Chat stub),
 * Clerk OrganizationSwitcher, and Clerk UserButton (includes sign out).
 * Responsive at 375px and 1280px. Keyboard accessible.
 */
export function AppNav() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center border-b bg-white px-4 gap-3">
      {/* Skip link for accessibility — keyboard users skip to main content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow"
      >
        Skip to main content
      </a>

      {/* Logo */}
      <Link
        href="/dashboard"
        className="font-semibold text-sm shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 rounded"
      >
        Ops OS
      </Link>

      {/* Nav links — scrollable on small screens */}
      <nav
        aria-label="Main navigation"
        className="flex items-center gap-1 flex-1 overflow-x-auto"
      >
        {NAV_LINKS.map(({ href, label, icon: Icon, stub }) => (
          <Link
            key={href}
            href={stub ? '#' : href}
            aria-disabled={stub}
            aria-label={stub ? `${label} — coming soon` : label}
            tabIndex={stub ? -1 : 0}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900',
              pathname.startsWith(href) && !stub
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
              stub && 'opacity-40 pointer-events-none'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Auth controls — loading skeleton while Clerk initialises */}
      <div className="flex items-center gap-2 shrink-0 ml-auto">
        <ClerkLoading>
          {/* Skeleton placeholder prevents layout shift while Clerk loads */}
          <div
            className="h-8 w-32 rounded bg-gray-100 animate-pulse"
            role="status"
            aria-label="Loading organisation switcher"
          />
          <div
            className="h-8 w-8 rounded-full bg-gray-100 animate-pulse"
            role="status"
            aria-label="Loading user menu"
          />
        </ClerkLoading>

        <ClerkLoaded>
          {/* OrganizationSwitcher only renders when user belongs to ≥1 org */}
          <OrganizationSwitcher
            hidePersonal
            afterSelectOrganizationUrl="/dashboard"
            afterLeaveOrganizationUrl="/org-setup"
            afterCreateOrganizationUrl="/dashboard"
          />
          {/* UserButton includes sign out — afterSignOutUrl sends to /sign-in */}
          <UserButton afterSignOutUrl="/sign-in" />
        </ClerkLoaded>
      </div>
    </header>
  )
}
