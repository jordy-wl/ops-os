/**
 * tests/sprint18/manual-entry-form.test.tsx
 *
 * Unit tests for ManualTimeEntryForm component.
 * Covers: field rendering, end time validation, onSaved/onCancel callbacks,
 * submission flow, and error handling.
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
    DollarSign: icon('dollar-sign'),
  }
})

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

// ---- Fetch mock setup -------------------------------------------------------

const fetchSpy = vi.spyOn(global, 'fetch')

// ---- Import after mocks ----------------------------------------------------

import { ManualTimeEntryForm } from '@/components/my-work/manual-time-entry-form'

// ---- Tests -----------------------------------------------------------------

describe('ManualTimeEntryForm', () => {
  const mockOnSaved = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    fetchSpy.mockReset()
  })

  it('should render all form fields (description, date, start time, end time)', () => {
    render(<ManualTimeEntryForm onSaved={mockOnSaved} onCancel={mockOnCancel} />)

    // Description input
    expect(screen.getByPlaceholderText('What did you work on?')).toBeDefined()

    // Date input
    const dateInput = document.querySelector('input[type="date"]')
    expect(dateInput).toBeDefined()

    // Time inputs
    const timeInputs = document.querySelectorAll('input[type="time"]')
    expect(timeInputs.length).toBe(2) // start time + end time
  })

  it('should render billable toggle button', () => {
    render(<ManualTimeEntryForm onSaved={mockOnSaved} onCancel={mockOnCancel} />)

    const billableBtn = screen.getAllByRole('button').find((b) => b.textContent?.includes('Billable'))
    expect(billableBtn).toBeDefined()
  })

  it('should render Cancel and Save Entry buttons', () => {
    render(<ManualTimeEntryForm onSaved={mockOnSaved} onCancel={mockOnCancel} />)

    expect(screen.getByText('Cancel')).toBeDefined()
    expect(screen.getByText('Save Entry')).toBeDefined()
  })

  it('should validate that end time must be after start time', async () => {
    render(<ManualTimeEntryForm onSaved={mockOnSaved} onCancel={mockOnCancel} />)

    // Set start time to 10:00 and end time to 09:00 (invalid)
    const timeInputs = document.querySelectorAll('input[type="time"]')
    fireEvent.change(timeInputs[0], { target: { value: '10:00' } })
    fireEvent.change(timeInputs[1], { target: { value: '09:00' } })

    // Submit the form
    const submitBtn = screen.getByText('Save Entry')
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText('End time must be after start time')).toBeDefined()
    })

    // onSaved should NOT have been called
    expect(mockOnSaved).not.toHaveBeenCalled()
    // fetch should NOT have been called
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('should validate that end time equal to start time is invalid', async () => {
    render(<ManualTimeEntryForm onSaved={mockOnSaved} onCancel={mockOnCancel} />)

    const timeInputs = document.querySelectorAll('input[type="time"]')
    fireEvent.change(timeInputs[0], { target: { value: '10:00' } })
    fireEvent.change(timeInputs[1], { target: { value: '10:00' } })

    fireEvent.click(screen.getByText('Save Entry'))

    await waitFor(() => {
      expect(screen.getByText('End time must be after start time')).toBeDefined()
    })

    expect(mockOnSaved).not.toHaveBeenCalled()
  })

  it('should call onSaved callback after successful submission', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'new-entry' } }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    render(<ManualTimeEntryForm onSaved={mockOnSaved} onCancel={mockOnCancel} />)

    // Fill description
    fireEvent.change(screen.getByPlaceholderText('What did you work on?'), {
      target: { value: 'Test work' },
    })

    // Times default to 09:00 - 10:00 which is valid
    fireEvent.click(screen.getByText('Save Entry'))

    await waitFor(() => {
      expect(mockOnSaved).toHaveBeenCalledTimes(1)
    })

    // Verify the API was called
    expect(fetchSpy).toHaveBeenCalledWith('/api/time-entries', expect.objectContaining({
      method: 'POST',
    }))
  })

  it('should call onCancel callback when Cancel button is clicked', () => {
    render(<ManualTimeEntryForm onSaved={mockOnSaved} onCancel={mockOnCancel} />)

    fireEvent.click(screen.getByText('Cancel'))

    expect(mockOnCancel).toHaveBeenCalledTimes(1)
  })

  it('should show error message when API returns error', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: 'Server error occurred' } }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    )

    render(<ManualTimeEntryForm onSaved={mockOnSaved} onCancel={mockOnCancel} />)

    // Submit with valid data (default times 09:00 - 10:00 are valid)
    fireEvent.click(screen.getByText('Save Entry'))

    await waitFor(() => {
      expect(screen.getByText('Server error occurred')).toBeDefined()
    })

    expect(mockOnSaved).not.toHaveBeenCalled()
  })

  it('should show "Network error" when fetch throws', async () => {
    fetchSpy.mockRejectedValue(new Error('Network failure'))

    render(<ManualTimeEntryForm onSaved={mockOnSaved} onCancel={mockOnCancel} />)

    fireEvent.click(screen.getByText('Save Entry'))

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeDefined()
    })

    expect(mockOnSaved).not.toHaveBeenCalled()
  })

  it('should show "Saving..." text while submitting', async () => {
    // Use a never-resolving promise to keep the saving state
    fetchSpy.mockReturnValue(new Promise(() => {}))

    render(<ManualTimeEntryForm onSaved={mockOnSaved} onCancel={mockOnCancel} />)

    fireEvent.click(screen.getByText('Save Entry'))

    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeDefined()
    })
  })

  it('should disable save button while submitting', async () => {
    fetchSpy.mockReturnValue(new Promise(() => {}))

    render(<ManualTimeEntryForm onSaved={mockOnSaved} onCancel={mockOnCancel} />)

    fireEvent.click(screen.getByText('Save Entry'))

    await waitFor(() => {
      const savingBtn = screen.getByText('Saving...')
      expect(savingBtn.closest('button')?.disabled).toBe(true)
    })
  })

  it('should send correct payload to API', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'new-entry-2' } }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    render(<ManualTimeEntryForm onSaved={mockOnSaved} onCancel={mockOnCancel} />)

    // Fill description
    fireEvent.change(screen.getByPlaceholderText('What did you work on?'), {
      target: { value: 'API payload test' },
    })

    // Toggle billable
    const billableBtn = screen.getAllByRole('button').find((b) => b.textContent?.includes('Billable'))
    if (billableBtn) fireEvent.click(billableBtn)

    fireEvent.click(screen.getByText('Save Entry'))

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    const callArgs = fetchSpy.mock.calls[0]
    const body = JSON.parse((callArgs[1] as RequestInit).body as string)
    expect(body.description).toBe('API payload test')
    expect(body.is_billable).toBe(true)
    expect(body.started_at).toBeDefined()
    expect(body.ended_at).toBeDefined()
  })
})
