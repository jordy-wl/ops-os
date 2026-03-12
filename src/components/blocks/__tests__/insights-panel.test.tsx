/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { InsightsPanel } from '../insights-panel'
import type { DeltaResult } from '@/lib/ai/delta-types'

// ─── Mock fetch ──────────────────────────────────────────────────────────────

const mockDelta: DeltaResult = {
  instanceId: 'inst-1',
  templateId: 'tmpl-1',
  currentStepIndex: 1,
  totalSteps: 3,
  status: 'running',
  completedSteps: [
    {
      stepIndex: 0,
      stepName: 'step_one',
      stepType: 'emit_event',
      status: 'completed',
      expectedDurationHours: 24,
      actualDurationHours: 2,
      varianceHours: -22,
      startedAt: '2026-03-10T10:00:00Z',
      completedAt: '2026-03-10T12:00:00Z',
    },
  ],
  remainingSteps: [
    {
      stepIndex: 1,
      stepName: 'step_two',
      stepType: 'run_action',
      status: 'in_progress',
      expectedDurationHours: 24,
      actualDurationHours: 1,
      varianceHours: -23,
      startedAt: '2026-03-10T12:00:00Z',
      completedAt: null,
    },
    {
      stepIndex: 2,
      stepName: 'step_three',
      stepType: 'emit_event',
      status: 'pending',
      expectedDurationHours: 24,
      actualDurationHours: null,
      varianceHours: null,
      startedAt: null,
      completedAt: null,
    },
  ],
  timelineDeltas: [
    {
      stepIndex: 0,
      stepName: 'step_one',
      stepType: 'emit_event',
      status: 'completed',
      expectedDurationHours: 24,
      actualDurationHours: 2,
      varianceHours: -22,
      startedAt: '2026-03-10T10:00:00Z',
      completedAt: '2026-03-10T12:00:00Z',
    },
    {
      stepIndex: 1,
      stepName: 'step_two',
      stepType: 'run_action',
      status: 'in_progress',
      expectedDurationHours: 24,
      actualDurationHours: 1,
      varianceHours: -23,
      startedAt: '2026-03-10T12:00:00Z',
      completedAt: null,
    },
    {
      stepIndex: 2,
      stepName: 'step_three',
      stepType: 'emit_event',
      status: 'pending',
      expectedDurationHours: 24,
      actualDurationHours: null,
      varianceHours: null,
      startedAt: null,
      completedAt: null,
    },
  ],
  gapAnalysis: {
    overdueSteps: [],
    skippedSteps: [],
    outOfOrderSteps: [],
  },
  healthScore: { score: 100, overduePenalty: 0, skipPenalty: 0, variancePenalty: 0 },
  calculatedAt: '2026-03-12T10:00:00Z',
}

const mockResponse = {
  delta: mockDelta,
  insights: {
    whatsDone: ['Step one completed in 2h'],
    whatsNext: ['Step two in progress', 'Step three pending'],
    whatsAtRisk: [],
    recommendations: ['All on track'],
  },
}

beforeEach(() => {
  vi.restoreAllMocks()
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockResponse),
  }) as unknown as typeof fetch
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('InsightsPanel', () => {
  it('renders loading state initially', () => {
    // Make fetch hang
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch
    render(<InsightsPanel blockId="inst-1" />)

    // Should show skeleton (animate-pulse)
    const skeleton = document.querySelector('.animate-pulse')
    expect(skeleton).toBeTruthy()
  })

  it('renders insights after data loads', async () => {
    render(<InsightsPanel blockId="inst-1" />)

    await waitFor(() => {
      expect(screen.getByText('Workflow Insights')).toBeTruthy()
    })

    // Progress info
    expect(screen.getByText(/Step 2 of 3/)).toBeTruthy()
    expect(screen.getByText('33%')).toBeTruthy()
  })

  it('renders section headers', async () => {
    render(<InsightsPanel blockId="inst-1" />)

    await waitFor(() => {
      expect(screen.getByText("What's Done")).toBeTruthy()
      expect(screen.getByText("What's Next")).toBeTruthy()
      expect(screen.getByText("What's at Risk")).toBeTruthy()
      expect(screen.getByText('Recommendations')).toBeTruthy()
    })
  })

  it('renders insight items from API response', async () => {
    render(<InsightsPanel blockId="inst-1" />)

    await waitFor(() => {
      expect(screen.getByText(/Step one completed in 2h/)).toBeTruthy()
      expect(screen.getByText(/Step two in progress/)).toBeTruthy()
    })
  })

  it('shows on-track indicator when no risks and health >= 80', async () => {
    render(<InsightsPanel blockId="inst-1" />)

    await waitFor(() => {
      expect(screen.getByText('On track')).toBeTruthy()
    })
  })

  it('handles fetch error gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }) as unknown as typeof fetch

    render(<InsightsPanel blockId="inst-1" />)

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch insights/)).toBeTruthy()
    })
  })

  it('handles 404 (non workflow_instance) gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }) as unknown as typeof fetch

    render(<InsightsPanel blockId="inst-1" />)

    // Should render nothing for 404 (not a workflow instance)
    await waitFor(() => {
      expect(screen.queryByText('Workflow Insights')).toBeNull()
    })
  })

  it('toggles section collapse', async () => {
    render(<InsightsPanel blockId="inst-1" />)

    await waitFor(() => {
      expect(screen.getByText("What's Done")).toBeTruthy()
    })

    // Click to collapse "What's Done"
    const doneHeader = screen.getByText("What's Done")
    fireEvent.click(doneHeader)

    // Items should be hidden now (no "Step one completed")
    expect(screen.queryByText(/Step one completed in 2h/)).toBeNull()

    // Click again to expand
    fireEvent.click(doneHeader)
    expect(screen.getByText(/Step one completed in 2h/)).toBeTruthy()
  })

  it('calls fetch with correct URL', async () => {
    render(<InsightsPanel blockId="test-block-123" />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/blocks/test-block-123/insights')
    })
  })
})
