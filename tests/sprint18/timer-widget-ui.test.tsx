/**
 * tests/sprint18/timer-widget-ui.test.tsx
 *
 * Unit tests for TimerWidget UI component.
 * Covers: compact button when collapsed, expanded form, description input,
 * billable toggle, timebox preset buttons, and formatElapsed formatting.
 *
 * Uses vitest + @testing-library/react in jsdom environment.
 * The useTimer hook is mocked to control state without the full provider.
 */

// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// ---- Mock dependencies ------------------------------------------------------

// Mock lucide-react icons with simple stubs
vi.mock('lucide-react', () => {
  const icon = (name: string) =>
    function MockIcon(props: Record<string, unknown>) {
      return React.createElement('svg', { 'data-testid': `icon-${name}`, ...props })
    }
  return {
    Play: icon('play'),
    Square: icon('square'),
    Clock: icon('clock'),
    DollarSign: icon('dollar-sign'),
    Target: icon('target'),
    ChevronDown: icon('chevron-down'),
    ChevronUp: icon('chevron-up'),
  }
})

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

// ---- Mock useTimer ----------------------------------------------------------

const mockTimer = vi.hoisted(() => ({
  isRunning: false,
  startedAt: null as number | null,
  blockId: null as string | null,
  blockName: null as string | null,
  description: '',
  isBillable: false,
  timeboxSeconds: null as number | null,
  entryId: null as string | null,
  elapsedSeconds: 0,
  start: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  stop: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  update: vi.fn(),
}))

vi.mock('@/components/timer/timer-widget-provider', () => ({
  useTimer: () => mockTimer,
}))

// ---- Import component after mocks ------------------------------------------

import { TimerWidget } from '@/components/timer/timer-widget'

// ---- Tests -----------------------------------------------------------------

describe('TimerWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to default stopped state
    mockTimer.isRunning = false
    mockTimer.startedAt = null
    mockTimer.blockId = null
    mockTimer.blockName = null
    mockTimer.description = ''
    mockTimer.isBillable = false
    mockTimer.timeboxSeconds = null
    mockTimer.entryId = null
    mockTimer.elapsedSeconds = 0
  })

  it('should render compact "Timer" button when collapsed and not running', () => {
    render(<TimerWidget />)

    const btn = screen.getByRole('button', { name: /start timer/i })
    expect(btn).toBeDefined()
    expect(btn.textContent).toContain('Timer')
    expect(screen.getByTestId('icon-clock')).toBeDefined()
  })

  it('should expand to full form when compact button is clicked', () => {
    render(<TimerWidget />)

    // Click the compact button
    const compactBtn = screen.getByRole('button', { name: /start timer/i })
    fireEvent.click(compactBtn)

    // After expanding, should show the description input
    const input = screen.getByPlaceholderText('What are you working on?')
    expect(input).toBeDefined()
  })

  it('should show description input in expanded state', () => {
    render(<TimerWidget />)

    // Expand
    fireEvent.click(screen.getByRole('button', { name: /start timer/i }))

    const input = screen.getByPlaceholderText('What are you working on?')
    expect(input).toBeDefined()
    expect(input.tagName).toBe('INPUT')
  })

  it('should show billable toggle button', () => {
    render(<TimerWidget />)

    // Expand
    fireEvent.click(screen.getByRole('button', { name: /start timer/i }))

    const billableBtn = screen.getByRole('button', { name: /toggle billable/i })
    expect(billableBtn).toBeDefined()
    expect(billableBtn.textContent).toContain('Billable')
  })

  it('should show timebox preset buttons (Off, 15m, 25m, 45m, 60m)', () => {
    render(<TimerWidget />)

    // Expand
    fireEvent.click(screen.getByRole('button', { name: /start timer/i }))

    expect(screen.getByText('Off')).toBeDefined()
    expect(screen.getByText('15m')).toBeDefined()
    expect(screen.getByText('25m')).toBeDefined()
    expect(screen.getByText('45m')).toBeDefined()
    expect(screen.getByText('60m')).toBeDefined()
  })

  it('should show Start button with Play icon when not running', () => {
    render(<TimerWidget />)

    // Expand
    fireEvent.click(screen.getByRole('button', { name: /start timer/i }))

    // The Start button should exist in the expanded panel
    const startBtns = screen.getAllByRole('button')
    const startBtn = startBtns.find((b) => b.textContent?.includes('Start'))
    expect(startBtn).toBeDefined()
  })

  it('should call timer.start() when Start button is clicked', () => {
    render(<TimerWidget />)

    // Expand
    fireEvent.click(screen.getByRole('button', { name: /start timer/i }))

    // Click start
    const startBtns = screen.getAllByRole('button')
    const startBtn = startBtns.find((b) => b.textContent?.includes('Start'))
    if (startBtn) fireEvent.click(startBtn)

    expect(mockTimer.start).toHaveBeenCalledTimes(1)
  })

  it('should show Stop button when running', () => {
    mockTimer.isRunning = true
    mockTimer.startedAt = Date.now() - 60000
    mockTimer.elapsedSeconds = 60

    render(<TimerWidget />)

    const stopBtns = screen.getAllByRole('button')
    const stopBtn = stopBtns.find((b) => b.textContent?.includes('Stop'))
    expect(stopBtn).toBeDefined()
  })

  it('should call timer.stop() when Stop button is clicked', () => {
    mockTimer.isRunning = true
    mockTimer.startedAt = Date.now() - 60000
    mockTimer.elapsedSeconds = 60

    render(<TimerWidget />)

    const stopBtns = screen.getAllByRole('button')
    const stopBtn = stopBtns.find((b) => b.textContent?.includes('Stop'))
    if (stopBtn) fireEvent.click(stopBtn)

    expect(mockTimer.stop).toHaveBeenCalledTimes(1)
  })

  it('should show elapsed time when running', () => {
    mockTimer.isRunning = true
    mockTimer.startedAt = Date.now() - 125000
    mockTimer.elapsedSeconds = 125

    render(<TimerWidget />)

    // 125s = 2m 05s
    expect(screen.getByText('2m 05s')).toBeDefined()
  })

  it('should show "Timer Running" header when running', () => {
    mockTimer.isRunning = true
    mockTimer.startedAt = Date.now()
    mockTimer.elapsedSeconds = 0

    render(<TimerWidget />)

    expect(screen.getByText('Timer Running')).toBeDefined()
  })

  it('should NOT show timebox presets when running', () => {
    mockTimer.isRunning = true
    mockTimer.startedAt = Date.now()
    mockTimer.elapsedSeconds = 30

    render(<TimerWidget />)

    // Timebox selector only shows when not running
    expect(screen.queryByText('Off')).toBeNull()
    expect(screen.queryByText('25m')).toBeNull()
  })

  it('should show timebox progress bar when running with timebox set', () => {
    mockTimer.isRunning = true
    mockTimer.startedAt = Date.now() - 750000
    mockTimer.elapsedSeconds = 750
    mockTimer.timeboxSeconds = 1500

    const { container } = render(<TimerWidget />)

    // Should display the target icon for timebox
    expect(screen.getAllByTestId('icon-target').length).toBeGreaterThan(0)

    // Should show remaining time (1500 - 750 = 750s = 12m 30s)
    // Both elapsed and remaining show the same value; use getAllByText
    const matches = screen.getAllByText('12m 30s')
    expect(matches.length).toBeGreaterThanOrEqual(1)

    // Verify the progress bar width is 50%
    const progressBar = container.querySelector('[style*="width: 50%"]')
    expect(progressBar).not.toBeNull()
  })
})

