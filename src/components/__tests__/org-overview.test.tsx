/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import OrgOverviewPage from '@/app/(app)/org/page'
import type { OrgOverview } from '@/lib/org/overview'

// ─── Mock next/navigation ───────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  usePathname: () => '/org',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

// ─── Mock next/link ─────────────────────────────────────────────────────────

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

// ─── Mock Tabs (Radix Tabs doesn't work in jsdom) ──────────────────────────

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <div data-testid="tabs" {...props}>{children}</div>,
  TabsList: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <div role="tablist" {...props}>{children}</div>,
  TabsTrigger: ({ children, value, ...props }: { children: React.ReactNode; value: string; [key: string]: unknown }) => <button role="tab" data-value={value} {...props}>{children}</button>,
  TabsContent: ({ children }: { children: React.ReactNode; [key: string]: unknown }) => <div>{children}</div>,
}))

// ─── Test Data ──────────────────────────────────────────────────────────────

const mockOverview: OrgOverview = {
  org: {
    id: 'org-1',
    name: 'Thornfield Capital',
    slug: 'thornfield',
    org_level: 'root',
    created_at: '2026-01-15T10:00:00Z',
  },
  hierarchy: [
    { id: 'org-1', name: 'Thornfield HQ', level: 'root', parent_org_id: null },
    { id: 'org-2', name: 'London Office', level: 'suborg', parent_org_id: 'org-1' },
  ],
  team: {
    total: 42,
    by_role: {
      'ops-admin': 5,
      'ops-user': 31,
      'compliance-approver': 6,
    },
    recent: [
      { id: 'tm-1', name: 'Alice Smith', role: 'ops-admin' },
      { id: 'tm-2', name: 'Bob Jones', role: 'ops-user' },
    ],
  },
  blocks: {
    total: 97,
    by_type: {
      client: 22,
      deal: 18,
      project: 33,
      contract: 24,
    },
  },
  workflows: {
    active: 11,
    completed: 29,
    total: 40,
  },
  recent_events: [
    {
      id: 'evt-1',
      event_type: 'block.created',
      created_at: new Date(Date.now() - 300000).toISOString(), // 5 min ago
      payload: { block_type: 'client' },
    },
    {
      id: 'evt-2',
      event_type: 'workflow.step.completed',
      created_at: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
      payload: { step: 'kyc_review' },
    },
  ],
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function mockFetchSuccess(data: OrgOverview) {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url === '/api/org/block-hierarchy') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { hierarchy: [] }, error: null }),
      })
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ data, error: null }),
    })
  }) as unknown as typeof fetch
}

function mockFetchError(status: number, message: string) {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url === '/api/org/block-hierarchy') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { hierarchy: [] }, error: null }),
      })
    }
    return Promise.resolve({
      ok: false,
      status,
      json: () => Promise.resolve({ data: null, error: { message, code: 'test/error' } }),
    })
  }) as unknown as typeof fetch
}

