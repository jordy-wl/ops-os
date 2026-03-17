/**
 * tests/sprint19/calendar-month-view.test.tsx
 *
 * Unit tests for CalendarMonthView component.
 * Covers: 7 day headers (Mon-Sun), today highlighting, event dot colors,
 * "+X more" overflow label, and onEventClick callback.
 *
 * Uses vitest + @testing-library/react in jsdom environment.
 */

// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// ---- Mock dependencies ------------------------------------------------------

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

vi.mock('./calendar-tab', () => ({}))

// ---- Import after mocks ----------------------------------------------------

import { CalendarMonthView } from '@/components/my-work/calendar-month-view'

// ---- Types ------------------------------------------------------------------

interface CalendarEvent {
  id: string
  title: string
  description: string
  start_at: string
  end_at: string
  all_day: boolean
  source: 'local' | 'google'
  external_link: string | null
  color: string
  block_id: string | null
}

// ---- Helpers ---------------------------------------------------------------

function createEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: overrides.id ?? `event-${Math.random().toString(36).slice(2)}`,
    title: overrides.title ?? 'Test Event',
    description: overrides.description ?? '',
    start_at: overrides.start_at ?? '2026-03-18T10:00:00Z',
    end_at: overrides.end_at ?? '2026-03-18T11:00:00Z',
    all_day: overrides.all_day ?? false,
    source: overrides.source ?? 'local',
    external_link: overrides.external_link ?? null,
    color: overrides.color ?? 'primary',
    block_id: overrides.block_id ?? null,
  }
}

// March 2026 - first day is Sunday March 1
// In Mon-based calendar, March 1 (Sun) would be in the last column
const MARCH_2026 = new Date(2026, 2, 15) // mid-March for stable month view

// ---- Tests -----------------------------------------------------------------

