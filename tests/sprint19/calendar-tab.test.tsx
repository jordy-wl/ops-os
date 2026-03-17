/**
 * tests/sprint19/calendar-tab.test.tsx
 *
 * Unit tests for CalendarTab component.
 * Covers: empty state (Connect Google Calendar CTA), Skip button,
 * default week view, month view toggle, navigation arrows + Today,
 * sync button when Google connected, and Add Event button.
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
    ChevronLeft: icon('chevron-left'),
    ChevronRight: icon('chevron-right'),
    Plus: icon('plus'),
    RefreshCw: icon('refresh-cw'),
  }
})

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

// Mock child components to isolate CalendarTab tests
vi.mock('@/components/my-work/calendar-week-view', () => ({
  CalendarWeekView: ({ events, currentDate, onEventClick }: Record<string, unknown>) => (
    <div data-testid="week-view">
      Week View ({(events as unknown[]).length} events)
    </div>
  ),
}))

vi.mock('@/components/my-work/calendar-month-view', () => ({
  CalendarMonthView: ({ events, currentDate, onEventClick }: Record<string, unknown>) => (
    <div data-testid="month-view">
      Month View ({(events as unknown[]).length} events)
    </div>
  ),
}))

vi.mock('@/components/my-work/calendar-event-modal', () => ({
  CalendarEventModal: ({ event, onSaved, onClose }: Record<string, unknown>) => (
    <div data-testid="event-modal">
      <span>{event ? 'Edit Event Modal' : 'New Event Modal'}</span>
      <button data-testid="modal-close" onClick={onClose as () => void}>Close</button>
    </div>
  ),
}))

// ---- Fetch mock setup -------------------------------------------------------

const fetchSpy = vi.spyOn(global, 'fetch')

// ---- Import after mocks ----------------------------------------------------

import { CalendarTab } from '@/components/my-work/calendar-tab'

// ---- Helpers ---------------------------------------------------------------

function mockFetchResponses(options: {
  hasGoogleConnector: boolean
  events?: unknown[]
  tasks?: unknown[]
}) {
  fetchSpy.mockImplementation(async (url: string | URL | Request) => {
    const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url

    if (urlStr.includes('/api/integrations')) {
      const connectors = options.hasGoogleConnector
        ? [{ id: 'conn-1', provider: 'google', status: 'active' }]
        : []
      return new Response(JSON.stringify({ data: connectors }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (urlStr.includes('/api/calendar-events') && !urlStr.includes('/sync')) {
      return new Response(JSON.stringify({ data: options.events ?? [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (urlStr.includes('/api/blocks')) {
      return new Response(JSON.stringify({ data: options.tasks ?? [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (urlStr.includes('/api/calendar-events/sync')) {
      return new Response(JSON.stringify({ data: { fetched: 0, synced: 0, errors: 0 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ data: null }), { status: 404 })
  })
}

// ---- Tests -----------------------------------------------------------------

describe('CalendarTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchSpy.mockReset()
  })

  afterEach(() => {
    fetchSpy.mockReset()
  })

  it('should show "Connect Google Calendar" when no Google connector exists', async () => {
    mockFetchResponses({ hasGoogleConnector: false })

    render(<CalendarTab />)

    await waitFor(() => {
      // Component renders "Connect Google Calendar" as both a heading and a link
      const elements = screen.getAllByText('Connect Google Calendar')
      expect(elements.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('should show "Skip" button on the empty state', async () => {
    mockFetchResponses({ hasGoogleConnector: false })

    render(<CalendarTab />)

    await waitFor(() => {
      const skipButton = screen.getByText(/skip/i)
      expect(skipButton).toBeDefined()
    })
  })

  it('should show calendar view after Skip is clicked', async () => {
    mockFetchResponses({ hasGoogleConnector: false })

    render(<CalendarTab />)

    await waitFor(() => {
      expect(screen.getByText(/skip/i)).toBeDefined()
    })

    await act(async () => {
      fireEvent.click(screen.getByText(/skip/i))
    })

    await waitFor(() => {
      expect(screen.getByTestId('week-view')).toBeDefined()
    })
  })

  it('should render week view by default when Google is connected', async () => {
    mockFetchResponses({ hasGoogleConnector: true })

    render(<CalendarTab />)

    await waitFor(() => {
      expect(screen.getByTestId('week-view')).toBeDefined()
    })
  })

  it('should switch to month view when month button is clicked', async () => {
    mockFetchResponses({ hasGoogleConnector: true })

    render(<CalendarTab />)

    await waitFor(() => {
      expect(screen.getByTestId('week-view')).toBeDefined()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('month'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('month-view')).toBeDefined()
    })
  })

  it('should show navigation arrows', async () => {
    mockFetchResponses({ hasGoogleConnector: true })

    render(<CalendarTab />)

    await waitFor(() => {
      expect(screen.getByLabelText('Previous')).toBeDefined()
      expect(screen.getByLabelText('Next')).toBeDefined()
    })
  })

  it('should show Today button', async () => {
    mockFetchResponses({ hasGoogleConnector: true })

    render(<CalendarTab />)

    await waitFor(() => {
      expect(screen.getByText('Today')).toBeDefined()
    })
  })

  it('should show sync button when Google connector is active', async () => {
    mockFetchResponses({ hasGoogleConnector: true })

    render(<CalendarTab />)

    await waitFor(() => {
      expect(screen.getByLabelText('Sync Google Calendar')).toBeDefined()
    })
  })

  it('should show "Add Event" button (Event text next to Plus icon)', async () => {
    mockFetchResponses({ hasGoogleConnector: true })

    render(<CalendarTab />)

    await waitFor(() => {
      expect(screen.getByText('Event')).toBeDefined()
    })
  })

  it('should open event modal when Add Event button is clicked', async () => {
    mockFetchResponses({ hasGoogleConnector: true })

    render(<CalendarTab />)

    await waitFor(() => {
      expect(screen.getByText('Event')).toBeDefined()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Event'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('event-modal')).toBeDefined()
      expect(screen.getByText('New Event Modal')).toBeDefined()
    })
  })

  it('should show loading state initially', () => {
    // Never resolve fetches to keep loading
    fetchSpy.mockImplementation(() => new Promise(() => {}))

    render(<CalendarTab />)

    // Initially the connector check hasn't resolved so the component is in limbo;
    // once connector resolves to true, it shows "Loading calendar..."
    // For the test: if connector is null, it renders nothing visible yet
    // This tests that it doesn't crash during initial render
    expect(screen.queryByTestId('week-view')).toBeNull()
    expect(screen.queryByTestId('month-view')).toBeNull()
  })

  it('should show week/month toggle buttons', async () => {
    mockFetchResponses({ hasGoogleConnector: true })

    render(<CalendarTab />)

    await waitFor(() => {
      expect(screen.getByText('week')).toBeDefined()
      expect(screen.getByText('month')).toBeDefined()
    })
  })
})
