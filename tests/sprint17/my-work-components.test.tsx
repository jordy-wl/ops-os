/**
 * tests/sprint17/my-work-components.test.tsx
 *
 * Unit tests for My Work UI components:
 *   - PriorityBadge: renders colored badges for urgent/high/medium/low
 *   - DeadlineCountdown: shows time-relative deadline labels
 *   - ConfidenceScore: renders color-coded percentage indicators
 *
 * Uses vitest + @testing-library/react in jsdom environment.
 */

// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock lucide-react icons with simple SVG stubs
vi.mock('lucide-react', () => {
  const icon = (name: string) =>
    function MockIcon(props: Record<string, unknown>) {
      return React.createElement('svg', { 'data-testid': `icon-${name}`, ...props })
    }
  return {
    AlertTriangle: icon('alert-triangle'),
    ArrowUp: icon('arrow-up'),
    ArrowRight: icon('arrow-right'),
    ArrowDown: icon('arrow-down'),
    Clock: icon('clock'),
  }
})

// Mock cn utility — pass-through concatenation
vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

import { PriorityBadge } from '@/components/my-work/priority-badge'
import { DeadlineCountdown } from '@/components/my-work/deadline-countdown'
import { ConfidenceScore } from '@/components/my-work/confidence-score'

// ---- PriorityBadge Tests ---------------------------------------------------

describe('PriorityBadge', () => {
  it('should render urgent with destructive color class', () => {
    const { container } = render(<PriorityBadge priority="urgent" />)
    const badge = container.querySelector('span')

    expect(badge).toBeDefined()
    expect(badge!.textContent).toContain('Urgent')
    expect(badge!.className).toContain('destructive')
    expect(badge!.title).toBe('Priority: Urgent')
  })

  it('should render high with orange color class', () => {
    const { container } = render(<PriorityBadge priority="high" />)
    const badge = container.querySelector('span')

    expect(badge).toBeDefined()
    expect(badge!.textContent).toContain('High')
    expect(badge!.className).toContain('orange')
  })

  it('should render medium with primary color class', () => {
    const { container } = render(<PriorityBadge priority="medium" />)
    const badge = container.querySelector('span')

    expect(badge).toBeDefined()
    expect(badge!.textContent).toContain('Medium')
    expect(badge!.className).toContain('primary')
  })

  it('should render low with muted color class', () => {
    const { container } = render(<PriorityBadge priority="low" />)
    const badge = container.querySelector('span')

    expect(badge).toBeDefined()
    expect(badge!.textContent).toContain('Low')
    expect(badge!.className).toContain('muted')
  })

  it('should fall back to medium config for unknown priority string', () => {
    const { container } = render(<PriorityBadge priority="critical" />)
    const badge = container.querySelector('span')

    expect(badge).toBeDefined()
    // Falls back to PRIORITY_CONFIG.medium
    expect(badge!.textContent).toContain('Medium')
    expect(badge!.className).toContain('primary')
  })

  it('should apply md size class when size prop is md', () => {
    const { container } = render(<PriorityBadge priority="high" size="md" />)
    const badge = container.querySelector('span')

    expect(badge).toBeDefined()
    expect(badge!.className).toContain('text-[11px]')
  })

  it('should apply sm size class by default', () => {
    const { container } = render(<PriorityBadge priority="high" />)
    const badge = container.querySelector('span')

    expect(badge).toBeDefined()
    expect(badge!.className).toContain('text-[10px]')
  })

  it('should render the appropriate icon for each priority', () => {
    const { rerender } = render(<PriorityBadge priority="urgent" />)
    expect(screen.getByTestId('icon-alert-triangle')).toBeDefined()

    rerender(<PriorityBadge priority="high" />)
    expect(screen.getByTestId('icon-arrow-up')).toBeDefined()

    rerender(<PriorityBadge priority="medium" />)
    expect(screen.getByTestId('icon-arrow-right')).toBeDefined()

    rerender(<PriorityBadge priority="low" />)
    expect(screen.getByTestId('icon-arrow-down')).toBeDefined()
  })
})

// ---- DeadlineCountdown Tests -----------------------------------------------

