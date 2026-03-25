// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('lucide-react', () => {
  const icon = (name: string) => {
    const Icon = (props: Record<string, unknown>) =>
      React.createElement('svg', { 'data-testid': `icon-${name}`, ...props })
    Icon.displayName = name
    return Icon
  }
  return {
    Plus: icon('plus'),
    X: icon('x'),
    GripVertical: icon('grip'),
    Sparkles: icon('sparkles'),
    Loader2: icon('loader'),
  }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

import { SwotEditor } from '../swot-editor'

const INITIAL_DATA = {
  strengths: ['Strong brand', 'Good team'],
  weaknesses: ['Limited market'],
  opportunities: ['New region'],
  threats: ['Competitor growth'],
  analysis_date: '2026-03-15',
  ai_generated: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data: {} }),
  })
})

describe('SwotEditor', () => {
  it('renders all four quadrants', () => {
    render(
      <SwotEditor blockId="block-1" blockName="Test SWOT" initialData={INITIAL_DATA} />
    )

    expect(screen.getByText('Strengths')).toBeDefined()
    expect(screen.getByText('Weaknesses')).toBeDefined()
    expect(screen.getByText('Opportunities')).toBeDefined()
    expect(screen.getByText('Threats')).toBeDefined()
  })

  it('renders existing items in each quadrant', () => {
    render(
      <SwotEditor blockId="block-1" blockName="Test SWOT" initialData={INITIAL_DATA} />
    )

    // Check that items are rendered as input values
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[]
    const values = inputs.map((i) => i.value)
    expect(values).toContain('Strong brand')
    expect(values).toContain('Good team')
    expect(values).toContain('Limited market')
    expect(values).toContain('New region')
    expect(values).toContain('Competitor growth')
  })

  it('adds new item to a quadrant', () => {
    render(
      <SwotEditor blockId="block-1" blockName="Test SWOT" initialData={INITIAL_DATA} />
    )

    const addInput = screen.getByLabelText('Add Strengths item')
    fireEvent.change(addInput, { target: { value: 'New strength' } })
    fireEvent.keyDown(addInput, { key: 'Enter' })

    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[]
    const values = inputs.map((i) => i.value)
    expect(values).toContain('New strength')
  })

  it('removes an item from a quadrant', () => {
    render(
      <SwotEditor blockId="block-1" blockName="Test SWOT" initialData={INITIAL_DATA} />
    )

    // Find all remove buttons, click the first one (removes "Strong brand")
    const removeButtons = screen.getAllByLabelText('Remove Strengths item')
    expect(removeButtons.length).toBe(2) // 2 strengths

    fireEvent.click(removeButtons[0])

    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[]
    const values = inputs.map((i) => i.value)
    expect(values).not.toContain('Strong brand')
    expect(values).toContain('Good team')
  })

  it('edits an existing item inline', () => {
    render(
      <SwotEditor blockId="block-1" blockName="Test SWOT" initialData={INITIAL_DATA} />
    )

    const strengthInput = screen.getByDisplayValue('Strong brand') as HTMLInputElement
    fireEvent.change(strengthInput, { target: { value: 'Very strong brand' } })
    expect(strengthInput.value).toBe('Very strong brand')
  })

  it('saves data via PATCH /api/blocks/:id', async () => {
    render(
      <SwotEditor blockId="block-1" blockName="Test SWOT" initialData={INITIAL_DATA} />
    )

    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/blocks/block-1', expect.objectContaining({
        method: 'PATCH',
      }))
    })

    const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse(callArgs[1].body)
    expect(body.metadata.strengths).toEqual(['Strong brand', 'Good team'])
    expect(body.metadata.weaknesses).toEqual(['Limited market'])
    expect(body.metadata.opportunities).toEqual(['New region'])
    expect(body.metadata.threats).toEqual(['Competitor growth'])
  })

  it('shows error on save failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: { message: 'Save failed' } }),
    })

    render(
      <SwotEditor blockId="block-1" blockName="Test SWOT" initialData={INITIAL_DATA} />
    )

    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined()
      expect(screen.getByText('Save failed')).toBeDefined()
    })
  })

  it('calls onAiGenerate and populates quadrants', async () => {
    const mockGenerate = vi.fn().mockResolvedValue({
      strengths: ['AI strength 1'],
      weaknesses: ['AI weakness 1'],
      opportunities: ['AI opportunity 1'],
      threats: ['AI threat 1'],
    })

    render(
      <SwotEditor blockId="block-1" blockName="Test SWOT" initialData={{}} onAiGenerate={mockGenerate} />
    )

    fireEvent.click(screen.getByText('AI Generate'))

    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalledOnce()
      const inputs = screen.getAllByRole('textbox') as HTMLInputElement[]
      const values = inputs.map((i) => i.value)
      expect(values).toContain('AI strength 1')
      expect(values).toContain('AI weakness 1')
    })
  })

  it('handles empty initial data gracefully', () => {
    render(
      <SwotEditor blockId="block-1" blockName="Test SWOT" initialData={{}} />
    )

    expect(screen.getByText('Strengths')).toBeDefined()
    expect(screen.getByText('Weaknesses')).toBeDefined()
    // No items rendered — only add inputs + headers exist
    const lists = screen.getAllByRole('list')
    lists.forEach((list) => {
      expect(list.children.length).toBe(0)
    })
  })

  it('does not show AI Generate button without onAiGenerate prop', () => {
    render(
      <SwotEditor blockId="block-1" blockName="Test SWOT" initialData={INITIAL_DATA} />
    )

    expect(screen.queryByText('AI Generate')).toBeNull()
  })
})
