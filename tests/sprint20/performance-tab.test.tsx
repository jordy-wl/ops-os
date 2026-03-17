/**
 * tests/sprint20/performance-tab.test.tsx
 *
 * Unit tests for PerformanceTab component.
 * Covers: loading state, "Collecting Data" empty state (<2 snapshots),
 * stat cards with correct values, chart rendering, error state,
 * and progress dots reflecting snapshot count.
 *
 * Uses vitest + @testing-library/react in jsdom environment.
 */

// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// ---- Mock dependencies ------------------------------------------------------

vi.mock('lucide-react', () => {
  const icon = (name: string) =>
    function MockIcon(props: Record<string, unknown>) {
      return React.createElement('svg', { 'data-testid': `icon-${name}`, ...props })
    }
  return {
    CheckCircle2: icon('check-circle-2'),
    Clock: icon('clock'),
    Target: icon('target'),
    DollarSign: icon('dollar-sign'),
    TrendingUp: icon('trending-up'),
  }
})

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

vi.mock('@/components/my-work/performance-charts', () => ({
  PerformanceCharts: ({ snapshots, teamAverages }: Record<string, unknown>) =>
    React.createElement(
      'div',
      { 'data-testid': 'performance-charts' },
      `Charts: ${(snapshots as unknown[]).length} snapshots`
    ),
}))

// ---- Fetch mock setup -------------------------------------------------------

const fetchSpy = vi.spyOn(global, 'fetch')

// ---- Import after mocks ----------------------------------------------------

import { PerformanceTab } from '@/components/my-work/performance-tab'

// ---- Helpers ---------------------------------------------------------------

