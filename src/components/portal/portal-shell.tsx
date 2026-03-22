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
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          {logoUrl && (
            <img
              src={logoUrl}
              alt={`${orgName} logo`}
              className="h-8 w-auto flex-shrink-0"
              width={32}
              height={32}
            />
          )}
          <span className="text-sm font-semibold text-gray-900 truncate">
            {orgName}
          </span>
        </div>

        {/* Navigation — horizontal scroll strip on mobile */}
        {visibleNav.length > 0 && (
          <nav aria-label="Portal navigation" className="border-t border-gray-100">
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
                        border-b-2 transition-colors min-h-[44px]
                        ${
                          isActive
                            ? 'border-[var(--portal-primary)] text-[var(--portal-primary)]'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <p className="text-center text-xs text-gray-400">
            Powered by Ops OS
          </p>
        </div>
      </footer>
    </div>
  )
}
