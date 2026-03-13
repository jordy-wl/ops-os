'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutGrid,
  ClipboardList,
  GitBranch,
  FileText,
  Plug,
  Settings,
  Building2,
  BarChart3,
  Search,
} from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  shortcut?: string
}

const NAV_ITEMS: { group: string; items: NavItem[] }[] = [
  {
    group: 'Navigation',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: BarChart3, shortcut: 'G D' },
      { label: 'My Work', href: '/my-work', icon: ClipboardList, shortcut: 'G M' },
      { label: 'Blocks', href: '/library/blocks', icon: LayoutGrid, shortcut: 'G B' },
      { label: 'Workflows', href: '/workflows', icon: GitBranch, shortcut: 'G W' },
      { label: 'Documents', href: '/library/documents', icon: FileText },
      { label: 'Integrations', href: '/library/integrations', icon: Plug },
      { label: 'Tasks', href: '/tasks', icon: ClipboardList },
    ],
  },
  {
    group: 'Settings',
    items: [
      { label: 'Settings', href: '/settings', icon: Settings },
      { label: 'Organization', href: '/org', icon: Building2 },
    ],
  },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setOpen((prev) => !prev)
    }
  }, [])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const navigate = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  return (
    <>
      {/* Trigger button in header */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 rounded-md border border-border bg-background px-3 h-7 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Open command palette"
      >
        <Search className="h-3 w-3" aria-hidden="true" />
        <span>Search...</span>
        <kbd className="ml-2 inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      {/* Command dialog */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {NAV_ITEMS.map(({ group, items }) => (
            <CommandGroup key={group} heading={group}>
              {items.map((item) => {
                const Icon = item.icon
                return (
                  <CommandItem
                    key={item.href}
                    value={item.label}
                    onSelect={() => navigate(item.href)}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <span>{item.label}</span>
                    {item.shortcut && (
                      <CommandShortcut>{item.shortcut}</CommandShortcut>
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  )
}
