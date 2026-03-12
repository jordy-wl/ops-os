/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock next/navigation (required by settings layout)
vi.mock('next/navigation', () => ({
  usePathname: () => '/settings/routing',
  useRouter: () => ({ push: vi.fn() }),
}))

// Mock fetch globally
const mockFetch = vi.fn() as Mock

beforeEach(() => {
  vi.restoreAllMocks()
  globalThis.fetch = mockFetch
})

// ── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_POLICY = {
  routing_mode: 'hybrid',
  confidence_threshold: 0.75,
  risk_routing_map: {
    low: { mode: 'ai_only', threshold: 0.7 },
    medium: { mode: 'hybrid', threshold: 0.8 },
    high: { mode: 'human_only', threshold: 0.9 },
    critical: { mode: 'human_only', threshold: 1.0 },
  },
  approval_chain: [],
  fallback_routing: 'human_only',
  max_ai_attempts: 3,
  policy_id: 'pol-123',
}

function mockFetchSuccess(data = DEFAULT_POLICY) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ data, error: null }),
  })
}

function mockFetchError(status = 500) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({ data: null, error: { message: 'Server error' } }),
  })
}

// ── Tests ────────────────────────────────────────────────────────────────────

// Lazy-load the page component to avoid module-level import issues
async function renderPage() {
  const { default: RoutingSettingsPage } = await import(
    '@/app/(app)/settings/routing/page'
  )
  return render(<RoutingSettingsPage />)
}

describe('RoutingSettingsPage', () => {
  it('shows loading state initially', async () => {
    // Never resolve the fetch so we stay in loading
    mockFetch.mockReturnValueOnce(new Promise(() => {}))
    await renderPage()

    expect(screen.getByRole('status')).toBeDefined()
    expect(screen.getByText('Routing Policies')).toBeDefined()
  })

  it('loads and displays default policy values', async () => {
    mockFetchSuccess()
    await renderPage()

    await waitFor(() => {
      expect(screen.getByText('Save Policy')).toBeDefined()
    })

    // The heading is present
    expect(screen.getByText('Routing Policies')).toBeDefined()

    // Confidence slider shows current value
    expect(screen.getByText('0.75')).toBeDefined()

    // The routing mode buttons are rendered (text appears in both buttons and selects)
    expect(screen.getAllByText('Human Only').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('AI Only').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Hybrid').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Escalation Chain')).toBeDefined()

    // Verify fetch was called with the correct URL
    expect(mockFetch).toHaveBeenCalledWith('/api/settings/routing')
  })

  it('shows error state with retry on load failure', async () => {
    mockFetchError()
    await renderPage()

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined()
    })

    expect(screen.getByText(/Failed to load routing policy/)).toBeDefined()
    expect(screen.getByText('Retry')).toBeDefined()
  })

  it('retries loading when retry button is clicked', async () => {
    mockFetchError()
    await renderPage()

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeDefined()
    })

    // Set up success response for retry
    mockFetchSuccess()
    fireEvent.click(screen.getByText('Retry'))

    await waitFor(() => {
      expect(screen.getByText('Save Policy')).toBeDefined()
    })

    // Should have been called twice: initial + retry
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})

describe('ConfidenceSlider', () => {
  it('renders with the provided value', async () => {
    mockFetchSuccess()
    await renderPage()

    await waitFor(() => {
      expect(screen.getByText('0.75')).toBeDefined()
    })

    const slider = screen.getByLabelText('Confidence Threshold') as HTMLInputElement
    expect(slider).toBeDefined()
    expect(slider.type).toBe('range')
    expect(slider.value).toBe('0.75')
  })

  it('updates displayed value when slider is moved', async () => {
    mockFetchSuccess()
    await renderPage()

    await waitFor(() => {
      expect(screen.getByText('0.75')).toBeDefined()
    })

    const slider = screen.getByLabelText('Confidence Threshold') as HTMLInputElement
    fireEvent.change(slider, { target: { value: '0.60' } })

    expect(screen.getByText('0.60')).toBeDefined()
  })
})

describe('RiskMatrix', () => {
  it('renders all 4 risk levels', async () => {
    mockFetchSuccess()
    await renderPage()

    await waitFor(() => {
      expect(screen.getByText('Save Policy')).toBeDefined()
    })

    // Check risk level badges (they appear in both desktop table and mobile cards)
    expect(screen.getAllByText('Low').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Medium').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('High').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Critical').length).toBeGreaterThanOrEqual(1)
  })

  it('renders routing mode selectors for each risk level', async () => {
    mockFetchSuccess()
    await renderPage()

    await waitFor(() => {
      expect(screen.getByText('Save Policy')).toBeDefined()
    })

    // Desktop mode selectors (4 aria-labeled selects)
    const lowSelect = screen.getByLabelText('Routing mode for Low risk')
    const medSelect = screen.getByLabelText('Routing mode for Medium risk')
    const highSelect = screen.getByLabelText('Routing mode for High risk')
    const critSelect = screen.getByLabelText('Routing mode for Critical risk')

    expect(lowSelect).toBeDefined()
    expect(medSelect).toBeDefined()
    expect(highSelect).toBeDefined()
    expect(critSelect).toBeDefined()

    // Verify initial values from the loaded policy
    expect((lowSelect as HTMLSelectElement).value).toBe('ai_only')
    expect((medSelect as HTMLSelectElement).value).toBe('hybrid')
    expect((highSelect as HTMLSelectElement).value).toBe('human_only')
    expect((critSelect as HTMLSelectElement).value).toBe('human_only')
  })
})