function mockFetchPending() {
  global.fetch = vi.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch
}

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('OrgOverviewPage', () => {
  describe('Loading state', () => {
    it('shows skeleton while data is loading', () => {
      mockFetchPending()
      render(<OrgOverviewPage />)

      const skeleton = document.querySelector('.animate-pulse')
      expect(skeleton).toBeTruthy()
    })

    it('does not show error or content while loading', () => {
      mockFetchPending()
      render(<OrgOverviewPage />)

      expect(screen.queryByText('Failed to load organisation')).toBeNull()
      expect(screen.queryByText('Thornfield Capital')).toBeNull()
    })
  })

  describe('Error state', () => {
    it('shows error message when API fails', async () => {
      mockFetchError(500, 'Internal server error')
      render(<OrgOverviewPage />)

      await waitFor(() => {
        expect(screen.getByText('Failed to load organisation')).toBeTruthy()
        expect(screen.getByText('Internal server error')).toBeTruthy()
      })
    })

    it('shows retry button on error', async () => {
      mockFetchError(500, 'Server error')
      render(<OrgOverviewPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy()
      })
    })

    it('retries fetch on retry button click', async () => {
      mockFetchError(500, 'Server error')
      render(<OrgOverviewPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy()
      })

      // Replace mock with success response
      mockFetchSuccess(mockOverview)

      fireEvent.click(screen.getByRole('button', { name: /retry/i }))

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Thornfield Capital' })).toBeTruthy()
      })
    })
  })

  describe('Empty state', () => {
    it('shows empty state when data is null', async () => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === '/api/org/block-hierarchy') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: { hierarchy: [] }, error: null }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: null, error: null }),
        })
      }) as unknown as typeof fetch

      render(<OrgOverviewPage />)

      await waitFor(() => {
        expect(screen.getByText('No organisation data')).toBeTruthy()
      })
    })

    it('shows configure org link in empty state', async () => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === '/api/org/block-hierarchy') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: { hierarchy: [] }, error: null }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: null, error: null }),
        })
      }) as unknown as typeof fetch

      render(<OrgOverviewPage />)

      await waitFor(() => {
        expect(screen.getByText('Configure Org')).toBeTruthy()
      })
    })
  })

  describe('Hero section with org name and metrics', () => {
    it('renders org name as heading', async () => {
      mockFetchSuccess(mockOverview)
      render(<OrgOverviewPage />)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Thornfield Capital' })).toBeTruthy()
      })
    })

    it('renders organisation overview subtitle', async () => {
      mockFetchSuccess(mockOverview)
      render(<OrgOverviewPage />)

      await waitFor(() => {
        expect(screen.getByText('Organisation Overview')).toBeTruthy()
      })
    })

    it('renders org slug', async () => {
      mockFetchSuccess(mockOverview)
      render(<OrgOverviewPage />)

      await waitFor(() => {
        expect(screen.getByText('thornfield')).toBeTruthy()
      })
    })

    it('renders 4 metric cards with correct values', async () => {
      mockFetchSuccess(mockOverview)
      render(<OrgOverviewPage />)

      await waitFor(() => {
        // Each metric label is unique
        expect(screen.getByText('Total Blocks')).toBeTruthy()
        expect(screen.getByText('Team Size')).toBeTruthy()
        expect(screen.getByText('Active Workflows')).toBeTruthy()
        expect(screen.getByText('Completed Workflows')).toBeTruthy()

        // Values may appear in multiple places (metric card + section), verify at least one
        expect(screen.getAllByText('97').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('42').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('11').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('29').length).toBeGreaterThanOrEqual(1)
      })
    })
  })

  describe('Team summary section (Team tab)', () => {
    it('shows total team members', async () => {
      mockFetchSuccess(mockOverview)
      render(<OrgOverviewPage />)

      await waitFor(() => {
        expect(screen.getByText('Team Summary')).toBeTruthy()
        expect(screen.getByText('team members')).toBeTruthy()
        expect(screen.getAllByText('42').length).toBeGreaterThanOrEqual(1)
      })
    })

    it('shows role distribution', async () => {
      mockFetchSuccess(mockOverview)
      render(<OrgOverviewPage />)

      await waitFor(() => {
        expect(screen.getAllByText('Ops Admin').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('Ops User').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('Compliance Approver').length).toBeGreaterThanOrEqual(1)
      })
    })

    it('shows recent team additions', async () => {
      mockFetchSuccess(mockOverview)
      render(<OrgOverviewPage />)

      await waitFor(() => {
        expect(screen.getByText('Recent Additions')).toBeTruthy()
        expect(screen.getByText('Alice Smith')).toBeTruthy()
        expect(screen.getByText('Bob Jones')).toBeTruthy()
      })
    })

    it('shows Manage Team link', async () => {
      mockFetchSuccess(mockOverview)
      render(<OrgOverviewPage />)

      await waitFor(() => {
        const manageLink = screen.getByText('Manage Team')
        expect(manageLink.closest('a')).toBeTruthy()
        expect(manageLink.closest('a')?.getAttribute('href')).toBe('/settings/team')
      })
    })

    it('renders tab triggers for all 7 tabs', async () => {
      mockFetchSuccess(mockOverview)
      render(<OrgOverviewPage />)

      await waitFor(() => {
        const tabs = screen.getAllByRole('tab')
        expect(tabs.length).toBe(7)
        expect(screen.getByRole('tab', { name: 'Overview' })).toBeTruthy()
        expect(screen.getByRole('tab', { name: 'Structure' })).toBeTruthy()
        expect(screen.getByRole('tab', { name: 'Details' })).toBeTruthy()
        expect(screen.getByRole('tab', { name: 'Revenue' })).toBeTruthy()
        expect(screen.getByRole('tab', { name: 'Strategy' })).toBeTruthy()
        expect(screen.getByRole('tab', { name: 'Offerings' })).toBeTruthy()
        expect(screen.getByRole('tab', { name: 'Team' })).toBeTruthy()
      })
    })
  })

  describe('Block distribution section', () => {
    it('shows total block count', async () => {
      mockFetchSuccess(mockOverview)
      render(<OrgOverviewPage />)

      await waitFor(() => {
        expect(screen.getByText('Block Distribution')).toBeTruthy()
        expect(screen.getByText('total blocks')).toBeTruthy()
      })
    })

    it('shows block types with counts', async () => {
      mockFetchSuccess(mockOverview)
      render(<OrgOverviewPage />)

      await waitFor(() => {
        expect(screen.getByText('Client')).toBeTruthy()
        expect(screen.getByText('Deal')).toBeTruthy()
        expect(screen.getByText('Project')).toBeTruthy()
        expect(screen.getByText('Contract')).toBeTruthy()
      })
    })

    it('shows link to blocks library in Overview tab', async () => {
      mockFetchSuccess(mockOverview)
      render(<OrgOverviewPage />)

      await waitFor(() => {
        const viewAllLinks = screen.getAllByText('View all')
        const blocksLink = viewAllLinks.find(
          (el) => el.closest('a')?.getAttribute('href') === '/library/blocks'
        )
        expect(blocksLink).toBeTruthy()
      })
    })

    it('shows empty message when no blocks exist', async () => {
      const emptyBlocks: OrgOverview = {
        ...mockOverview,
        blocks: { total: 0, by_type: {} },
      }
      mockFetchSuccess(emptyBlocks)
      render(<OrgOverviewPage />)

      await waitFor(() => {
        expect(screen.getByText('No blocks created yet.')).toBeTruthy()
      })
    })
  })

  describe('Recent events timeline', () => {
    it('renders recent events', async () => {
      mockFetchSuccess(mockOverview)
      render(<OrgOverviewPage />)

      await waitFor(() => {
        expect(screen.getByText('Recent Activity')).toBeTruthy()
        expect(screen.getByText('Block Created')).toBeTruthy()
        expect(screen.getByText('Workflow Step Completed')).toBeTruthy()
      })
    })

    it('shows relative timestamps', async () => {
      mockFetchSuccess(mockOverview)
      render(<OrgOverviewPage />)

      await waitFor(() => {
        // 5 minutes ago
        expect(screen.getByText('5m ago')).toBeTruthy()
        // 2 hours ago
        expect(screen.getByText('2h ago')).toBeTruthy()
      })
    })

    it('shows empty message when no events exist', async () => {
      const noEvents: OrgOverview = {
        ...mockOverview,
        recent_events: [],
      }
      mockFetchSuccess(noEvents)
      render(<OrgOverviewPage />)

      await waitFor(() => {
        expect(screen.getByText('No recent events recorded.')).toBeTruthy()
      })
    })
  })

  describe('Quick actions', () => {
    it('renders quick action links', async () => {
      mockFetchSuccess(mockOverview)
      render(<OrgOverviewPage />)

      await waitFor(() => {
        // There are 2 "Configure Org" elements on the page — the quick action and the empty state CTA are not both shown,
        // but quick actions bar renders when data is present
        const configLinks = screen.getAllByText('Configure Org')
        expect(configLinks.length).toBeGreaterThanOrEqual(1)
        expect(screen.getByText('Add Team Member')).toBeTruthy()
        expect(screen.getByText('Create Sub-Org')).toBeTruthy()
      })
    })
  })

  describe('Hierarchy section', () => {
    it('renders hierarchy when sub-orgs exist', async () => {
      mockFetchSuccess(mockOverview)
      render(<OrgOverviewPage />)

      await waitFor(() => {
        expect(screen.getByText('Organisation Hierarchy')).toBeTruthy()
        expect(screen.getByText('London Office')).toBeTruthy()
      })
    })

    it('hides hierarchy when no sub-orgs exist', async () => {
      const noHierarchy: OrgOverview = {
        ...mockOverview,
        hierarchy: [],
      }
      mockFetchSuccess(noHierarchy)
      render(<OrgOverviewPage />)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Thornfield Capital' })).toBeTruthy()
      })

      expect(screen.queryByText('Organisation Hierarchy')).toBeNull()
    })
  })

  describe('API contract', () => {
    it('calls /api/org/overview on mount', async () => {
      mockFetchSuccess(mockOverview)
      render(<OrgOverviewPage />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/org/overview')
      })
    })
  })
})
