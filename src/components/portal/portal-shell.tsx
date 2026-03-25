'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, FileText, MessageSquarePlus } from 'lucide-react'
import { usePortal } from './portal-context'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  featureKey: 'dashboard_enabled' | 'documents_enabled' | 'requests_enabled'
}

export function PortalShell({ children }: { children: React.ReactNode }) {
  const { portalConfig, branding, token } = usePortal()
  const pathname = usePathname()

  const basePath = `/portal/${token}`

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      href: basePath,
      icon: <LayoutDashboard className="w-4 h-4" />,
      featureKey: 'dashboard_enabled',
    },
    {
      label: 'Documents',
      href: `${basePath}/documents`,
      icon: <FileText className="w-4 h-4" />,
      featureKey: 'documents_enabled',
    },
    {
      label: 'Requests',
      href: `${basePath}/requests`,
      icon: <MessageSquarePlus className="w-4 h-4" />,
      featureKey: 'requests_enabled',
    },
  ]

  const visibleNav = navItems.filter((item) => portalConfig[item.featureKey])

  const orgName = branding?.org_name || portalConfig.name || 'Client Portal'
  const logoUrl = branding?.logo_url

  return (
    <div className="min-h-screen flex flex-col bg-[var(--portal-bg)]">
      {/* Header */}
      <header className="border-b border-[var(--portal-card-border)] bg-[var(--portal-card-bg)] sticky top-0 z-10 shadow-[var(--portal-shadow-sm)] transition-shadow duration-300">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          {logoUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={logoUrl}
              alt={`${orgName} logo`}
              className="h-8 w-auto flex-shrink-0"
              width={32}
              height={32}
            />
          )}
          <span className="text-sm font-semibold text-[var(--portal-text-primary)] truncate">
            {orgName}
          </span>
        </div>

        {/* Navigation -- horizontal scroll strip on mobile */}
        {visibleNav.length > 0 && (
          <nav aria-label="Portal navigation" className="border-t border-[var(--portal-card-border)]/50">
            <div className="max-w-5xl mx-auto px-4 sm:px-6">
              <div className="flex overflow-x-auto scrollbar-none -mb-px">
                {visibleNav.map((item) => {
                  const isActive =
                    item.href === basePath
                      ? pathname === basePath
                      : pathname.startsWith(item.href)

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`
                        flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap
                        border-b-2 min-h-[44px]
                        transition-[color,border-color] duration-[var(--portal-transition)]
                        ${
                          isActive
                            ? 'border-[var(--portal-primary)] text-[var(--portal-primary)]'
                            : 'border-transparent text-[var(--portal-text-secondary)] hover:text-[var(--portal-text-primary)] hover:border-[var(--portal-card-border-hover)]'
                        }
                      `}
                    >
                      {item.icon}
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          </nav>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--portal-card-border)] bg-[var(--portal-card-bg)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <p className="text-center text-xs text-[var(--portal-text-muted)]">
            Powered by Ops OS
          </p>
        </div>
      </footer>
    </div>
  )
}