describe('Save functionality', () => {
  it('calls PUT /api/settings/routing on save', async () => {
    mockFetchSuccess()
    await renderPage()

    await waitFor(() => {
      expect(screen.getByText('Save Policy')).toBeDefined()
    })

    // Mock the PUT response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: DEFAULT_POLICY, error: null }),
    })

    fireEvent.click(screen.getByText('Save Policy'))

    await waitFor(() => {
      expect(screen.getByText('Saved')).toBeDefined()
    })

    // Verify the PUT call
    const putCall = mockFetch.mock.calls[1]
    expect(putCall[0]).toBe('/api/settings/routing')
    expect(putCall[1].method).toBe('PUT')

    const body = JSON.parse(putCall[1].body)
    expect(body.routing_mode).toBe('hybrid')
    expect(body.confidence_threshold).toBe(0.75)
    expect(body.risk_routing_map).toEqual(DEFAULT_POLICY.risk_routing_map)
  })

  it('shows error banner on save failure', async () => {
    mockFetchSuccess()
    await renderPage()

    await waitFor(() => {
      expect(screen.getByText('Save Policy')).toBeDefined()
    })

    // Mock a failed PUT
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        data: null,
        error: { message: 'Insufficient permissions' },
      }),
    })

    fireEvent.click(screen.getByText('Save Policy'))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined()
    })

    expect(screen.getByText('Insufficient permissions')).toBeDefined()
  })

  it('shows "Saving..." while save is in progress', async () => {
    mockFetchSuccess()
    await renderPage()

    await waitFor(() => {
      expect(screen.getByText('Save Policy')).toBeDefined()
    })

    // Make PUT never resolve so we can check the saving state
    mockFetch.mockReturnValueOnce(new Promise(() => {}))

    fireEvent.click(screen.getByText('Save Policy'))

    expect(screen.getByText('Saving...')).toBeDefined()
  })
})

describe('RoutingPreview', () => {
  it('shows 3 preview scenario cards', async () => {
    mockFetchSuccess()
    await renderPage()

    await waitFor(() => {
      expect(screen.getByText('Save Policy')).toBeDefined()
    })

    expect(screen.getByText('Low-risk data entry')).toBeDefined()
    expect(screen.getByText('Medium-risk approval')).toBeDefined()
    expect(screen.getByText('High-risk compliance review')).toBeDefined()
  })

  it('shows routing decisions based on config', async () => {
    mockFetchSuccess()
    await renderPage()

    await waitFor(() => {
      expect(screen.getByText('Save Policy')).toBeDefined()
    })

    // With default policy: low risk + ai_only + confidence 0.9 >= threshold 0.7 => Agent
    // medium risk + hybrid + confidence 0.6 < threshold 0.8 => Human
    // high risk + human_only => Human
    const agentBadges = screen.getAllByText('Agent')
    const humanBadges = screen.getAllByText('Human')

    // At least 1 Agent and at least 1 Human decision should exist
    expect(agentBadges.length).toBeGreaterThanOrEqual(1)
    expect(humanBadges.length).toBeGreaterThanOrEqual(1)
  })

  it('updates preview when routing mode changes', async () => {
    mockFetchSuccess({
      ...DEFAULT_POLICY,
      routing_mode: 'human_only',
      risk_routing_map: {
        low: { mode: 'human_only', threshold: 0.7 },
        medium: { mode: 'human_only', threshold: 0.8 },
        high: { mode: 'human_only', threshold: 0.9 },
        critical: { mode: 'human_only', threshold: 1.0 },
      },
    })
    await renderPage()

    await waitFor(() => {
      expect(screen.getByText('Save Policy')).toBeDefined()
    })

    // All human_only should produce Human routing for all scenarios
    const humanBadges = screen.getAllByText('Human')
    expect(humanBadges.length).toBeGreaterThanOrEqual(3)
  })
})

describe('Default routing mode selection', () => {
  it('shows the current routing mode as selected', async () => {
    mockFetchSuccess()
    await renderPage()

    await waitFor(() => {
      expect(screen.getByText('Save Policy')).toBeDefined()
    })

    // The "Hybrid" button should be pressed
    const hybridButton = screen.getByRole('button', { name: /Hybrid/i })
    expect(hybridButton.getAttribute('aria-pressed')).toBe('true')

    // The "Human Only" button should not be pressed
    // Note: we have to be careful because "Human Only" text appears elsewhere too
    const humanButton = screen.getAllByRole('button').find(
      (btn) => btn.getAttribute('aria-pressed') !== null && btn.textContent?.includes('Human Only')
    )
    expect(humanButton?.getAttribute('aria-pressed')).toBe('false')
  })

  it('changes routing mode when clicking a different option', async () => {
    mockFetchSuccess()
    await renderPage()

    await waitFor(() => {
      expect(screen.getByText('Save Policy')).toBeDefined()
    })

    // Click "AI Only"
    const aiButton = screen.getByRole('button', { name: /AI Only/i })
    fireEvent.click(aiButton)

    expect(aiButton.getAttribute('aria-pressed')).toBe('true')
  })
})
