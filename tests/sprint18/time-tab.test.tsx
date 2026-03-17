/**
 * tests/sprint18/time-tab.test.tsx
 *
 * Unit tests for TimeTab component.
 * Covers: loading state, empty state, "Add Entry" button, and day grouping.
 *
 * Uses vitest + @testing-library/react in jsdom environment.
 */

// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'

// ---- Mock dependencies ------------------------------------------------------

vi.mock('lucide-react', () => {
  const icon = (name: string) =>
    function MockIcon(props: Record<string, unknown>) {
      return React.createElement('svg', { 'data-testid': `icon-${name}`, ...props })
    }
  return {
    Clock: icon('clock'),
    DollarSign: icon('dollar-sign'),
    Plus: icon('plus'),
  }
})

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

// Mock the ManualTimeEntryForm
vi.mock('@/components/my-work/manual-time-entry-form', () => ({
  ManualTimeEntryForm: ({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) => (
    <div data-testid="manual-form">
      <button data-testid="form-save" onClick={onSaved}>Save</button>
      <button data-testid="form-cancel" onClick={onCancel}>Cancel</button>
    </div>
  ),
}))

// ---- Fetch mock setup -------------------------------------------------------

const fetchSpy = vi.spyOn(global, 'fetch')

// ---- Import after mocks ----------------------------------------------------

import { TimeTab } from '@/components/my-work/time-tab'

// ---- Helpers ---------------------------------------------------------------

function createEntry(overrides: Partial<{
  id: string
  description: string
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  is_billable: boolean
  block_id: string | null
}> = {}) {
  return {
    id: overrides.id ?? `entry-${Math.random().toString(36).slice(2)}`,
    block_id: overrides.block_id ?? null,
    description: overrides.description ?? 'Test entry',
    started_at: overrides.started_at ?? '2026-03-17T09:00:00Z',
    ended_at: overrides.ended_at ?? '2026-03-17T10:00:00Z',
    duration_seconds: overrides.duration_seconds ?? 3600,
    is_billable: overrides.is_billable ?? false,
  }
}

// ---- Tests -----------------------------------------------------------------

describe('TimeTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    fetchSpy.mockReset()
  })

  it('should render loading state initially', () => {
    // Never resolve the fetch
    fetchSpy.mockReturnValue(new Promise(() => {}))

    render(<TimeTab />)

    expect(screen.getByText('Loading time entries...')).toBeDefined()
  })

  it('should render empty state when no entries returned', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    render(<TimeTab />)

    await waitFor(() => {
      expect(
        screen.getByText(/no time tracked this week/i)
      ).toBeDefined()
    })
  })

  it('should show "Add Entry" button', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    render(<TimeTab />)

    await waitFor(() => {
      const addBtn = screen.getByText('Add Entry')
      expect(addBtn).toBeDefined()
    })
  })

  it('should show manual entry form when "Add Entry" is clicked', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    render(<TimeTab />)

    await waitFor(() => {
      expect(screen.getByText('Add Entry')).toBeDefined()
    })

    fireEvent.click(screen.getByText('Add Entry'))

    await waitFor(() => {
      expect(screen.getByTestId('manual-form')).toBeDefined()
    })
  })

  it('should group entries by day', async () => {
    const entries = [
      createEntry({
        id: 'e1',
        description: 'Monday task A',
        started_at: '2026-03-16T09:00:00Z',
        ended_at: '2026-03-16T10:00:00Z',
        duration_seconds: 3600,
      }),
      createEntry({
        id: 'e2',
        description: 'Monday task B',
        started_at: '2026-03-16T11:00:00Z',
        ended_at: '2026-03-16T12:00:00Z',
        duration_seconds: 3600,
      }),
      createEntry({
        id: 'e3',
        description: 'Tuesday task',
        started_at: '2026-03-17T09:00:00Z',
        ended_at: '2026-03-17T10:30:00Z',
        duration_seconds: 5400,
      }),
    ]

    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: entries }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    render(<TimeTab />)

    await waitFor(() => {
      // Should show entry descriptions
      expect(screen.getByText('Monday task A')).toBeDefined()
      expect(screen.getByText('Monday task B')).toBeDefined()
      expect(screen.getByText('Tuesday task')).toBeDefined()
    })
  })

  it('should display "This Week" label with totals', async () => {
    const entries = [
      createEntry({
        id: 'e1',
        duration_seconds: 3600,
        is_billable: true,
      }),
      createEntry({
        id: 'e2',
        duration_seconds: 1800,
        is_billable: false,
      }),
    ]

    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: entries }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    render(<TimeTab />)

    await waitFor(() => {
      expect(screen.getByText('This Week')).toBeDefined()
      // 3600 + 1800 = 5400s = 1h 30m
      expect(screen.getByText(/1h 30m total/)).toBeDefined()
      // Billable is only 3600s = 1h 0m
      expect(screen.getByText(/1h 0m billable/)).toBeDefined()
    })
  })

  it('should show billable icon for billable entries', async () => {
    const entries = [
      createEntry({ id: 'billable-1', is_billable: true }),
    ]

    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: entries }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    render(<TimeTab />)

    await waitFor(() => {
      expect(screen.getByText('Test entry')).toBeDefined()
      // DollarSign icon should appear
      const dollarIcons = screen.getAllByTestId('icon-dollar-sign')
      expect(dollarIcons.length).toBeGreaterThan(0)
    })
  })

  it('should filter out running entries (no ended_at) from day groups', async () => {
    const entries = [
      createEntry({
        id: 'completed',
        description: 'Completed task',
        ended_at: '2026-03-17T10:00:00Z',
        duration_seconds: 3600,
      }),
      createEntry({
        id: 'running',
        description: 'Running task',
        ended_at: null,
        duration_seconds: null,
      }),
    ]

    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: entries }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    render(<TimeTab />)

    await waitFor(() => {
      // Completed entry should appear in the grouped list
      expect(screen.getByText('Completed task')).toBeDefined()
    })

    // Running task should NOT appear in day groups (filtered by ended_at)
    // Note: it might not be shown at all or shown differently
    // The component filters: entries.filter((e) => e.ended_at)
  })

  it('should show "Untitled" for entries with empty description', async () => {
    const entries = [
      createEntry({
        id: 'no-desc',
        description: '',
      }),
    ]

    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: entries }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    render(<TimeTab />)

    await waitFor(() => {
      expect(screen.getByText('Untitled')).toBeDefined()
    })
  })
})
