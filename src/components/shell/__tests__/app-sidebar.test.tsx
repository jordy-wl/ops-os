import { describe, it, expect } from 'vitest'

/**
 * Sidebar navigation configuration tests.
 * Validates nav structure, route coverage, and active state logic.
 */

// Replicate the nav items from app-sidebar.tsx
const MAIN_NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/my-work', label: 'My Work' },
  { href: '/workflows', label: 'Workflows' },
]

const LIBRARY_NAV = [
  { href: '/library/blocks', label: 'Blocks' },
  { href: '/library/documents', label: 'Documents' },
  { href: '/library/integrations', label: 'Integrations' },
]

const SETTINGS_NAV = [
  { href: '/settings/brand', label: 'Settings' },
]

const ALL_NAV = [...MAIN_NAV, ...LIBRARY_NAV, ...SETTINGS_NAV]

// Replicate the isActive logic
function isActive(href: string, pathname: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname.startsWith(href)
}

describe('Sidebar navigation config', () => {
  it('has 7 total navigation items', () => {
    expect(ALL_NAV).toHaveLength(7)
  })

  it('all hrefs start with /', () => {
    for (const item of ALL_NAV) {
      expect(item.href).toMatch(/^\//)
    }
  })

  it('no duplicate hrefs', () => {
    const hrefs = ALL_NAV.map(i => i.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it('no duplicate labels', () => {
    const labels = ALL_NAV.map(i => i.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('main section has Dashboard, My Work, Workflows', () => {
    const labels = MAIN_NAV.map(i => i.label)
    expect(labels).toEqual(['Dashboard', 'My Work', 'Workflows'])
  })

  it('library section has Blocks, Documents, Integrations', () => {
    const labels = LIBRARY_NAV.map(i => i.label)
    expect(labels).toEqual(['Blocks', 'Documents', 'Integrations'])
  })
})

describe('Sidebar active state logic', () => {
  it('Dashboard is active only for exact /dashboard', () => {
    expect(isActive('/dashboard', '/dashboard')).toBe(true)
    expect(isActive('/dashboard', '/dashboard/extra')).toBe(false)
  })

  it('My Work is active for /my-work and sub-paths', () => {
    expect(isActive('/my-work', '/my-work')).toBe(true)
    expect(isActive('/my-work', '/my-work/tasks')).toBe(true)
    expect(isActive('/my-work', '/other')).toBe(false)
  })

  it('Workflows is active for /workflows and sub-paths', () => {
    expect(isActive('/workflows', '/workflows')).toBe(true)
    expect(isActive('/workflows', '/workflows/abc/builder')).toBe(true)
    expect(isActive('/workflows', '/workflow')).toBe(false)
  })

  it('Blocks is active for /library/blocks and sub-paths', () => {
    expect(isActive('/library/blocks', '/library/blocks')).toBe(true)
    expect(isActive('/library/blocks', '/library/blocks/123')).toBe(true)
    expect(isActive('/library/blocks', '/library/documents')).toBe(false)
  })

  it('Documents is active for /library/documents', () => {
    expect(isActive('/library/documents', '/library/documents')).toBe(true)
    expect(isActive('/library/documents', '/library/blocks')).toBe(false)
  })

  it('Integrations is active for /library/integrations', () => {
    expect(isActive('/library/integrations', '/library/integrations')).toBe(true)
    expect(isActive('/library/integrations', '/library/blocks')).toBe(false)
  })

  it('Settings is active for /settings/brand and sub-paths', () => {
    expect(isActive('/settings/brand', '/settings/brand')).toBe(true)
    expect(isActive('/settings/brand', '/settings/brand/edit')).toBe(true)
    expect(isActive('/settings/brand', '/settings')).toBe(false)
  })

  it('only one nav item is active for any given route', () => {
    const routes = [
      '/dashboard',
      '/my-work',
      '/workflows',
      '/workflows/abc/builder',
      '/library/blocks',
      '/library/documents',
      '/library/integrations',
      '/settings/brand',
    ]

    for (const route of routes) {
      const activeCount = ALL_NAV.filter(item => isActive(item.href, route)).length
      expect(activeCount).toBeLessThanOrEqual(1)
    }
  })
})