describe('DeadlineCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return null for null deadline', () => {
    const { container } = render(<DeadlineCountdown deadline={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('should show overdue label for past dates', () => {
    // Set current time to a known point
    vi.setSystemTime(new Date('2026-03-15T12:00:00Z'))

    const { container } = render(
      <DeadlineCountdown deadline="2026-03-14T06:00:00Z" />
    )
    const span = container.querySelector('span')

    expect(span).toBeDefined()
    expect(span!.textContent).toContain('overdue')
    expect(span!.className).toContain('destructive')
  })

  it('should show hours overdue for less than 24h overdue', () => {
    vi.setSystemTime(new Date('2026-03-15T15:00:00Z'))

    // 5 hours ago
    const { container } = render(
      <DeadlineCountdown deadline="2026-03-15T10:00:00Z" />
    )
    const span = container.querySelector('span')

    expect(span).toBeDefined()
    expect(span!.textContent).toContain('5h overdue')
  })

  it('should show days overdue for more than 24h overdue', () => {
    vi.setSystemTime(new Date('2026-03-17T12:00:00Z'))

    // 2 days ago
    const { container } = render(
      <DeadlineCountdown deadline="2026-03-15T10:00:00Z" />
    )
    const span = container.querySelector('span')

    expect(span).toBeDefined()
    expect(span!.textContent).toContain('d overdue')
  })

  it('should show "Xh left" with destructive style for < 4 hours remaining', () => {
    vi.setSystemTime(new Date('2026-03-15T10:00:00Z'))

    // 2 hours from now
    const { container } = render(
      <DeadlineCountdown deadline="2026-03-15T12:00:00Z" />
    )
    const span = container.querySelector('span')

    expect(span).toBeDefined()
    expect(span!.textContent).toContain('2h left')
    expect(span!.className).toContain('destructive')
  })

  it('should show "Xh left" with warning style for 4-23 hours remaining', () => {
    vi.setSystemTime(new Date('2026-03-15T02:00:00Z'))

    // 10 hours from now
    const { container } = render(
      <DeadlineCountdown deadline="2026-03-15T12:00:00Z" />
    )
    const span = container.querySelector('span')

    expect(span).toBeDefined()
    expect(span!.textContent).toContain('10h left')
    expect(span!.className).toContain('warning')
  })

  it('should show "Xd left" for more than 24 hours remaining', () => {
    vi.setSystemTime(new Date('2026-03-15T00:00:00Z'))

    // 3 days from now
    const { container } = render(
      <DeadlineCountdown deadline="2026-03-18T00:00:00Z" />
    )
    const span = container.querySelector('span')

    expect(span).toBeDefined()
    expect(span!.textContent).toContain('3d left')
    expect(span!.className).toContain('muted-foreground')
  })

  it('should render Clock icon in all states', () => {
    vi.setSystemTime(new Date('2026-03-15T12:00:00Z'))

    // Overdue
    const { rerender } = render(
      <DeadlineCountdown deadline="2026-03-14T00:00:00Z" />
    )
    expect(screen.getByTestId('icon-clock')).toBeDefined()

    // Future
    rerender(<DeadlineCountdown deadline="2026-03-20T00:00:00Z" />)
    expect(screen.getByTestId('icon-clock')).toBeDefined()
  })
})

// ---- ConfidenceScore Tests -------------------------------------------------

describe('ConfidenceScore', () => {
  it('should show green (success) color for score >= 80%', () => {
    const { container } = render(<ConfidenceScore score={0.85} />)
    const span = container.querySelector('span')

    expect(span).toBeDefined()
    expect(span!.textContent).toContain('85%')
    expect(span!.className).toContain('success')
  })

  it('should show green for exactly 80%', () => {
    const { container } = render(<ConfidenceScore score={0.80} />)
    const span = container.querySelector('span')

    expect(span).toBeDefined()
    expect(span!.textContent).toContain('80%')
    expect(span!.className).toContain('success')
  })

  it('should show warning color for score >= 50% and < 80%', () => {
    const { container } = render(<ConfidenceScore score={0.65} />)
    const span = container.querySelector('span')

    expect(span).toBeDefined()
    expect(span!.textContent).toContain('65%')
    expect(span!.className).toContain('warning')
  })

  it('should show warning for exactly 50%', () => {
    const { container } = render(<ConfidenceScore score={0.50} />)
    const span = container.querySelector('span')

    expect(span).toBeDefined()
    expect(span!.textContent).toContain('50%')
    expect(span!.className).toContain('warning')
  })

  it('should show red (destructive) color for score < 50%', () => {
    const { container } = render(<ConfidenceScore score={0.3} />)
    const span = container.querySelector('span')

    expect(span).toBeDefined()
    expect(span!.textContent).toContain('30%')
    expect(span!.className).toContain('destructive')
  })

  it('should show 0% for score of 0', () => {
    const { container } = render(<ConfidenceScore score={0} />)
    const span = container.querySelector('span')

    expect(span).toBeDefined()
    expect(span!.textContent).toContain('0%')
    expect(span!.className).toContain('destructive')
  })

  it('should show 100% for score of 1.0', () => {
    const { container } = render(<ConfidenceScore score={1.0} />)
    const span = container.querySelector('span')

    expect(span).toBeDefined()
    expect(span!.textContent).toContain('100%')
    expect(span!.className).toContain('success')
  })

  it('should include label in title when provided', () => {
    const { container } = render(
      <ConfidenceScore score={0.75} label="AI" />
    )
    const span = container.querySelector('span')

    expect(span).toBeDefined()
    expect(span!.title).toBe('AI: 75%')
  })

  it('should use default title when no label is provided', () => {
    const { container } = render(<ConfidenceScore score={0.75} />)
    const span = container.querySelector('span')

    expect(span).toBeDefined()
    expect(span!.title).toBe('Confidence: 75%')
  })

  it('should render label text with hidden-on-mobile class', () => {
    const { container } = render(
      <ConfidenceScore score={0.9} label="Routing" />
    )

    // The label text is inside a span with sm:inline class
    const innerSpan = container.querySelector('span span')
    expect(innerSpan).toBeDefined()
    expect(innerSpan!.textContent).toBe('Routing')
    expect(innerSpan!.className).toContain('sm:inline')
  })

  it('should apply custom className when provided', () => {
    const { container } = render(
      <ConfidenceScore score={0.9} className="custom-class" />
    )
    const span = container.querySelector('span')

    expect(span).toBeDefined()
    expect(span!.className).toContain('custom-class')
  })

  it('should round score to nearest integer percent', () => {
    const { container } = render(<ConfidenceScore score={0.666} />)
    const span = container.querySelector('span')

    expect(span).toBeDefined()
    expect(span!.textContent).toContain('67%')
  })
})

