/**
 * tests/sprint20/my-work-performance-integration.test.tsx
 *
 * Integration tests verifying that MyWorkClient has 7 tabs including the
 * "Performance" tab, and that clicking it renders the PerformanceTab component.
 *
 * Uses vitest + @testing-library/react in jsdom environment.
 */

// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

// ---- Mock dependencies ------------------------------------------------------

vi.mock('lucide-react', () => {
  const icon = (name: string) =>
    function MockIcon(props: Record<string, unknown>) {
      return React.createElement('svg', { 'data-testid': `icon-${name}`, ...props })
    }
  return {
    ClipboardList: icon('clipboard-list'),
    GitBranch: icon('git-branch'),
    LayoutGrid: icon('layout-grid'),
    Activity: icon('activity'),
    ArrowRight: icon('arrow-right'),
    Circle: icon('circle'),
    Sparkles: icon('sparkles'),
    Clock: icon('clock'),
    Calendar: icon('calendar'),
    TrendingUp: icon('trending-up'),
    DollarSign: icon('dollar-sign'),
    Plus: icon('plus'),
    ChevronLeft: icon('chevron-left'),
    ChevronRight: icon('chevron-right'),
    RefreshCw: icon('refresh-cw'),
    CheckCircle2: icon('check-circle-2'),
    Target: icon('target'),
  }
})

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) =>
    React.createElement('a', { href, ...props }, children),
}))

// Mock sub-components to isolate the tab structure test
vi.mock('@/components/my-work/priority-badge', () => ({
  PriorityBadge: () => React.createElement('span', { 'data-testid': 'priority-badge' }),
}))

vi.mock('@/components/my-work/deadline-countdown', () => ({
  DeadlineCountdown: () => React.createElement('span', { 'data-testid': 'deadline-countdown' }),
}))

vi.mock('@/components/my-work/confidence-score', () => ({
  ConfidenceScore: () => React.createElement('span', { 'data-testid': 'confidence-score' }),
}))

vi.mock('@/components/my-work/time-tab', () => ({
  TimeTab: () => React.createElement('div', { 'data-testid': 'time-tab' }, 'Time Tab Content'),
}))

vi.mock('@/components/my-work/calendar-tab', () => ({
  CalendarTab: () => React.createElement('div', { 'data-testid': 'calendar-tab' }, 'Calendar Tab Content'),
}))

vi.mock('@/components/my-work/performance-tab', () => ({
  PerformanceTab: () => React.createElement('div', { 'data-testid': 'performance-tab' }, 'Performance Tab Content'),
}))

// ---- Import after mocks ----------------------------------------------------

import { MyWorkClient } from '@/components/my-work/my-work-client'

// ---- Helpers ---------------------------------------------------------------

const mockInitialData = {
  tasks: [],
  workflows: [],
  recentBlocks: [],
  recentEvents: [],
}

// ---- Tests -----------------------------------------------------------------

describe('MyWorkClient -- Performance Tab Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render exactly 7 tabs', () => {
    render(
      <MyWorkClient
        initialData={mockInitialData}
        currentUserId="user_abc"
      />
    )

    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(7)
  })

  it('should include a "Performance" tab', () => {
    render(
      <MyWorkClient
        initialData={mockInitialData}
        currentUserId="user_abc"
      />
    )

    expect(screen.getByText('Performance')).toBeDefined()
    // Verify it has the tab role
    const perfTab = screen.getByText('Performance').closest('[role="tab"]')
    expect(perfTab).not.toBeNull()
  })

  it('should have all 7 tab labels in order', () => {
    render(
      <MyWorkClient
        initialData={mockInitialData}
        currentUserId="user_abc"
      />
    )

    const tabs = screen.getAllByRole('tab')
    const labels = tabs.map((t) => t.textContent?.trim())

    expect(labels).toEqual([
      'Assigned to me',
      'Time',
      'Calendar',
      'Performance',
      'Active Workflows',
      'Recent Blocks',
      'Activity',
    ])
  })

  it('should render PerformanceTab when Performance tab is clicked', async () => {
    render(
      <MyWorkClient
        initialData={mockInitialData}
        currentUserId="user_abc"
      />
    )

    const perfTabButton = screen.getByText('Performance')
    await act(async () => {
      fireEvent.click(perfTabButton)
    })

    await waitFor(() => {
      expect(screen.getByTestId('performance-tab')).toBeDefined()
      expect(screen.getByText('Performance Tab Content')).toBeDefined()
    })
  })

  it('should not render PerformanceTab when a different tab is active', () => {
    render(
      <MyWorkClient
        initialData={mockInitialData}
        currentUserId="user_abc"
      />
    )

    // By default, "Assigned to me" tab is active
    expect(screen.queryByTestId('performance-tab')).toBeNull()
  })

  it('should render Performance tab with TrendingUp icon', () => {
    render(
      <MyWorkClient
        initialData={mockInitialData}
        currentUserId="user_abc"
      />
    )

    const perfTab = screen.getByText('Performance').closest('[role="tab"]')
    expect(perfTab).not.toBeNull()
    const icon = perfTab!.querySelector('[data-testid="icon-trending-up"]')
    expect(icon).not.toBeNull()
  })

  it('should highlight Performance tab when selected (aria-selected)', async () => {
    render(
      <MyWorkClient
        initialData={mockInitialData}
        currentUserId="user_abc"
      />
    )

    const perfTabButton = screen.getByText('Performance').closest('[role="tab"]') as HTMLElement
    expect(perfTabButton.getAttribute('aria-selected')).toBe('false')

    await act(async () => {
      fireEvent.click(perfTabButton)
    })

    expect(perfTabButton.getAttribute('aria-selected')).toBe('true')
  })

  it('should deselect Performance tab when another tab is clicked', async () => {
    render(
      <MyWorkClient
        initialData={mockInitialData}
        currentUserId="user_abc"
      />
    )

    // Click Performance
    const perfTabButton = screen.getByText('Performance').closest('[role="tab"]') as HTMLElement
    await act(async () => {
      fireEvent.click(perfTabButton)
    })
    expect(perfTabButton.getAttribute('aria-selected')).toBe('true')

    // Click Activity
    const activityTab = screen.getByText('Activity').closest('[role="tab"]') as HTMLElement
    await act(async () => {
      fireEvent.click(activityTab)
    })
    expect(perfTabButton.getAttribute('aria-selected')).toBe('false')
    expect(activityTab.getAttribute('aria-selected')).toBe('true')
  })
})
