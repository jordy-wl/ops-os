'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Briefcase,
  LayoutGrid,
  GitBranch,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/my-work', label: 'My Work', icon: Briefcase },
  { href: '/library/blocks', label: 'Blocks', icon: LayoutGrid },
  { href: '/workflows', label: 'Workflows', icon: GitBranch },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const

export function BottomTabBar() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 flex h-12 items-center justify-around border-t bg-background md:hidden"
      aria-label="Mobile navigation"
    >
      {TABS.map(({ href, label, icon: Icon }) => {
        const isActive =
          pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 px-2 py-1 text-[10px] font-medium transition-colors',
              isActive
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
            {isActive && (
              <span className="absolute bottom-0 h-0.5 w-8 rounded-full bg-primary" />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
