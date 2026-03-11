// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  MessageCircle: (props: Record<string, unknown>) => React.createElement('svg', { 'data-testid': 'icon-message-circle', ...props }),
  MessageSquare: (props: Record<string, unknown>) => React.createElement('svg', { 'data-testid': 'icon-message-square', ...props }),
  ListChecks: (props: Record<string, unknown>) => React.createElement('svg', { 'data-testid': 'icon-list-checks', ...props }),
  Zap: (props: Record<string, unknown>) => React.createElement('svg', { 'data-testid': 'icon-zap', ...props }),
  X: (props: Record<string, unknown>) => React.createElement('svg', { 'data-testid': 'icon-x', ...props }),
  Wrench: (props: Record<string, unknown>) => React.createElement('svg', { 'data-testid': 'icon-wrench', ...props }),
  Send: (props: Record<string, unknown>) => React.createElement('svg', { 'data-testid': 'icon-send', ...props }),
}))

import { ChatWidgetProvider, useChatWidget } from '../chat-widget-provider'
import { ChatWidget } from '../chat-widget'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn().mockReturnValue('/dashboard'),
}))

// Mock fetch for page context
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ data: { pageType: 'dashboard' } }),
  body: null,
})

function WidgetTestWrapper({ children }: { children: React.ReactNode }) {
  return <ChatWidgetProvider>{children}</ChatWidgetProvider>
}

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn()

describe('ChatWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders collapsed button when closed', () => {
    render(
      <WidgetTestWrapper>
        <ChatWidget />
      </WidgetTestWrapper>
    )

    expect(screen.getByLabelText('Open chat')).toBeDefined()
  })

  it('opens when collapsed button is clicked', () => {
    render(
      <WidgetTestWrapper>
        <ChatWidget />
      </WidgetTestWrapper>
    )

    fireEvent.click(screen.getByLabelText('Open chat'))
    expect(screen.getByLabelText('Close chat')).toBeDefined()
    expect(screen.getByText('Discuss')).toBeDefined()
  })

  it('closes when close button is clicked', () => {
    render(
      <WidgetTestWrapper>
        <ChatWidget />
      </WidgetTestWrapper>
    )

    // Open
    fireEvent.click(screen.getByLabelText('Open chat'))
    expect(screen.getByLabelText('Close chat')).toBeDefined()

    // Close
    fireEvent.click(screen.getByLabelText('Close chat'))
    expect(screen.getByLabelText('Open chat')).toBeDefined()
  })

  it('closes on Escape key', () => {
    render(
      <WidgetTestWrapper>
        <ChatWidget />
      </WidgetTestWrapper>
    )

    fireEvent.click(screen.getByLabelText('Open chat'))
    expect(screen.getByLabelText('Close chat')).toBeDefined()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByLabelText('Open chat')).toBeDefined()
  })

  it('shows mode-specific welcome text', () => {
    render(
      <WidgetTestWrapper>
        <ChatWidget />
      </WidgetTestWrapper>
    )

    fireEvent.click(screen.getByLabelText('Open chat'))
    expect(screen.getByText(/ask questions about your blocks/i)).toBeDefined()
  })

  it('shows plan welcome text when plan mode selected', () => {
    render(
      <WidgetTestWrapper>
        <ChatWidget />
      </WidgetTestWrapper>
    )

    fireEvent.click(screen.getByLabelText('Open chat'))
    fireEvent.click(screen.getByText('Plan'))
    expect(screen.getByText(/describe what you want to achieve/i)).toBeDefined()
  })

  it('shows execute welcome text when execute mode selected', () => {
    render(
      <WidgetTestWrapper>
        <ChatWidget />
      </WidgetTestWrapper>
    )

    fireEvent.click(screen.getByLabelText('Open chat'))
    fireEvent.click(screen.getByText('Execute'))
    expect(screen.getByText(/tell me what to do/i)).toBeDefined()
  })
})

describe('useChatWidget', () => {
  it('throws when used outside provider', () => {
    function BadComponent() {
      useChatWidget()
      return null
    }

    expect(() => render(<BadComponent />)).toThrow(/ChatWidgetProvider/)
  })
})