describe('CalendarMonthView', () => {
  const mockOnEventClick = vi.fn<(event: CalendarEvent) => void>()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render 7 day headers (Mon through Sun)', () => {
    render(
      <CalendarMonthView
        events={[]}
        currentDate={MARCH_2026}
        onEventClick={mockOnEventClick}
      />
    )

    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    for (const label of labels) {
      expect(screen.getByText(label)).toBeDefined()
    }
  })

  it('should render day numbers for the month', () => {
    render(
      <CalendarMonthView
        events={[]}
        currentDate={MARCH_2026}
        onEventClick={mockOnEventClick}
      />
    )

    // March has 31 days
    expect(screen.getByText('1')).toBeDefined()
    expect(screen.getByText('15')).toBeDefined()
    expect(screen.getByText('31')).toBeDefined()
  })

  it('should highlight today date when month contains today', () => {
    const today = new Date()

    render(
      <CalendarMonthView
        events={[]}
        currentDate={today}
        onEventClick={mockOnEventClick}
      />
    )

    // Today should be rendered with the primary background circle
    const todayNum = today.getDate().toString()
    const allMatchingElements = screen.getAllByText(todayNum)
    // At least one should have primary styling
    const hasPrimaryStyle = allMatchingElements.some(
      (el) => el.className.includes('bg-primary')
    )
    expect(hasPrimaryStyle).toBe(true)
  })

  it('should show event dots with correct colors', () => {
    const greenEvent = createEvent({
      id: 'evt-green',
      title: 'Green Event',
      start_at: '2026-03-15T10:00:00',
      end_at: '2026-03-15T11:00:00',
      color: 'green',
    })

    render(
      <CalendarMonthView
        events={[greenEvent]}
        currentDate={MARCH_2026}
        onEventClick={mockOnEventClick}
      />
    )

    const eventButton = screen.getByText('Green Event')
    expect(eventButton).toBeDefined()

    // The dot should have bg-green-500 class
    const button = eventButton.closest('button')
    expect(button).not.toBeNull()
    const dot = button!.querySelector('span')
    expect(dot).not.toBeNull()
    expect(dot!.className).toContain('bg-green-500')
  })

  it('should show "+X more" when more than 3 events on a day', () => {
    const events = [
      createEvent({ id: 'e1', title: 'Event 1', start_at: '2026-03-15T09:00:00', end_at: '2026-03-15T10:00:00' }),
      createEvent({ id: 'e2', title: 'Event 2', start_at: '2026-03-15T10:00:00', end_at: '2026-03-15T11:00:00' }),
      createEvent({ id: 'e3', title: 'Event 3', start_at: '2026-03-15T11:00:00', end_at: '2026-03-15T12:00:00' }),
      createEvent({ id: 'e4', title: 'Event 4', start_at: '2026-03-15T13:00:00', end_at: '2026-03-15T14:00:00' }),
      createEvent({ id: 'e5', title: 'Event 5', start_at: '2026-03-15T14:00:00', end_at: '2026-03-15T15:00:00' }),
    ]

    render(
      <CalendarMonthView
        events={events}
        currentDate={MARCH_2026}
        onEventClick={mockOnEventClick}
      />
    )

    // Only first 3 events should be visible as titles
    expect(screen.getByText('Event 1')).toBeDefined()
    expect(screen.getByText('Event 2')).toBeDefined()
    expect(screen.getByText('Event 3')).toBeDefined()

    // Events 4 and 5 should be hidden, replaced by "+2 more"
    expect(screen.queryByText('Event 4')).toBeNull()
    expect(screen.queryByText('Event 5')).toBeNull()
    expect(screen.getByText('+2 more')).toBeDefined()
  })

  it('should not show "+X more" when 3 or fewer events on a day', () => {
    const events = [
      createEvent({ id: 'e1', title: 'Only Event', start_at: '2026-03-15T09:00:00', end_at: '2026-03-15T10:00:00' }),
    ]

    render(
      <CalendarMonthView
        events={events}
        currentDate={MARCH_2026}
        onEventClick={mockOnEventClick}
      />
    )

    expect(screen.getByText('Only Event')).toBeDefined()
    expect(screen.queryByText(/more/)).toBeNull()
  })

  it('should fire onEventClick when an event is clicked', () => {
    const event = createEvent({
      id: 'evt-click',
      title: 'Clickable Month Event',
      start_at: '2026-03-15T10:00:00',
      end_at: '2026-03-15T11:00:00',
    })

    render(
      <CalendarMonthView
        events={[event]}
        currentDate={MARCH_2026}
        onEventClick={mockOnEventClick}
      />
    )

    fireEvent.click(screen.getByText('Clickable Month Event'))
    expect(mockOnEventClick).toHaveBeenCalledTimes(1)
    expect(mockOnEventClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'evt-click', title: 'Clickable Month Event' })
    )
  })

  it('should render multiple color dots for different event colors', () => {
    const events = [
      createEvent({
        id: 'e-blue',
        title: 'Blue Meeting',
        start_at: '2026-03-20T09:00:00',
        end_at: '2026-03-20T10:00:00',
        color: 'blue',
      }),
      createEvent({
        id: 'e-red',
        title: 'Red Deadline',
        start_at: '2026-03-20T11:00:00',
        end_at: '2026-03-20T12:00:00',
        color: 'red',
      }),
    ]

    render(
      <CalendarMonthView
        events={events}
        currentDate={MARCH_2026}
        onEventClick={mockOnEventClick}
      />
    )

    expect(screen.getByText('Blue Meeting')).toBeDefined()
    expect(screen.getByText('Red Deadline')).toBeDefined()

    // Check dot colors
    const blueButton = screen.getByText('Blue Meeting').closest('button')
    const blueDot = blueButton!.querySelector('span')
    expect(blueDot!.className).toContain('bg-blue-500')

    const redButton = screen.getByText('Red Deadline').closest('button')
    const redDot = redButton!.querySelector('span')
    expect(redDot!.className).toContain('bg-red-500')
  })

  it('should use primary color for events with unrecognized color value', () => {
    const event = createEvent({
      id: 'e-unknown-color',
      title: 'Unknown Color Event',
      start_at: '2026-03-15T09:00:00',
      end_at: '2026-03-15T10:00:00',
      color: 'magenta',
    })

    render(
      <CalendarMonthView
        events={[event]}
        currentDate={MARCH_2026}
        onEventClick={mockOnEventClick}
      />
    )

    const button = screen.getByText('Unknown Color Event').closest('button')
    const dot = button!.querySelector('span')
    expect(dot!.className).toContain('bg-primary')
  })

  it('should display all-day events on the correct day', () => {
    const allDayEvent = createEvent({
      id: 'evt-allday-month',
      title: 'Office Closed',
      start_at: '2026-03-20T00:00:00',
      end_at: '2026-03-20T23:59:59',
      all_day: true,
      color: 'orange',
    })

    render(
      <CalendarMonthView
        events={[allDayEvent]}
        currentDate={MARCH_2026}
        onEventClick={mockOnEventClick}
      />
    )

    // All-day events may span multiple day cells; use getAllByText
    const elements = screen.getAllByText('Office Closed')
    expect(elements.length).toBeGreaterThanOrEqual(1)
  })
})
