/**
 * tests/sprint19/calendar-event-modal.test.tsx
 *
 * Unit tests for CalendarEventModal component.
 * Covers: new/edit titles, title validation, end-after-start validation,
 * POST for new events, PATCH for edits, Cancel close, color picker,
 * and all-day toggle.
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
    X: icon('x'),
  }
})

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

vi.mock('./calendar-tab', () => ({}))

// ---- Fetch mock setup -------------------------------------------------------

const fetchSpy = vi.spyOn(global, 'fetch')

// ---- Import after mocks ----------------------------------------------------

import { CalendarEventModal } from '@/components/my-work/calendar-event-modal'

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

function createExistingEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: overrides.id ?? 'existing-event-1',
    title: overrides.title ?? 'Existing Meeting',
    description: overrides.description ?? 'Already scheduled',
    start_at: overrides.start_at ?? '2026-03-18T10:00:00Z',
    end_at: overrides.end_at ?? '2026-03-18T11:00:00Z',
    all_day: overrides.all_day ?? false,
    source: overrides.source ?? 'local',
    external_link: overrides.external_link ?? null,
    color: overrides.color ?? 'blue',
    block_id: overrides.block_id ?? null,
  }
}

// ---- Tests -----------------------------------------------------------------

describe('CalendarEventModal', () => {
  const mockOnSaved = vi.fn()
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    fetchSpy.mockReset()
  })

  afterEach(() => {
    fetchSpy.mockReset()
  })

  it('should render "New Event" title when no event prop is provided', () => {
    render(
      <CalendarEventModal
        event={null}
        onSaved={mockOnSaved}
        onClose={mockOnClose}
      />
    )

    expect(screen.getByText('New Event')).toBeDefined()
    // Submit button should say "Create Event"
    expect(screen.getByText('Create Event')).toBeDefined()
  })

  it('should render "Edit Event" title when event prop is provided', () => {
    const event = createExistingEvent()

    render(
      <CalendarEventModal
        event={event}
        onSaved={mockOnSaved}
        onClose={mockOnClose}
      />
    )

    expect(screen.getByText('Edit Event')).toBeDefined()
    // Submit button should say "Save Changes"
    expect(screen.getByText('Save Changes')).toBeDefined()
  })

  it('should populate form fields when editing an existing event', () => {
    const event = createExistingEvent({
      title: 'Prefilled Title',
      description: 'Prefilled Description',
    })

    render(
      <CalendarEventModal
        event={event}
        onSaved={mockOnSaved}
        onClose={mockOnClose}
      />
    )

    const titleInput = screen.getByPlaceholderText('Event title') as HTMLInputElement
    expect(titleInput.value).toBe('Prefilled Title')

    const descInput = screen.getByPlaceholderText('Description (optional)') as HTMLTextAreaElement
    expect(descInput.value).toBe('Prefilled Description')
  })

  it('should show validation error when title is empty on submit', async () => {
    render(
      <CalendarEventModal
        event={null}
        onSaved={mockOnSaved}
        onClose={mockOnClose}
      />
    )

    // Clear any default and submit with empty title
    const titleInput = screen.getByPlaceholderText('Event title') as HTMLInputElement
    fireEvent.change(titleInput, { target: { value: '' } })

    fireEvent.click(screen.getByText('Create Event'))

    await waitFor(() => {
      expect(screen.getByText('Title is required')).toBeDefined()
    })

    // Should NOT have called fetch
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(mockOnSaved).not.toHaveBeenCalled()
  })

  it('should show validation error when end is before start', async () => {
    render(
      <CalendarEventModal
        event={null}
        onSaved={mockOnSaved}
        onClose={mockOnClose}
      />
    )

    const titleInput = screen.getByPlaceholderText('Event title') as HTMLInputElement
    fireEvent.change(titleInput, { target: { value: 'Valid Title' } })

    // Set start after end
    const inputs = screen.getAllByDisplayValue(/2026/) as HTMLInputElement[]
    const startInput = inputs[0]
    const endInput = inputs[1]

    if (startInput && endInput) {
      fireEvent.change(startInput, { target: { value: '2026-03-18T14:00' } })
      fireEvent.change(endInput, { target: { value: '2026-03-18T10:00' } })
    }

    fireEvent.click(screen.getByText('Create Event'))

    await waitFor(() => {
      expect(screen.getByText('End must be after start')).toBeDefined()
    })

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('should submit POST for new events', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: 'new-1' }, error: null }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    render(
      <CalendarEventModal
        event={null}
        onSaved={mockOnSaved}
        onClose={mockOnClose}
      />
    )

    const titleInput = screen.getByPlaceholderText('Event title') as HTMLInputElement
    fireEvent.change(titleInput, { target: { value: 'New Sprint Meeting' } })

    fireEvent.click(screen.getByText('Create Event'))

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    const [url, options] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/calendar-events')
    expect(options?.method).toBe('POST')

    const body = JSON.parse(options?.body as string)
    expect(body.title).toBe('New Sprint Meeting')

    expect(mockOnSaved).toHaveBeenCalledTimes(1)
  })

  it('should submit PATCH for existing events', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: 'existing-event-1' }, error: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const event = createExistingEvent({ id: 'existing-event-1', title: 'Old Title' })

    render(
      <CalendarEventModal
        event={event}
        onSaved={mockOnSaved}
        onClose={mockOnClose}
      />
    )

    const titleInput = screen.getByPlaceholderText('Event title') as HTMLInputElement
    fireEvent.change(titleInput, { target: { value: 'Updated Title' } })

    fireEvent.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    const [url, options] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/calendar-events?id=existing-event-1')
    expect(options?.method).toBe('PATCH')

    const body = JSON.parse(options?.body as string)
    expect(body.title).toBe('Updated Title')

    expect(mockOnSaved).toHaveBeenCalledTimes(1)
  })

  it('should call onClose when Cancel button is clicked', () => {
    render(
      <CalendarEventModal
        event={null}
        onSaved={mockOnSaved}
        onClose={mockOnClose}
      />
    )

    fireEvent.click(screen.getByText('Cancel'))

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should call onClose when backdrop is clicked', () => {
    const { container } = render(
      <CalendarEventModal
        event={null}
        onSaved={mockOnSaved}
        onClose={mockOnClose}
      />
    )

    // The backdrop is the outer fixed div
    const backdrop = container.firstElementChild
    if (backdrop) {
      fireEvent.click(backdrop)
    }

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should render 5 color options', () => {
    render(
      <CalendarEventModal
        event={null}
        onSaved={mockOnSaved}
        onClose={mockOnClose}
      />
    )

    // 5 colors: Indigo, Blue, Green, Red, Orange
    const colorButtons = screen.getAllByRole('button').filter(
      (btn) => btn.getAttribute('aria-label') !== null &&
        ['Indigo', 'Blue', 'Green', 'Red', 'Orange'].includes(btn.getAttribute('aria-label') ?? '')
    )
    expect(colorButtons).toHaveLength(5)
  })

  it('should show ring on selected color', () => {
    const event = createExistingEvent({ color: 'green' })

    render(
      <CalendarEventModal
        event={event}
        onSaved={mockOnSaved}
        onClose={mockOnClose}
      />
    )

    const greenButton = screen.getByLabelText('Green')
    expect(greenButton.className).toContain('ring-2')
  })

  it('should toggle all-day mode checkbox', () => {
    render(
      <CalendarEventModal
        event={null}
        onSaved={mockOnSaved}
        onClose={mockOnClose}
      />
    )

    const checkbox = screen.getByLabelText('All day') as HTMLInputElement
    expect(checkbox.checked).toBe(false)

    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(true)

    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(false)
  })

  it('should show error from API failure', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ data: null, error: { message: 'Server error', code: 'db/insert-failed' } }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    )

    render(
      <CalendarEventModal
        event={null}
        onSaved={mockOnSaved}
        onClose={mockOnClose}
      />
    )

    const titleInput = screen.getByPlaceholderText('Event title') as HTMLInputElement
    fireEvent.change(titleInput, { target: { value: 'Will fail' } })

    fireEvent.click(screen.getByText('Create Event'))

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeDefined()
    })

    expect(mockOnSaved).not.toHaveBeenCalled()
  })

  it('should show "Network error" on fetch rejection', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('net::ERR_CONNECTION_REFUSED'))

    render(
      <CalendarEventModal
        event={null}
        onSaved={mockOnSaved}
        onClose={mockOnClose}
      />
    )

    const titleInput = screen.getByPlaceholderText('Event title') as HTMLInputElement
    fireEvent.change(titleInput, { target: { value: 'Will fail' } })

    fireEvent.click(screen.getByText('Create Event'))

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeDefined()
    })

    expect(mockOnSaved).not.toHaveBeenCalled()
  })

  it('should show "Saving..." on submit button while saving', async () => {
    // Create a fetch that never resolves to keep saving state
    fetchSpy.mockReturnValueOnce(new Promise(() => {}))

    render(
      <CalendarEventModal
        event={null}
        onSaved={mockOnSaved}
        onClose={mockOnClose}
      />
    )

    const titleInput = screen.getByPlaceholderText('Event title') as HTMLInputElement
    fireEvent.change(titleInput, { target: { value: 'Saving test' } })

    await act(async () => {
      fireEvent.click(screen.getByText('Create Event'))
    })

    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeDefined()
    })
  })
})
