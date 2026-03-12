/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SettingsSidebar } from '../settings-sidebar'

// Mock next/navigation
const mockPathname = vi.hoisted(() => ({ value: '/settings/org-profile' }))
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname.value,
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

describe('SettingsSidebar', () => {
  beforeEach(() => {
    mockPathname.value = '/settings/org-profile'
  })

  it('renders all 10 nav items (desktop + mobile)', () => {
    render(<SettingsSidebar />)

    // Each item appears twice: once in the desktop sidebar link, once in the mobile select
    expect(screen.getAllByText('Org Profile').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Team').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Roles').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Block Types').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Brand Kit').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Integrations').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Routing Policies').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Notifications').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('API Keys').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Audit Log').length).toBeGreaterThanOrEqual(1)
  })

  it('renders section group labels', () => {
    render(<SettingsSidebar />)

    expect(screen.getByText('Organization')).toBeDefined()
    expect(screen.getByText('Content')).toBeDefined()
    expect(screen.getByText('System')).toBeDefined()
  })

  it('highlights the active section', () => {
    mockPathname.value = '/settings/team'
    render(<SettingsSidebar />)

    const teamLink = screen.getByRole('link', { name: /Team/i })
    expect(teamLink.getAttribute('aria-current')).toBe('page')
  })

  it('does not highlight inactive sections', () => {
    mockPathname.value = '/settings/org-profile'
    render(<SettingsSidebar />)

    const teamLink = screen.getByRole('link', { name: /Team/i })
    expect(teamLink.getAttribute('aria-current')).toBeNull()
  })

  it('renders mobile dropdown with all options', () => {
    render(<SettingsSidebar />)

    const select = screen.getByLabelText('Settings section')
    expect(select).toBeDefined()
    expect(select.tagName).toBe('SELECT')

    // Check optgroups
    const optgroups = select.querySelectorAll('optgroup')
    expect(optgroups.length).toBe(3)
    expect(optgroups[0].getAttribute('label')).toBe('Organization')
    expect(optgroups[1].getAttribute('label')).toBe('Content')
    expect(optgroups[2].getAttribute('label')).toBe('System')
  })

  it('renders correct hrefs for all links', () => {
    render(<SettingsSidebar />)

    const links = screen.getAllByRole('link')
    const hrefs = links.map((l) => l.getAttribute('href'))

    expect(hrefs).toContain('/settings/org-profile')
    expect(hrefs).toContain('/settings/team')
    expect(hrefs).toContain('/settings/roles')
    expect(hrefs).toContain('/settings/block-types')
    expect(hrefs).toContain('/settings/brand')
    expect(hrefs).toContain('/settings/integrations')
    expect(hrefs).toContain('/settings/routing')
    expect(hrefs).toContain('/settings/notifications')
    expect(hrefs).toContain('/settings/api-keys')
    expect(hrefs).toContain('/settings/audit-log')
  })

  it('matches subroutes as active (e.g. /settings/block-types/abc)', () => {
    mockPathname.value = '/settings/block-types/some-id'
    render(<SettingsSidebar />)

    const blockTypesLink = screen.getByRole('link', { name: /Block Types/i })
    expect(blockTypesLink.getAttribute('aria-current')).toBe('page')
  })
})
