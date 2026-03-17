/**
 * tests/sprint19/my-work-calendar-integration.test.tsx
 *
 * Integration test verifying that MyWorkClient has 7 tabs including "Calendar".
 * Confirms the CalendarTab is rendered when the Calendar tab is activated.
 *
 * Uses vitest + @testing-library/react in jsdom environment.
 */

// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
    ChevronLeft: icon('chevron-left'),
    ChevronRight: icon('chevron-right'),
    Plus: icon('plus'),
    RefreshCw: icon('refresh-cw'),
    DollarSign: icon('dollar-sign'),
    TrendingUp: icon('trending-up'),
  }
})

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) =>
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

describe('MyWorkClient — Calendar Tab Integration', () => {
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

  it('should include a "Calendar" tab', () => {
    render(
      <MyWorkClient
        initialData={mockInitialData}
        currentUserId="user_abc"
      />
    )

    expect(screen.getByText('Calendar')).toBeDefined()
    // Verify it has the tab role
    const calendarTab = screen.getByText('Calendar').closest('[role="tab"]')
    expect(calendarTab).not.toBeNull()
  })

  it('should have all 6 tab labels: Assigned to me, Time, Calendar, Active Workflows, Recent Blocks, Activity', () => {
    render(
      <MyWorkClient
        initialData={mockInitialData}
        currentUserId="user_abc"
      />
    )

    const expectedLabels = [
      'Assigned to me',
      'Time',
      'Calendar',
      'Active Workflows',
      'Recent Blocks',
      'Activity',
    ]

    for (const label of expectedLabels) {
      expect(screen.getByText(label)).toBeDefined()
    }
  })

  it('should render CalendarTab content when Calendar tab is clicked', async () => {
    render(
      <MyWorkClient
        initialData={mockInitialData}
        currentUserId="user_abc"
      />
    )

    const calendarTabButton = screen.getByText('Calendar')
    await act(async () => {
      fireEvent.click(calendarTabButton)
    })

    await waitFor(() => {
      expect(screen.getByTestId('calendar-tab')).toBeDefined()
      expect(screen.getByText('Calendar Tab Content')).toBeDefined()
    })
  })

  it('should not render CalendarTab when a different tab is active', () => {
    render(
      <MyWorkClient
        initialData={mockInitialData}
        currentUserId="user_abc"
      />
    )

    // By default, "Assigned to me" tab is active
    expect(screen.queryByTestId('calendar-tab')).toBeNull()
  })

  it('should render Calendar tab with Calendar icon', () => {
    render(
      <MyWorkClient
        initialData={mockInitialData}
        currentUserId="user_abc"
      />
    )

    // The Calendar tab should contain the calendar icon
    const calendarTab = screen.getByText('Calendar').closest('[role="tab"]')
    expect(calendarTab).not.toBeNull()
    const icon = calendarTab!.querySelector('[data-testid="icon-calendar"]')
    expect(icon).not.toBeNull()
  })

  it('should show "My Work" heading', () => {
    render(
      <MyWorkClient
        initialData={mockInitialData}
        currentUserId="user_abc"
      />
    )

    expect(screen.getByText('My Work')).toBeDefined()
  })

  it('should highlight Calendar tab when selected (aria-selected)', async () => {
    render(
      <MyWorkClient
        initialData={mockInitialData}
        currentUserId="user_abc"
      />
    )

    const calendarTabButton = screen.getByText('Calendar').closest('[role="tab"]') as HTMLElement
    expect(calendarTabButton.getAttribute('aria-selected')).toBe('false')

    await act(async () => {
      fireEvent.click(calendarTabButton)
    })

    expect(calendarTabButton.getAttribute('aria-selected')).toBe('true')
  })
})