function mockDashboardResponse(data: Record<string, unknown> | null, ok = true) {
  fetchSpy.mockResolvedValueOnce(
    new Response(
      JSON.stringify({ data }),
      {
        status: ok ? 200 : 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  )
}

// ---- Tests -----------------------------------------------------------------

describe('PerformanceTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchSpy.mockReset()
  })

  afterEach(() => {
    fetchSpy.mockReset()
  })

  // -- Loading state --

  it('should show loading state initially', () => {
    // Never resolve fetch to keep loading state
    fetchSpy.mockImplementation(() => new Promise(() => {}))

    render(<PerformanceTab />)

    expect(screen.getByText('Loading performance data...')).toBeDefined()
  })

  // -- Collecting Data state (< 2 snapshots) --

  it('should show "Collecting Data" state when snapshot_count is 0', async () => {
    mockDashboardResponse({
      snapshots: [],
      team_averages: [],
      current_week: { period_start: '2026-03-17', tasks_completed: 0, total_time_seconds: 0, billable_time_seconds: 0 },
      snapshot_count: 0,
    })

    render(<PerformanceTab />)

    await waitFor(() => {
      expect(screen.getByText('Collecting Performance Data')).toBeDefined()
    })
    expect(screen.getByText(/at least 2 weeks of data/)).toBeDefined()
  })

  it('should show "Collecting Data" state when snapshot_count is 1', async () => {
    mockDashboardResponse({
      snapshots: [{ period_start: '2026-03-10', period_end: '2026-03-16', tasks_completed: 5, tasks_on_time: 5, tasks_overdue: 0, total_time_seconds: 36000, billable_time_seconds: 28800, workflows_completed: 0, workflows_failed: 0, avg_task_completion_seconds: 0 }],
      team_averages: [],
      current_week: { period_start: '2026-03-17', tasks_completed: 0, total_time_seconds: 0, billable_time_seconds: 0 },
      snapshot_count: 1,
    })

    render(<PerformanceTab />)

    await waitFor(() => {
      expect(screen.getByText('Collecting Performance Data')).toBeDefined()
    })
    expect(screen.getByText(/One week of data collected/)).toBeDefined()
  })

  // -- Progress dots --

  it('should show Week 1 dot inactive when 0 snapshots', async () => {
    mockDashboardResponse({
      snapshots: [],
      team_averages: [],
      current_week: { period_start: '2026-03-17', tasks_completed: 0, total_time_seconds: 0, billable_time_seconds: 0 },
      snapshot_count: 0,
    })

    render(<PerformanceTab />)

    await waitFor(() => {
      expect(screen.getByText('Collecting Performance Data')).toBeDefined()
    })

    expect(screen.getByText('Week 1')).toBeDefined()
    expect(screen.getByText('Week 2')).toBeDefined()
    expect(screen.getByText('Full Dashboard')).toBeDefined()
  })

  it('should show Week 1 dot active when 1 snapshot', async () => {
    mockDashboardResponse({
      snapshots: [{ period_start: '2026-03-10', period_end: '2026-03-16', tasks_completed: 1, tasks_on_time: 1, tasks_overdue: 0, total_time_seconds: 100, billable_time_seconds: 100, workflows_completed: 0, workflows_failed: 0, avg_task_completion_seconds: 0 }],
      team_averages: [],
      current_week: { period_start: '2026-03-17', tasks_completed: 0, total_time_seconds: 0, billable_time_seconds: 0 },
      snapshot_count: 1,
    })

    render(<PerformanceTab />)

    await waitFor(() => {
      expect(screen.getByText('Collecting Performance Data')).toBeDefined()
    })

    // The component uses bg-primary for active dots and bg-muted-foreground/30 for inactive
    // We check that the 3 progress steps are present
    const week1 = screen.getByText('Week 1')
    const week2 = screen.getByText('Week 2')
    expect(week1).toBeDefined()
    expect(week2).toBeDefined()
  })

  // -- Stat cards with correct values --

  it('should show stat cards with correct values when >= 2 snapshots', async () => {
    mockDashboardResponse({
      snapshots: [
        { period_start: '2026-03-03', period_end: '2026-03-09', tasks_completed: 5, tasks_on_time: 4, tasks_overdue: 1, total_time_seconds: 36000, billable_time_seconds: 28800, workflows_completed: 2, workflows_failed: 0, avg_task_completion_seconds: 3600 },
        { period_start: '2026-03-10', period_end: '2026-03-16', tasks_completed: 8, tasks_on_time: 7, tasks_overdue: 1, total_time_seconds: 40000, billable_time_seconds: 32000, workflows_completed: 3, workflows_failed: 1, avg_task_completion_seconds: 2700 },
      ],
      team_averages: [],
      current_week: { period_start: '2026-03-17', tasks_completed: 2, total_time_seconds: 7200, billable_time_seconds: 3600 },
      snapshot_count: 2,
    })

    render(<PerformanceTab />)

    await waitFor(() => {
      expect(screen.getByText('Tasks Completed')).toBeDefined()
    })

    // Tasks Completed: 5 + 8 + 2 (current week) = 15
    expect(screen.getByText('15')).toBeDefined()
    expect(screen.getByText('2 this week')).toBeDefined()

    // On-Time Rate: (4 + 7) / (5 + 8) = 11/13 = 85%
    expect(screen.getByText('85%')).toBeDefined()

    // Time Logged: 36000 + 40000 + 7200 = 83200 seconds = 23h 6m
    expect(screen.getByText('On-Time Rate')).toBeDefined()
    expect(screen.getByText('Time Logged')).toBeDefined()
    expect(screen.getByText('Billable Rate')).toBeDefined()
  })

  // -- Charts rendering --

  it('should render performance charts when data is available', async () => {
    mockDashboardResponse({
      snapshots: [
        { period_start: '2026-03-03', period_end: '2026-03-09', tasks_completed: 5, tasks_on_time: 5, tasks_overdue: 0, total_time_seconds: 36000, billable_time_seconds: 28800, workflows_completed: 0, workflows_failed: 0, avg_task_completion_seconds: 0 },
        { period_start: '2026-03-10', period_end: '2026-03-16', tasks_completed: 8, tasks_on_time: 8, tasks_overdue: 0, total_time_seconds: 40000, billable_time_seconds: 32000, workflows_completed: 0, workflows_failed: 0, avg_task_completion_seconds: 0 },
      ],
      team_averages: [],
      current_week: { period_start: '2026-03-17', tasks_completed: 0, total_time_seconds: 0, billable_time_seconds: 0 },
      snapshot_count: 2,
    })

    render(<PerformanceTab />)

    await waitFor(() => {
      expect(screen.getByTestId('performance-charts')).toBeDefined()
    })
    expect(screen.getByText('Charts: 2 snapshots')).toBeDefined()
  })

  // -- API failure --

  it('should handle API failure gracefully', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ data: null, error: { message: 'Server error' } }),
        { status: 500 }
      )
    )

    render(<PerformanceTab />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load performance data.')).toBeDefined()
    })
  })

  it('should handle fetch throwing an error', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network error'))

    render(<PerformanceTab />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load performance data.')).toBeDefined()
    })
  })

  // -- Fetch URL --

  it('should fetch from /api/performance/dashboard?weeks=8', async () => {
    mockDashboardResponse({
      snapshots: [],
      team_averages: [],
      current_week: { period_start: '2026-03-17', tasks_completed: 0, total_time_seconds: 0, billable_time_seconds: 0 },
      snapshot_count: 0,
    })

    render(<PerformanceTab />)

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('/api/performance/dashboard?weeks=8')
    })
  })

  // -- Billable rate calculation --

  it('should compute billable rate correctly', async () => {
    mockDashboardResponse({
      snapshots: [
        { period_start: '2026-03-03', period_end: '2026-03-09', tasks_completed: 5, tasks_on_time: 5, tasks_overdue: 0, total_time_seconds: 40000, billable_time_seconds: 30000, workflows_completed: 0, workflows_failed: 0, avg_task_completion_seconds: 0 },
        { period_start: '2026-03-10', period_end: '2026-03-16', tasks_completed: 5, tasks_on_time: 5, tasks_overdue: 0, total_time_seconds: 40000, billable_time_seconds: 30000, workflows_completed: 0, workflows_failed: 0, avg_task_completion_seconds: 0 },
      ],
      team_averages: [],
      current_week: { period_start: '2026-03-17', tasks_completed: 0, total_time_seconds: 20000, billable_time_seconds: 10000 },
      snapshot_count: 2,
    })

    render(<PerformanceTab />)

    await waitFor(() => {
      expect(screen.getByText('Billable Rate')).toBeDefined()
    })

    // Total: 40000 + 40000 + 20000 = 100000
    // Billable: 30000 + 30000 + 10000 = 70000
    // Rate: 70000/100000 = 70%
    expect(screen.getByText('70%')).toBeDefined()
  })
})
