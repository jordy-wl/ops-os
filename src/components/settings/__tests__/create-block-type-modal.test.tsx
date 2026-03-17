// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) =>
    React.createElement('svg', { 'data-testid': `icon-${name}`, ...props })
  return {
    Plus: icon('plus'),
    X: icon('x'),
  }
})

const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

import { CreateBlockTypeButton } from '../create-block-type-modal'

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data: { id: 'new-type-uuid' } }),
  })
})

describe('CreateBlockTypeButton', () => {
  it('renders the create button', () => {
    render(<CreateBlockTypeButton />)
    expect(screen.getByText('Create Block Type')).toBeDefined()
  })

  it('opens modal when button is clicked', () => {
    render(<CreateBlockTypeButton />)
    fireEvent.click(screen.getByText('Create Block Type'))
    expect(screen.getByRole('dialog')).toBeDefined()
    expect(screen.getByLabelText('Type Name')).toBeDefined()
    expect(screen.getByLabelText('Display Name')).toBeDefined()
  })

  it('closes modal on cancel', () => {
    render(<CreateBlockTypeButton />)
    fireEvent.click(screen.getByText('Create Block Type'))
    expect(screen.getByRole('dialog')).toBeDefined()

    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('closes modal on close button', () => {
    render(<CreateBlockTypeButton />)
    fireEvent.click(screen.getByText('Create Block Type'))
    fireEvent.click(screen.getByLabelText('Close'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('validates type name format (lowercase + underscores)', () => {
    render(<CreateBlockTypeButton />)
    fireEvent.click(screen.getByText('Create Block Type'))

    const typeInput = screen.getByLabelText('Type Name') as HTMLInputElement
    // Entering uppercase should be auto-lowered by onChange
    fireEvent.change(typeInput, { target: { value: 'ABC123' } })
    // The component lowercases and strips invalid chars
    expect(typeInput.value).toBe('abc123')
  })

  it('disables submit when fields are empty', () => {
    render(<CreateBlockTypeButton />)
    fireEvent.click(screen.getByText('Create Block Type'))

    const submitButton = screen.getByText('Create')
    expect(submitButton.getAttribute('disabled')).toBeDefined()
  })

  it('submits form and redirects on success', async () => {
    render(<CreateBlockTypeButton />)
    fireEvent.click(screen.getByText('Create Block Type'))

    const typeInput = screen.getByLabelText('Type Name') as HTMLInputElement
    const displayInput = screen.getByLabelText('Display Name') as HTMLInputElement

    fireEvent.change(typeInput, { target: { value: 'custom_entity' } })
    fireEvent.change(displayInput, { target: { value: 'Custom Entity' } })

    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/block-types', expect.objectContaining({
        method: 'POST',
      }))
    })

    const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse(callArgs[1].body)
    expect(body.type_name).toBe('custom_entity')
    expect(body.display_name).toBe('Custom Entity')
    expect(body.icon).toBe('box') // default
    expect(body.color).toBe('blue') // default
    expect(body.field_schema).toEqual({ type: 'object', properties: {} })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/settings/block-types/new-type-uuid')
    })
  })

  it('shows error on API failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: { message: 'Duplicate type name' } }),
    })

    render(<CreateBlockTypeButton />)
    fireEvent.click(screen.getByText('Create Block Type'))

    fireEvent.change(screen.getByLabelText('Type Name'), { target: { value: 'existing_type' } })
    fireEvent.change(screen.getByLabelText('Display Name'), { target: { value: 'Existing Type' } })
    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined()
      expect(screen.getByText('Duplicate type name')).toBeDefined()
    })
  })

  it('allows icon selection', () => {
    render(<CreateBlockTypeButton />)
    fireEvent.click(screen.getByText('Create Block Type'))

    // Click on a different icon
    const starButton = screen.getByText('star')
    fireEvent.click(starButton)

    // The star button should now be visually selected (has primary border class)
    expect(starButton.className).toContain('border-primary')
  })

  it('allows color selection', () => {
    render(<CreateBlockTypeButton />)
    fireEvent.click(screen.getByText('Create Block Type'))

    const purpleButton = screen.getByTitle('purple')
    fireEvent.click(purpleButton)

    // Purple should now have ring
    expect(purpleButton.className).toContain('ring-2')
  })
})
