// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  MessageSquare: (props: Record<string, unknown>) => React.createElement('svg', { 'data-testid': 'icon-message-square', ...props }),
  ListChecks: (props: Record<string, unknown>) => React.createElement('svg', { 'data-testid': 'icon-list-checks', ...props }),
  Zap: (props: Record<string, unknown>) => React.createElement('svg', { 'data-testid': 'icon-zap', ...props }),
}))

import { ModeSelector } from '../mode-selector'

describe('ModeSelector', () => {
  it('renders three mode buttons', () => {
    render(<ModeSelector mode="discuss" onModeChange={vi.fn()} />)
    expect(screen.getByText('Discuss')).toBeDefined()
    expect(screen.getByText('Plan')).toBeDefined()
    expect(screen.getByText('Execute')).toBeDefined()
  })

  it('marks active mode as pressed', () => {
    render(<ModeSelector mode="plan" onModeChange={vi.fn()} />)
    const planBtn = screen.getByText('Plan').closest('button')!
    expect(planBtn.getAttribute('aria-pressed')).toBe('true')

    const discussBtn = screen.getByText('Discuss').closest('button')!
    expect(discussBtn.getAttribute('aria-pressed')).toBe('false')
  })

  it('calls onModeChange when clicking a mode', () => {
    const onChange = vi.fn()
    render(<ModeSelector mode="discuss" onModeChange={onChange} />)

    fireEvent.click(screen.getByText('Execute'))
    expect(onChange).toHaveBeenCalledWith('execute')
  })

  it('applies active styling to selected mode', () => {
    render(<ModeSelector mode="execute" onModeChange={vi.fn()} />)
    const executeBtn = screen.getByText('Execute').closest('button')!
    expect(executeBtn.className).toContain('bg-white')
    expect(executeBtn.className).toContain('shadow-sm')
  })
})
