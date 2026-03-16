/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VersionHistory } from '../version-history'

const mockVersions = [
  {
    id: 'doc-3',
    title: 'Client Report',
    version: 3,
    format: 'html',
    ai_generated: true,
    created_by: 'user-1',
    created_at: '2026-03-12T14:00:00Z',
  },
  {
    id: 'doc-2',
    title: 'Client Report',
    version: 2,
    format: 'html',
    ai_generated: false,
    created_by: 'user-1',
    created_at: '2026-03-10T10:00:00Z',
  },
  {
    id: 'doc-1',
    title: 'Client Report',
    version: 1,
    format: 'pdf',
    ai_generated: true,
    created_by: 'user-1',
    created_at: '2026-03-08T09:00:00Z',
  },
]

describe('VersionHistory', () => {
  it('renders all versions', () => {
    const onSelect = vi.fn()
    render(
      <VersionHistory
        versions={mockVersions}
        currentVersionId="doc-3"
        onSelect={onSelect}
      />
    )
    expect(screen.getByText('v3')).toBeDefined()
    expect(screen.getByText('v2')).toBeDefined()
    expect(screen.getByText('v1')).toBeDefined()
  })

  it('shows AI badge on AI-generated versions', () => {
    const onSelect = vi.fn()
    render(
      <VersionHistory
        versions={mockVersions}
        currentVersionId="doc-3"
        onSelect={onSelect}
      />
    )
    const aiBadges = screen.getAllByText('(AI)')
    expect(aiBadges.length).toBe(2)
  })

  it('shows format label', () => {
    const onSelect = vi.fn()
    render(
      <VersionHistory
        versions={mockVersions}
        currentVersionId="doc-3"
        onSelect={onSelect}
      />
    )
    // Format is rendered as "HTML · time" in a single text node
    expect(screen.getAllByText(/HTML/).length).toBe(2)
    expect(screen.getByText(/PDF/)).toBeDefined()
  })

  it('disables button for current version', () => {
    const onSelect = vi.fn()
    render(
      <VersionHistory
        versions={mockVersions}
        currentVersionId="doc-3"
        onSelect={onSelect}
      />
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons[0].getAttribute('disabled')).not.toBeNull()
    expect(buttons[1].getAttribute('disabled')).toBeNull()
    expect(buttons[2].getAttribute('disabled')).toBeNull()
  })

  it('calls onSelect with correct ID when clicked', () => {
    const onSelect = vi.fn()
    render(
      <VersionHistory
        versions={mockVersions}
        currentVersionId="doc-3"
        onSelect={onSelect}
      />
    )
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[1])
    expect(onSelect).toHaveBeenCalledWith('doc-2')
  })

  it('shows empty message when no versions', () => {
    const onSelect = vi.fn()
    render(
      <VersionHistory
        versions={[]}
        currentVersionId=""
        onSelect={onSelect}
      />
    )
    expect(screen.getByText('No version history available.')).toBeDefined()
  })
})