describe('formatElapsed', () => {
  // We cannot directly import formatElapsed since it is not exported.
  // We test it indirectly through the component.

  it('should format seconds only (< 60s)', () => {
    mockTimer.isRunning = true
    mockTimer.startedAt = Date.now() - 45000
    mockTimer.elapsedSeconds = 45

    render(<TimerWidget />)
    expect(screen.getByText('45s')).toBeDefined()
  })

  it('should format minutes and seconds', () => {
    mockTimer.isRunning = true
    mockTimer.startedAt = Date.now()
    mockTimer.elapsedSeconds = 185

    render(<TimerWidget />)
    // 185s = 3m 05s
    expect(screen.getByText('3m 05s')).toBeDefined()
  })

  it('should format hours and minutes', () => {
    mockTimer.isRunning = true
    mockTimer.startedAt = Date.now()
    mockTimer.elapsedSeconds = 3661

    render(<TimerWidget />)
    // 3661s = 1h 01m
    expect(screen.getByText('1h 01m')).toBeDefined()
  })

  it('should show 0s for zero seconds', () => {
    mockTimer.isRunning = true
    mockTimer.startedAt = Date.now()
    mockTimer.elapsedSeconds = 0

    render(<TimerWidget />)
    expect(screen.getByText('0s')).toBeDefined()
  })

  it('should pad single-digit seconds with leading zero', () => {
    mockTimer.isRunning = true
    mockTimer.startedAt = Date.now()
    mockTimer.elapsedSeconds = 63

    render(<TimerWidget />)
    // 63s = 1m 03s
    expect(screen.getByText('1m 03s')).toBeDefined()
  })

  it('should pad single-digit minutes with leading zero in hours display', () => {
    mockTimer.isRunning = true
    mockTimer.startedAt = Date.now()
    mockTimer.elapsedSeconds = 3720

    render(<TimerWidget />)
    // 3720s = 1h 02m
    expect(screen.getByText('1h 02m')).toBeDefined()
  })
})
