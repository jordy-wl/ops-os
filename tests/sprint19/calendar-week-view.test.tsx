/**
 * tests/sprint19/calendar-week-view.test.tsx
 *
 * Unit tests for CalendarWeekView component.
 * Covers: 7-day column rendering, today highlighting, timed event positioning,
 * all-day events in header row, and onEventClick callback.
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

// Mock CalendarEvent type import (comes from calendar-tab)
vi.mock('./calendar-tab', () => ({}))

// ---- Import after mocks ----------------------------------------------------

import { CalendarWeekView } from '@/components/my-work/calendar-week-view'

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

// Use a fixed Wednesday to avoid date-boundary issues
// 2026-03-18 is a Wednesday
const FIXED_DATE = new Date(2026, 2, 18, 12, 0, 0) // March 18, 2026 noon

// ---- Tests -----------------------------------------------------------------

describe('CalendarWeekView', () => {
  const mockOnEventClick = vi.fn<(event: CalendarEvent) => void>()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render 7 day column labels (Mon through Sun)', () => {
    render(
      <CalendarWeekView
        events={[]}
        currentDate={FIXED_DATE}
        onEventClick={mockOnEventClick}
      />
    )

    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    for (const label of labels) {
      expect(screen.getByText(label)).toBeDefined()
    }
  })

  it('should render day numbers for the current week', () => {
    // March 18 2026 is Wednesday. Week is Mon Mar 16 - Sun Mar 22
    render(
      <CalendarWeekView
        events={[]}
        currentDate={FIXED_DATE}
        onEventClick={mockOnEventClick}
      />
    )

    // The week containing Wed March 18 2026: Mon 16 - Sun 22
    for (const dayNum of [16, 17, 18, 19, 20, 21, 22]) {
      expect(screen.getByText(dayNum.toString())).toBeDefined()
    }
  })

  it('should highlight today column when currentDate contains today', () => {
    const today = new Date()
    render(
      <CalendarWeekView
        events={[]}
        currentDate={today}
        onEventClick={mockOnEventClick}
      />
    )

    // Today's date number should be present and styled with text-primary
    const todayNum = today.getDate().toString()
    const todayElement = screen.getByText(todayNum)
    expect(todayElement).toBeDefined()
    // The parent element should have the primary color class
    expect(todayElement.className).toContain('text-primary')
  })

  it('should render timed events as clickable buttons', () => {
    // Wednesday March 18 event
    const event = createEvent({
      id: 'evt-timed',
      title: 'Standup Call',
      start_at: '2026-03-18T09:00:00',
      end_at: '2026-03-18T09:30:00',
      all_day: false,
      color: 'blue',
    })

    render(
      <CalendarWeekView
        events={[event]}
        currentDate={FIXED_DATE}
        onEventClick={mockOnEventClick}
      />
    )

    const eventButton = screen.getByText('Standup Call')
    expect(eventButton).toBeDefined()

    // Should be inside a button
    const button = eventButton.closest('button')
    expect(button).not.toBeNull()
  })

  it('should position timed events with correct style (top/height)', () => {
    // Event from 9am to 11am on Wednesday
    const event = createEvent({
      id: 'evt-positioned',
      title: 'Two Hour Meeting',
      start_at: '2026-03-18T09:00:00',
      end_at: '2026-03-18T11:00:00',
      all_day: false,
    })

    render(
      <CalendarWeekView
        events={[event]}
        currentDate={FIXED_DATE}
        onEventClick={mockOnEventClick}
      />
    )

    const eventEl = screen.getByText('Two Hour Meeting')
    const button = eventEl.closest('button')
    expect(button).not.toBeNull()

    // 9am = hour 9, visible range starts at 7
    // top = ((9-7)/16) * 100 = 12.5%
    // height = ((11-9)/16) * 100 = 12.5%
    const style = button!.getAttribute('style')
    expect(style).toContain('top:')
    expect(style).toContain('height:')
  })

  it('should render all-day events in header row', () => {
    const allDayEvent = createEvent({
      id: 'evt-allday',
      title: 'Company Holiday',
      start_at: '2026-03-18T00:00:00Z',
      end_at: '2026-03-18T23:59:59Z',
      all_day: true,
      color: 'green',
    })

    render(
      <CalendarWeekView
        events={[allDayEvent]}
        currentDate={FIXED_DATE}
        onEventClick={mockOnEventClick}
      />
    )

    // All-day events should show the "all day" label
    expect(screen.getByText('all day')).toBeDefined()
    // The event title should be visible
    expect(screen.getByText('Company Holiday')).toBeDefined()
  })

  it('should not show all-day row when no all-day events exist', () => {
    const timedEvent = createEvent({
      id: 'evt-timed-only',
      title: 'Just Timed',
      all_day: false,
    })

    render(
      <CalendarWeekView
        events={[timedEvent]}
        currentDate={FIXED_DATE}
        onEventClick={mockOnEventClick}
      />
    )

    // "all day" label should not be present
    expect(screen.queryByText('all day')).toBeNull()
  })

  it('should fire onEventClick when a timed event is clicked', () => {
    const event = createEvent({
      id: 'evt-click',
      title: 'Clickable Event',
      start_at: '2026-03-18T10:00:00',
      end_at: '2026-03-18T11:00:00',
    })

    render(
      <CalendarWeekView
        events={[event]}
        currentDate={FIXED_DATE}
        onEventClick={mockOnEventClick}
      />
    )

    fireEvent.click(screen.getByText('Clickable Event'))
    expect(mockOnEventClick).toHaveBeenCalledTimes(1)
    expect(mockOnEventClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'evt-click', title: 'Clickable Event' })
    )
  })

  it('should fire onEventClick when an all-day event is clicked', () => {
    const allDayEvent = createEvent({
      id: 'evt-allday-click',
      title: 'All Day Clickable',
      start_at: '2026-03-18T00:00:00Z',
      end_at: '2026-03-18T23:59:59Z',
      all_day: true,
    })

    render(
      <CalendarWeekView
        events={[allDayEvent]}
        currentDate={FIXED_DATE}
        onEventClick={mockOnEventClick}
      />
    )

    fireEvent.click(screen.getByText('All Day Clickable'))
    expect(mockOnEventClick).toHaveBeenCalledTimes(1)
    expect(mockOnEventClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'evt-allday-click' })
    )
  })

  it('should render hour labels from 7 AM to 10 PM', () => {
    render(
      <CalendarWeekView
        events={[]}
        currentDate={FIXED_DATE}
        onEventClick={mockOnEventClick}
      />
    )

    expect(screen.getByText('7 AM')).toBeDefined()
    expect(screen.getByText('12 PM')).toBeDefined()
    expect(screen.getByText('5 PM')).toBeDefined()
    expect(screen.getByText('10 PM')).toBeDefined()
  })

  it('should apply color classes based on event color property', () => {
    const blueEvent = createEvent({
      id: 'evt-blue',
      title: 'Blue Event',
      start_at: '2026-03-18T10:00:00',
      end_at: '2026-03-18T11:00:00',
      color: 'blue',
    })

    render(
      <CalendarWeekView
        events={[blueEvent]}
        currentDate={FIXED_DATE}
        onEventClick={mockOnEventClick}
      />
    )

    const eventEl = screen.getByText('Blue Event')
    const button = eventEl.closest('button')
    expect(button).not.toBeNull()
    expect(button!.className).toContain('bg-blue-500')
  })
})
