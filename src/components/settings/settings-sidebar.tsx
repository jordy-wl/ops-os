'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Building2,
  Users,
  Shield,
  LayoutGrid,
  Palette,
  Plug,
  Route,
  Bell,
  Key,
  ScrollText,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SettingsNavItem {
  href: string
  label: string
  icon: React.ElementType
}

const SETTINGS_SECTIONS: { label: string; items: SettingsNavItem[] }[] = [
  {
    label: 'Organization',
    items: [
      { href: '/settings/org-profile', label: 'Org Profile', icon: Building2 },
      { href: '/settings/team', label: 'Team', icon: Users },
      { href: '/settings/roles', label: 'Roles', icon: Shield },
    ],
  },
  {
    label: 'Content',
    items: [
      { href: '/settings/block-types', label: 'Block Types', icon: LayoutGrid },
      { href: '/settings/brand', label: 'Brand Kit', icon: Palette },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/settings/integrations', label: 'Integrations', icon: Plug },
      { href: '/settings/routing', label: 'Routing Policies', icon: Route },
      { href: '/settings/notifications', label: 'Notifications', icon: Bell },
      { href: '/settings/api-keys', label: 'API Keys', icon: Key },
      { href: '/settings/audit-log', label: 'Audit Log', icon: ScrollText },
    ],
  },
]

/**
 * SettingsSidebar — persistent sidebar navigation for the settings area.
 * Groups sections logically: Organization, Content, System.
 * Active section highlighted. Collapses to dropdown on mobile.
 */
export function SettingsSidebar() {
  const pathname = usePathname()

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <>
      {/* Desktop sidebar */}
      <nav
        className="hidden md:block w-56 shrink-0 space-y-6"
        aria-label="Settings navigation"
      >
        {SETTINGS_SECTIONS.map((section) => (
          <div key={section.label}>
            <h3 className="mb-1.5 px-3 text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
              {section.label}
            </h3>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-1.5 text-[13px] font-medium transition-colors border-l-2',
                      isActive(item.href)
                        ? 'border-primary text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    )}
                    aria-current={isActive(item.href) ? 'page' : undefined}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Mobile dropdown */}
      <MobileSettingsNav pathname={pathname} />
    </>
  )
}

function MobileSettingsNav({ pathname }: { pathname: string }) {
  const allItems = SETTINGS_SECTIONS.flatMap((s) => s.items)
  const current = allItems.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/')
  )

  return (
    <div className="md:hidden mb-4">
      <label htmlFor="settings-nav-select" className="sr-only">
        Settings section
      </label>
      <select
        id="settings-nav-select"
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-[13px] text-foreground"
        value={current?.href ?? '/settings/org-profile'}
        onChange={(e) => {
          window.location.href = e.target.value
        }}
      >
        {SETTINGS_SECTIONS.map((section) => (
          <optgroup key={section.label} label={section.label}>
            {section.items.map((item) => (
              <option key={item.href} value={item.href}>
                {item.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}
