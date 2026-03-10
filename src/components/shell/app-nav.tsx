'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { OrganizationSwitcher, UserButton, ClerkLoading, ClerkLoaded } from '@clerk/nextjs'
import {
  LayoutDashboard,
  Briefcase,
  GitBranch,
  MessageSquare,
  Library,
  LayoutGrid,
  Plug,
  FileText,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavLink {
  href: string
  label: string
  icon: React.ElementType
}

const PRIMARY_LINKS: NavLink[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/my-work', label: 'My Work', icon: Briefcase },
  { href: '/workflows', label: 'Workflows', icon: GitBranch },
]

const LIBRARY_LINKS: NavLink[] = [
  { href: '/library/blocks', label: 'Blocks', icon: LayoutGrid },
  { href: '/library/integrations', label: 'Integrations', icon: Plug },
  { href: '/library/documents', label: 'Documents', icon: FileText },
]

const TRAILING_LINKS: NavLink[] = [
  { href: '/chat', label: 'Chat', icon: MessageSquare },
]

/**
 * AppNav — primary application navigation shell.
 *
 * Structure: Dashboard | My Work | Workflows | Library (dropdown) | Chat
 * Clerk OrganizationSwitcher + UserButton on the right.
 * Responsive at 375px and 1280px. Keyboard accessible.
 */
export function AppNav() {
  const pathname = usePathname()
  const [libraryOpen, setLibraryOpen] = useState(false)
  const libraryRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (libraryRef.current && !libraryRef.current.contains(e.target as Node)) {
        setLibraryOpen(false)
      }
    }
    if (libraryOpen) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [libraryOpen])

  // Close dropdown on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLibraryOpen(false)
    }
    if (libraryOpen) {
      document.addEventListener('keydown', handleKey)
      return () => document.removeEventListener('keydown', handleKey)
    }
  }, [libraryOpen])

  const activeLibraryLink = LIBRARY_LINKS.find(({ href }) => pathname.startsWith(href))
  const isLibraryActive = !!activeLibraryLink

  function renderLink({ href, label, icon: Icon }: NavLink) {
    return (
      <Link
        key={href}
        href={href}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900',
          pathname.startsWith(href)
            ? 'bg-gray-100 text-gray-900'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        )}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {label}
      </Link>
    )
  }

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center border-b bg-white px-4 gap-3">
      {/* Skip link for accessibility */}
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

      {/* Nav links */}
      <nav
        aria-label="Main navigation"
        className="flex items-center gap-1 flex-1 overflow-x-auto"
      >
        {PRIMARY_LINKS.map(renderLink)}

        {/* Library dropdown */}
        <div ref={libraryRef} className="relative">
          <button
            type="button"
            onClick={() => setLibraryOpen((prev) => !prev)}
            aria-expanded={libraryOpen}
            aria-haspopup="true"
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900',
              isLibraryActive
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <Library className="h-4 w-4 shrink-0" aria-hidden="true" />
            {activeLibraryLink ? `Library: ${activeLibraryLink.label}` : 'Library'}
            <ChevronDown
              className={cn('h-3 w-3 transition-transform', libraryOpen && 'rotate-180')}
              aria-hidden="true"
            />
          </button>

          {libraryOpen && (
            <div
              role="menu"
              className="absolute left-0 top-full mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg z-50"
            >
              {LIBRARY_LINKS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  role="menuitem"
                  onClick={() => setLibraryOpen(false)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                    'focus-visible:outline-none focus-visible:bg-gray-50',
                    pathname.startsWith(href)
                      ? 'bg-gray-50 text-gray-900 font-medium'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {TRAILING_LINKS.map(renderLink)}
      </nav>

      {/* Auth controls */}
      <div className="flex items-center gap-2 shrink-0 ml-auto">
        <ClerkLoading>
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
          <OrganizationSwitcher
            hidePersonal
            afterSelectOrganizationUrl="/dashboard"
            afterLeaveOrganizationUrl="/org-setup"
            afterCreateOrganizationUrl="/dashboard"
          />
          <UserButton afterSignOutUrl="/sign-in" />
        </ClerkLoaded>
      </div>
    </header>
  )
}
