/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NotificationPreferencesPanel } from '../notification-preferences'
import { NotificationToggles, type NotificationPreferences } from '../notification-toggles'

// ─── Mock fetch ─────────────────────────────────────────────────────────────

const mockFetch = vi.hoisted(() => vi.fn())
vi.stubGlobal('fetch', mockFetch)

// ─── Test Data ──────────────────────────────────────────────────────────────

const DEFAULT_PREFS: NotificationPreferences = {
  event_types: {
    delta_alert: { in_app: true, email: false },
    task_assigned: { in_app: true, email: true },
    step_overdue: { in_app: true, email: true },
    workflow_complete: { in_app: true, email: false },
    mention: { in_app: true, email: true },
  },
  frequency: 'immediate',
}

function createFetchResponse(data: unknown, ok = true) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve({ data, error: null }),
  })
}

// ─── NotificationToggles Unit Tests ─────────────────────────────────────────

describe('NotificationToggles', () => {
  it('renders all 5 event types with display names', () => {
    const onChange = vi.fn()
    render(
      <NotificationToggles
        preferences={DEFAULT_PREFS}
        onPreferencesChange={onChange}
      />
    )

    expect(screen.getByText('Delta Alerts')).toBeDefined()
    expect(screen.getByText('Task Assigned')).toBeDefined()
    expect(screen.getByText('Step Overdue')).toBeDefined()
    expect(screen.getByText('Workflow Complete')).toBeDefined()
    expect(screen.getByText('Mentions')).toBeDefined()
  })

  it('renders descriptions for each event type', () => {
    const onChange = vi.fn()
    render(
      <NotificationToggles
        preferences={DEFAULT_PREFS}
        onPreferencesChange={onChange}
      />
    )

    expect(
      screen.getByText('Alerts when workflow health drops below thresholds')
    ).toBeDefined()
    expect(screen.getByText('When a task is assigned to you')).toBeDefined()
    expect(
      screen.getByText('When a workflow step passes its due date')
    ).toBeDefined()
    expect(
      screen.getByText('When a workflow instance finishes')
    ).toBeDefined()
    expect(
      screen.getByText('When someone mentions you in a comment or chat')
    ).toBeDefined()
  })

  it('calls onPreferencesChange when an email toggle is clicked', () => {
    const onChange = vi.fn()
    render(
      <NotificationToggles
        preferences={DEFAULT_PREFS}
        onPreferencesChange={onChange}
      />
    )

    // delta_alert email is false by default — click it to enable
    const deltaEmailToggle = screen.getByRole('switch', {
      name: /email notifications for delta alerts/i,
    })
    fireEvent.click(deltaEmailToggle)

    expect(onChange).toHaveBeenCalledTimes(1)
    const updatedPrefs = onChange.mock.calls[0][0] as NotificationPreferences
    expect(updatedPrefs.event_types.delta_alert.email).toBe(true)
    // Other prefs should remain unchanged
    expect(updatedPrefs.event_types.task_assigned.email).toBe(true)
    expect(updatedPrefs.frequency).toBe('immediate')
  })

  it('toggles email off when clicking an enabled toggle', () => {
    const onChange = vi.fn()
    render(
      <NotificationToggles
        preferences={DEFAULT_PREFS}
        onPreferencesChange={onChange}
      />
    )

    // task_assigned email is true by default — click to disable
    const taskEmailToggle = screen.getByRole('switch', {
      name: /email notifications for task assigned/i,
    })
    fireEvent.click(taskEmailToggle)

    expect(onChange).toHaveBeenCalledTimes(1)
    const updatedPrefs = onChange.mock.calls[0][0] as NotificationPreferences
    expect(updatedPrefs.event_types.task_assigned.email).toBe(false)
  })

  it('renders in-app toggles as always-on (not interactive buttons)', () => {
    const onChange = vi.fn()
    render(
      <NotificationToggles
        preferences={DEFAULT_PREFS}
        onPreferencesChange={onChange}
      />
    )

    const inAppToggles = screen.getAllByRole('switch', {
      name: /in-app notifications for/i,
    })
    expect(inAppToggles.length).toBe(5)

    // In-app toggles should all be checked
    inAppToggles.forEach((toggle) => {
      expect(toggle.getAttribute('aria-checked')).toBe('true')
    })
  })

  it('renders frequency radio group with Immediate and Daily Digest', () => {
    const onChange = vi.fn()
    render(
      <NotificationToggles
        preferences={DEFAULT_PREFS}
        onPreferencesChange={onChange}
      />
    )

    const immediateRadio = screen.getByLabelText(/immediate/i)
    const dailyDigestRadio = screen.getByLabelText(/daily digest/i)

    expect(immediateRadio).toBeDefined()
    expect(dailyDigestRadio).toBeDefined()

    // Default is immediate
    expect((immediateRadio as HTMLInputElement).checked).toBe(true)
    expect((dailyDigestRadio as HTMLInputElement).checked).toBe(false)
  })

  it('calls onPreferencesChange when frequency radio is changed', () => {
    const onChange = vi.fn()
    render(
      <NotificationToggles
        preferences={DEFAULT_PREFS}
        onPreferencesChange={onChange}
      />
    )

    const dailyDigestRadio = screen.getByLabelText(/daily digest/i)
    fireEvent.click(dailyDigestRadio)

    expect(onChange).toHaveBeenCalledTimes(1)
    const updatedPrefs = onChange.mock.calls[0][0] as NotificationPreferences
    expect(updatedPrefs.frequency).toBe('daily_digest')
    // Event types unchanged
    expect(updatedPrefs.event_types).toEqual(DEFAULT_PREFS.event_types)
  })

  it('reflects daily_digest frequency when passed as prop', () => {
    const onChange = vi.fn()
    const digestPrefs: NotificationPreferences = {
      ...DEFAULT_PREFS,
      frequency: 'daily_digest',
    }
    render(
      <NotificationToggles
        preferences={digestPrefs}
        onPreferencesChange={onChange}
      />
    )

    const immediateRadio = screen.getByLabelText(/immediate/i)
    const dailyDigestRadio = screen.getByLabelText(/daily digest/i)

    expect((immediateRadio as HTMLInputElement).checked).toBe(false)
    expect((dailyDigestRadio as HTMLInputElement).checked).toBe(true)
  })
})

