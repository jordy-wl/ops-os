/**
 * tests/sprint20/performance-charts.test.tsx
 *
 * Unit tests for PerformanceCharts component.
 * Covers: task completion bar chart, time logged area chart,
 * on-time rate area chart, and empty data handling.
 *
 * Recharts components are mocked since they require a real DOM
 * measurement layer (SVG rendering) that jsdom does not support.
 *
 * Uses vitest + @testing-library/react in jsdom environment.
 */

// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// ---- Mock recharts ----------------------------------------------------------

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'responsive-container' }, children),
  AreaChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) =>
    React.createElement('div', { 'data-testid': 'area-chart', 'data-count': data?.length ?? 0 }, children),
  BarChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) =>
    React.createElement('div', { 'data-testid': 'bar-chart', 'data-count': data?.length ?? 0 }, children),
  Area: ({ dataKey }: { dataKey: string }) =>
    React.createElement('div', { 'data-testid': `area-${dataKey}` }),
  Bar: ({ dataKey }: { dataKey: string }) =>
    React.createElement('div', { 'data-testid': `bar-${dataKey}` }),
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}))

// ---- Import after mocks ----------------------------------------------------

import { PerformanceCharts } from '@/components/my-work/performance-charts'

// ---- Fixtures ---------------------------------------------------------------

const twoWeekSnapshots = [
  {
    period_start: '2026-03-03',
    period_end: '2026-03-09',
    tasks_completed: 5,
    tasks_on_time: 4,
    tasks_overdue: 1,
    total_time_seconds: 36000,
    billable_time_seconds: 28800,
    workflows_completed: 2,
    workflows_failed: 0,
    avg_task_completion_seconds: 3600,
  },
  {
    period_start: '2026-03-10',
    period_end: '2026-03-16',
    tasks_completed: 8,
    tasks_on_time: 7,
    tasks_overdue: 1,
    total_time_seconds: 40000,
    billable_time_seconds: 32000,
    workflows_completed: 3,
    workflows_failed: 1,
    avg_task_completion_seconds: 2700,
  },
]

const teamAverages = [
  { period_start: '2026-03-03', avg_tasks_completed: 6, avg_total_time_seconds: 38000, avg_tasks_on_time: 5, avg_billable_time_seconds: 30000, team_size: 4 },
  { period_start: '2026-03-10', avg_tasks_completed: 9, avg_total_time_seconds: 42000, avg_tasks_on_time: 8, avg_billable_time_seconds: 34000, team_size: 4 },
]

// ---- Tests -----------------------------------------------------------------

describe('PerformanceCharts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -- Section headings --

  it('should render all three chart sections', () => {
    render(<PerformanceCharts snapshots={twoWeekSnapshots} teamAverages={teamAverages} />)

    expect(screen.getByText('Task Completion')).toBeDefined()
    expect(screen.getByText('Time Logged')).toBeDefined()
    expect(screen.getByText('On-Time Rate')).toBeDefined()
  })

  // -- Task completion bar chart --

  it('should render task completion bar chart with correct data keys', () => {
    render(<PerformanceCharts snapshots={twoWeekSnapshots} teamAverages={teamAverages} />)

    const barChart = screen.getByTestId('bar-chart')
    expect(barChart).toBeDefined()
    expect(barChart.getAttribute('data-count')).toBe('2')

    // Should have "completed" and "overdue" bars
    expect(screen.getByTestId('bar-completed')).toBeDefined()
    expect(screen.getByTestId('bar-overdue')).toBeDefined()
  })

  // -- Time logged area chart --

  it('should render time logged area chart', () => {
    render(<PerformanceCharts snapshots={twoWeekSnapshots} teamAverages={teamAverages} />)

    const areaCharts = screen.getAllByTestId('area-chart')
    // There are 2 area charts: time logged + on-time rate
    expect(areaCharts.length).toBe(2)

    // Time chart should have hours, billable_hours, and team_avg_hours areas
    expect(screen.getByTestId('area-hours')).toBeDefined()
    expect(screen.getByTestId('area-billable_hours')).toBeDefined()
    expect(screen.getByTestId('area-team_avg_hours')).toBeDefined()
  })

  // -- On-time rate area chart --

  it('should render on-time rate area chart', () => {
    render(<PerformanceCharts snapshots={twoWeekSnapshots} teamAverages={teamAverages} />)

    // On-time chart should have rate and team_rate areas
    expect(screen.getByTestId('area-rate')).toBeDefined()
    expect(screen.getByTestId('area-team_rate')).toBeDefined()
  })

  // -- 3 responsive containers (one per chart) --

  it('should wrap each chart in a ResponsiveContainer', () => {
    render(<PerformanceCharts snapshots={twoWeekSnapshots} teamAverages={teamAverages} />)

    const containers = screen.getAllByTestId('responsive-container')
    expect(containers).toHaveLength(3)
  })

  // -- Empty data --

  it('should handle empty snapshots gracefully', () => {
    render(<PerformanceCharts snapshots={[]} teamAverages={[]} />)

    // Should still render the sections
    expect(screen.getByText('Task Completion')).toBeDefined()
    expect(screen.getByText('Time Logged')).toBeDefined()
    expect(screen.getByText('On-Time Rate')).toBeDefined()

    // Bar chart should have 0 data points
    const barChart = screen.getByTestId('bar-chart')
    expect(barChart.getAttribute('data-count')).toBe('0')
  })

  it('should handle snapshots with no team averages', () => {
    render(<PerformanceCharts snapshots={twoWeekSnapshots} teamAverages={[]} />)

    // Should still render correctly -- team_avg defaults to 0
    expect(screen.getByTestId('bar-chart')).toBeDefined()
    expect(screen.getByText('Task Completion')).toBeDefined()
  })

  // -- Single week --

  it('should render with a single snapshot', () => {
    render(<PerformanceCharts snapshots={[twoWeekSnapshots[0]]} teamAverages={[teamAverages[0]]} />)

    const barChart = screen.getByTestId('bar-chart')
    expect(barChart.getAttribute('data-count')).toBe('1')
  })
})
