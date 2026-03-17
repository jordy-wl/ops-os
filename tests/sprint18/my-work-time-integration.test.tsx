/**
 * tests/sprint18/my-work-time-integration.test.tsx
 *
 * Integration tests verifying that MyWorkClient has 7 tabs including the
 * "Time" tab, and that clicking it renders the TimeTab component.
 * Updated from 6 to 7 tabs after Performance tab was added in Sprint 20.
 *
 * Uses vitest + @testing-library/react in jsdom environment.
 */

// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

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
  }
})

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) =>
    React.createElement('a', { href, ...props }, children),
}))

// Mock the sub-components used in my-work-client
vi.mock('@/components/my-work/priority-badge', () => ({
  PriorityBadge: ({ priority }: { priority: string }) =>
    React.createElement('span', { 'data-testid': 'priority-badge' }, priority),
}))

vi.mock('@/components/my-work/deadline-countdown', () => ({
  DeadlineCountdown: ({ deadline }: { deadline: string | null }) =>
    deadline ? React.createElement('span', { 'data-testid': 'deadline' }, deadline) : null,
}))

vi.mock('@/components/my-work/confidence-score', () => ({
  ConfidenceScore: ({ score }: { score: number }) =>
    React.createElement('span', { 'data-testid': 'confidence' }, `${score}`),
}))

// Mock the TimeTab and CalendarTab components
vi.mock('@/components/my-work/time-tab', () => ({
  TimeTab: () => React.createElement('div', { 'data-testid': 'time-tab-content' }, 'Time tab loaded'),
}))

vi.mock('@/components/my-work/calendar-tab', () => ({
  CalendarTab: () => React.createElement('div', { 'data-testid': 'calendar-tab-content' }, 'Calendar tab loaded'),
}))

// ---- Import after mocks ----------------------------------------------------

import { MyWorkClient } from '@/components/my-work/my-work-client'

// ---- Test data --------------------------------------------------------------

const initialData = {
  tasks: [
    {
      id: 'task-1',
      name: 'Review contract',
      status: 'open' as const,
      assigned_to: 'user_123',
      step_name: null,
      workflow_instance_name: null,
      created_at: '2026-03-17T08:00:00Z',
    },
  ],
  workflows: [],
  recentBlocks: [],
  recentEvents: [],
}

// ---- Tests -----------------------------------------------------------------

describe('MyWorkClient — Tab integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should have exactly 7 tabs', () => {
    render(
      <MyWorkClient
        initialData={initialData}
        currentUserId="user_123"
      />
    )

    const tabs = screen.getAllByRole('tab')
    expect(tabs.length).toBe(7)
  })

  it('should include "Time" tab', () => {
    render(
      <MyWorkClient
        initialData={initialData}
        currentUserId="user_123"
      />
    )

    const timeTab = screen.getByRole('tab', { name: /time/i })
    expect(timeTab).toBeDefined()
  })

  it('should have correct tab labels in order', () => {
    render(
      <MyWorkClient
        initialData={initialData}
        currentUserId="user_123"
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

  it('should render TimeTab content when Time tab is clicked', async () => {
    render(
      <MyWorkClient
        initialData={initialData}
        currentUserId="user_123"
      />
    )

    // Click the Time tab
    const timeTab = screen.getByRole('tab', { name: /time/i })
    fireEvent.click(timeTab)

    await waitFor(() => {
      expect(screen.getByTestId('time-tab-content')).toBeDefined()
    })
    expect(screen.getByText('Time tab loaded')).toBeDefined()
  })

  it('should default to "Assigned to me" tab', () => {
    render(
      <MyWorkClient
        initialData={initialData}
        currentUserId="user_123"
      />
    )

    const tasksTab = screen.getByRole('tab', { name: /assigned to me/i })
    expect(tasksTab.getAttribute('aria-selected')).toBe('true')

    const timeTab = screen.getByRole('tab', { name: /time/i })
    expect(timeTab.getAttribute('aria-selected')).toBe('false')
  })

  it('should mark Time tab as selected when clicked', () => {
    render(
      <MyWorkClient
        initialData={initialData}
        currentUserId="user_123"
      />
    )

    const timeTab = screen.getByRole('tab', { name: /time/i })
    fireEvent.click(timeTab)

    expect(timeTab.getAttribute('aria-selected')).toBe('true')

    // Other tabs should NOT be selected
    const tasksTab = screen.getByRole('tab', { name: /assigned to me/i })
    expect(tasksTab.getAttribute('aria-selected')).toBe('false')
  })

  it('should render tab panel with correct role', () => {
    render(
      <MyWorkClient
        initialData={initialData}
        currentUserId="user_123"
      />
    )

    const panel = screen.getByRole('tabpanel')
    expect(panel).toBeDefined()
  })

  it('should show error state when initialData is null', () => {
    render(
      <MyWorkClient
        initialData={null}
        currentUserId="user_123"
      />
    )

    expect(screen.getByText('Failed to load data.')).toBeDefined()
    expect(screen.getByRole('alert')).toBeDefined()
  })
})