// ─── NotificationPreferencesPanel Integration Tests ─────────────────────────

describe('NotificationPreferencesPanel', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows loading state initially', () => {
    // Fetch never resolves — stays in loading
    mockFetch.mockReturnValue(new Promise(() => {}))
    render(<NotificationPreferencesPanel />)

    expect(
      screen.getByRole('status', { name: /loading notification preferences/i })
    ).toBeDefined()
  })

  it('renders preferences after successful fetch', async () => {
    mockFetch.mockReturnValue(createFetchResponse(DEFAULT_PREFS))
    render(<NotificationPreferencesPanel />)

    await waitFor(() => {
      expect(screen.getByText('Delta Alerts')).toBeDefined()
    })

    expect(screen.getByText('Task Assigned')).toBeDefined()
    expect(screen.getByText('Save Preferences')).toBeDefined()
  })

  it('shows error state when fetch fails', async () => {
    mockFetch.mockReturnValue(
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ data: null, error: 'Server error' }),
      })
    )
    render(<NotificationPreferencesPanel />)

    await waitFor(() => {
      expect(
        screen.getByText('Failed to load notification preferences.')
      ).toBeDefined()
    })
  })

  it('save button is disabled when no changes made', async () => {
    mockFetch.mockReturnValue(createFetchResponse(DEFAULT_PREFS))
    render(<NotificationPreferencesPanel />)

    await waitFor(() => {
      expect(screen.getByText('Save Preferences')).toBeDefined()
    })

    const saveButton = screen.getByText('Save Preferences')
    expect(saveButton.hasAttribute('disabled')).toBe(true)
  })

  it('save button becomes enabled after toggling a preference', async () => {
    mockFetch.mockReturnValue(createFetchResponse(DEFAULT_PREFS))
    render(<NotificationPreferencesPanel />)

    await waitFor(() => {
      expect(screen.getByText('Delta Alerts')).toBeDefined()
    })

    // Toggle delta_alert email
    const deltaEmailToggle = screen.getByRole('switch', {
      name: /email notifications for delta alerts/i,
    })
    fireEvent.click(deltaEmailToggle)

    const saveButton = screen.getByText('Save Preferences')
    expect(saveButton.hasAttribute('disabled')).toBe(false)
  })

  it('calls PUT API and shows success message on save', async () => {
    // First call: GET to fetch prefs
    mockFetch.mockReturnValueOnce(createFetchResponse(DEFAULT_PREFS))

    render(<NotificationPreferencesPanel />)

    await waitFor(() => {
      expect(screen.getByText('Delta Alerts')).toBeDefined()
    })

    // Toggle to make dirty
    const deltaEmailToggle = screen.getByRole('switch', {
      name: /email notifications for delta alerts/i,
    })
    fireEvent.click(deltaEmailToggle)

    // Mock the PUT call
    const updatedPrefs = {
      ...DEFAULT_PREFS,
      event_types: {
        ...DEFAULT_PREFS.event_types,
        delta_alert: { in_app: true, email: true },
      },
    }
    mockFetch.mockReturnValueOnce(createFetchResponse(updatedPrefs))

    // Click save
    const saveButton = screen.getByText('Save Preferences')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText('Preferences saved')).toBeDefined()
    })

    // Verify PUT was called
    expect(mockFetch).toHaveBeenCalledTimes(2) // GET + PUT
    const putCall = mockFetch.mock.calls[1]
    expect(putCall[0]).toBe('/api/settings/notifications')
    expect(putCall[1].method).toBe('PUT')
  })

  it('shows error when save fails', async () => {
    mockFetch.mockReturnValueOnce(createFetchResponse(DEFAULT_PREFS))
    render(<NotificationPreferencesPanel />)

    await waitFor(() => {
      expect(screen.getByText('Delta Alerts')).toBeDefined()
    })

    // Toggle to make dirty
    const deltaEmailToggle = screen.getByRole('switch', {
      name: /email notifications for delta alerts/i,
    })
    fireEvent.click(deltaEmailToggle)

    // Mock PUT failure
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ data: null, error: 'Server error' }),
      })
    )

    const saveButton = screen.getByText('Save Preferences')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(
        screen.getByText(
          'Failed to save notification preferences. Please try again.'
        )
      ).toBeDefined()
    })
  })
})
