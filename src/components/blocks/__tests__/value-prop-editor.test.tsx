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
    Sparkles: icon('sparkles'),
    Loader2: icon('loader'),
  }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

import { ValuePropEditor } from '../value-prop-editor'

const INITIAL_DATA = {
  target_audience: 'Mid-tier financial institutions',
  unique_value: 'Automated compliance monitoring',
  competitive_advantage: 'Purpose-built for APAC',
  positioning_statement: 'For banks who need compliance',
  proof_points: ['99.7% uptime', '25+ institutions'],
  status: 'active',
}

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data: {} }),
  })
})

describe('ValuePropEditor', () => {
  it('renders all fields with initial data', () => {
    render(
      <ValuePropEditor blockId="block-1" blockName="Test VP" initialData={INITIAL_DATA} />
    )

    expect((screen.getByLabelText('Target Audience') as HTMLInputElement).value).toBe('Mid-tier financial institutions')
    expect((screen.getByLabelText('Unique Value') as HTMLTextAreaElement).value).toBe('Automated compliance monitoring')
    expect((screen.getByLabelText('Competitive Advantage') as HTMLTextAreaElement).value).toBe('Purpose-built for APAC')
    expect((screen.getByLabelText('Positioning Statement') as HTMLTextAreaElement).value).toBe('For banks who need compliance')
  })

  it('renders proof points', () => {
    render(
      <ValuePropEditor blockId="block-1" blockName="Test VP" initialData={INITIAL_DATA} />
    )

    expect((screen.getByDisplayValue('99.7% uptime') as HTMLInputElement)).toBeDefined()
    expect((screen.getByDisplayValue('25+ institutions') as HTMLInputElement)).toBeDefined()
  })

  it('renders status dropdown with correct value', () => {
    render(
      <ValuePropEditor blockId="block-1" blockName="Test VP" initialData={INITIAL_DATA} />
    )

    const select = screen.getByLabelText('Status') as HTMLSelectElement
    expect(select.value).toBe('active')
  })

  it('updates fields on change', () => {
    render(
      <ValuePropEditor blockId="block-1" blockName="Test VP" initialData={INITIAL_DATA} />
    )

    const audienceInput = screen.getByLabelText('Target Audience') as HTMLInputElement
    fireEvent.change(audienceInput, { target: { value: 'Enterprise banks' } })
    expect(audienceInput.value).toBe('Enterprise banks')
  })

  it('adds a new proof point', () => {
    render(
      <ValuePropEditor blockId="block-1" blockName="Test VP" initialData={INITIAL_DATA} />
    )

    const addInput = screen.getByLabelText('New proof point')
    fireEvent.change(addInput, { target: { value: 'SOC 2 certified' } })
    fireEvent.keyDown(addInput, { key: 'Enter' })

    expect(screen.getByDisplayValue('SOC 2 certified')).toBeDefined()
  })

  it('removes a proof point', () => {
    render(
      <ValuePropEditor blockId="block-1" blockName="Test VP" initialData={INITIAL_DATA} />
    )

    const removeButtons = screen.getAllByLabelText('Remove proof point')
    expect(removeButtons.length).toBe(2)

    fireEvent.click(removeButtons[0])

    expect(screen.queryByDisplayValue('99.7% uptime')).toBeNull()
    expect(screen.getByDisplayValue('25+ institutions')).toBeDefined()
  })

  it('saves data via PATCH /api/blocks/:id', async () => {
    render(
      <ValuePropEditor blockId="block-1" blockName="Test VP" initialData={INITIAL_DATA} />
    )

    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/blocks/block-1', expect.objectContaining({
        method: 'PATCH',
      }))
    })

    const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse(callArgs[1].body)
    expect(body.metadata.target_audience).toBe('Mid-tier financial institutions')
    expect(body.metadata.proof_points).toEqual(['99.7% uptime', '25+ institutions'])
    expect(body.metadata.status).toBe('active')
  })

  it('shows error on save failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: { message: 'Update failed' } }),
    })

    render(
      <ValuePropEditor blockId="block-1" blockName="Test VP" initialData={INITIAL_DATA} />
    )

    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined()
      expect(screen.getByText('Update failed')).toBeDefined()
    })
  })

  it('calls onAiSuggest and populates fields', async () => {
    const mockSuggest = vi.fn().mockResolvedValue({
      target_audience: 'AI suggested audience',
      unique_value: 'AI suggested value',
      competitive_advantage: 'AI suggested advantage',
      proof_points: ['AI proof 1'],
    })

    render(
      <ValuePropEditor blockId="block-1" blockName="Test VP" initialData={{}} onAiSuggest={mockSuggest} />
    )

    fireEvent.click(screen.getByText('AI Suggest'))

    await waitFor(() => {
      expect(mockSuggest).toHaveBeenCalledOnce()
      expect((screen.getByLabelText('Target Audience') as HTMLInputElement).value).toBe('AI suggested audience')
      expect((screen.getByLabelText('Unique Value') as HTMLTextAreaElement).value).toBe('AI suggested value')
    })
  })

  it('handles empty initial data gracefully', () => {
    render(
      <ValuePropEditor blockId="block-1" blockName="Test VP" initialData={{}} />
    )

    expect((screen.getByLabelText('Target Audience') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Unique Value') as HTMLTextAreaElement).value).toBe('')
    expect((screen.getByLabelText('Status') as HTMLSelectElement).value).toBe('draft')
  })

  it('does not show AI Suggest button without onAiSuggest prop', () => {
    render(
      <ValuePropEditor blockId="block-1" blockName="Test VP" initialData={INITIAL_DATA} />
    )

    expect(screen.queryByText('AI Suggest')).toBeNull()
  })

  it('edits an existing proof point', () => {
    render(
      <ValuePropEditor blockId="block-1" blockName="Test VP" initialData={INITIAL_DATA} />
    )

    const input = screen.getByDisplayValue('99.7% uptime') as HTMLInputElement
    fireEvent.change(input, { target: { value: '99.9% uptime' } })
    expect(input.value).toBe('99.9% uptime')
  })
})
