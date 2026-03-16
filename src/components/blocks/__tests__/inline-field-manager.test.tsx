/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { InlineFieldManager } from '../inline-field-manager'
import type { FieldGroup } from '@/lib/block-types/field-types'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}))

// Mock fetch globally
beforeEach(() => {
  vi.restoreAllMocks()
  global.fetch = vi.fn() as unknown as typeof fetch
})

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const BASIC_SCHEMA = {
  type: 'object' as const,
  properties: {
    company_name: {
      type: 'string',
      'x-field-type': 'text',
      'x-display-order': 1,
      description: 'Company Name',
    },
    email: {
      type: 'string',
      format: 'email',
      'x-field-type': 'email',
      'x-display-order': 2,
      description: 'Contact Email',
    },
    revenue: {
      type: 'number',
      'x-field-type': 'number',
      'x-display-order': 3,
      'x-is-system': true,
      description: 'Revenue',
    },
  } as Record<string, Record<string, unknown>>,
  required: ['company_name'] as string[],
}

const GROUPED_SCHEMA = {
  type: 'object' as const,
  properties: {
    company_name: {
      type: 'string',
      'x-field-type': 'text',
      'x-display-order': 1,
      'x-field-group': 'basic',
      description: 'Company Name',
    },
    industry: {
      type: 'string',
      'x-field-type': 'text',
      'x-display-order': 2,
      'x-field-group': 'basic',
      description: 'Industry',
    },
    contact_email: {
      type: 'string',
      format: 'email',
      'x-field-type': 'email',
      'x-display-order': 3,
      'x-field-group': 'contact',
      description: 'Contact Email',
    },
  } as Record<string, Record<string, unknown>>,
  required: ['company_name'] as string[],
  'x-field-groups': [
    { id: 'basic', label: 'Basic Info', order: 1 },
    { id: 'contact', label: 'Contact', order: 2 },
  ] as FieldGroup[],
}

const EMPTY_SCHEMA = {
  type: 'object' as const,
  properties: {} as Record<string, Record<string, unknown>>,
  required: [] as string[],
}

const DEFAULT_PROPS = {
  blockTypeId: 'type-uuid-123',
  blockTypeName: 'Client',
  blockTypeSlug: 'client',
  onSchemaUpdate: vi.fn(),
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InlineFieldManager', () => {
  describe('rendering', () => {
    it('renders the section heading and field count', () => {
      render(
        <InlineFieldManager {...DEFAULT_PROPS} schema={BASIC_SCHEMA} />
      )
      expect(screen.getByText('Configure Fields')).toBeTruthy()
      expect(screen.getByText(/3 fields across/)).toBeTruthy()
    })

    it('renders all field names in the list', () => {
      render(
        <InlineFieldManager {...DEFAULT_PROPS} schema={BASIC_SCHEMA} />
      )
      expect(screen.getByText('company_name')).toBeTruthy()
      expect(screen.getByText('email')).toBeTruthy()
      expect(screen.getByText('revenue')).toBeTruthy()
    })

    it('shows required indicator for required fields', () => {
      render(
        <InlineFieldManager {...DEFAULT_PROPS} schema={BASIC_SCHEMA} />
      )
      // company_name is required — should have a * indicator
      const requiredIndicator = screen.getByLabelText('Required field')
      expect(requiredIndicator).toBeTruthy()
    })

    it('shows system field lock icon for system fields', () => {
      render(
        <InlineFieldManager {...DEFAULT_PROPS} schema={BASIC_SCHEMA} />
      )
      expect(screen.getByLabelText('System field (locked)')).toBeTruthy()
    })

    it('does not show delete button for system fields', () => {
      render(
        <InlineFieldManager {...DEFAULT_PROPS} schema={BASIC_SCHEMA} />
      )
      // revenue is system — no delete button for it
      expect(screen.queryByLabelText('Delete field revenue')).toBeNull()
      // company_name is not system — has a delete button
      expect(screen.getByLabelText('Delete field company_name')).toBeTruthy()
    })

    it('renders empty state when schema has no fields', () => {
      render(
        <InlineFieldManager {...DEFAULT_PROPS} schema={EMPTY_SCHEMA} />
      )
      expect(screen.getByText('No fields configured')).toBeTruthy()
      expect(screen.getByText(/Add your first field/)).toBeTruthy()
    })

    it('renders grouped field list when schema has x-field-groups', () => {
      render(
        <InlineFieldManager {...DEFAULT_PROPS} schema={GROUPED_SCHEMA} />
      )
      expect(screen.getByText('Basic Info')).toBeTruthy()
      expect(screen.getByText('Contact')).toBeTruthy()
    })

    it('displays field type labels for each field', () => {
      render(
        <InlineFieldManager {...DEFAULT_PROPS} schema={BASIC_SCHEMA} />
      )
      // Text, Email, Number types
      expect(screen.getByText('Text')).toBeTruthy()
      expect(screen.getByText('Email')).toBeTruthy()
      expect(screen.getByText('Number')).toBeTruthy()
    })
  })

  describe('action buttons', () => {
    it('renders Add Field, Manage Groups, and AI Suggest buttons', () => {
      render(
        <InlineFieldManager {...DEFAULT_PROPS} schema={BASIC_SCHEMA} />
      )
      expect(screen.getByLabelText('Add a new field')).toBeTruthy()
      expect(screen.getByLabelText('Manage field groups')).toBeTruthy()
      expect(screen.getByLabelText('AI field suggestions')).toBeTruthy()
    })

    it('shows Add Field form on button click', () => {
      render(
        <InlineFieldManager {...DEFAULT_PROPS} schema={BASIC_SCHEMA} />
      )
      fireEvent.click(screen.getByLabelText('Add a new field'))
      expect(screen.getByText('New Field')).toBeTruthy()
      expect(screen.getByLabelText('Field Name (snake_case)')).toBeTruthy()
    })

    it('shows Group Manager panel on button click', () => {
      render(
        <InlineFieldManager {...DEFAULT_PROPS} schema={BASIC_SCHEMA} />
      )
      fireEvent.click(screen.getByLabelText('Manage field groups'))
      expect(screen.getByText('Field Groups')).toBeTruthy()
    })

    it('shows AI Suggest panel on button click', () => {
      render(
        <InlineFieldManager {...DEFAULT_PROPS} schema={BASIC_SCHEMA} />
      )
      fireEvent.click(screen.getByLabelText('AI field suggestions'))
      expect(screen.getByText('AI Field Suggestions')).toBeTruthy()
      expect(screen.getByLabelText('Describe what fields you need')).toBeTruthy()
    })

    it('closes other panels when opening a new one', () => {
      render(
        <InlineFieldManager {...DEFAULT_PROPS} schema={BASIC_SCHEMA} />
      )
      // Open Add Field
      fireEvent.click(screen.getByLabelText('Add a new field'))
      expect(screen.getByText('New Field')).toBeTruthy()

      // Open AI Suggest — Add Field should close
      fireEvent.click(screen.getByLabelText('AI field suggestions'))
      expect(screen.queryByText('New Field')).toBeNull()
      expect(screen.getByText('AI Field Suggestions')).toBeTruthy()
    })
  })

  describe('add field validation', () => {
    it('disables Add Field button when field name is empty', () => {
      render(
        <InlineFieldManager {...DEFAULT_PROPS} schema={BASIC_SCHEMA} />
      )
      fireEvent.click(screen.getByLabelText('Add a new field'))

      // The form-level Add Field button should be disabled when name is empty
      const addButtons = screen.getAllByRole('button', { name: /Add Field/i })
      const formAddBtn = addButtons[addButtons.length - 1] as HTMLButtonElement
      expect(formAddBtn.disabled).toBe(true)
    })

    it('shows error when field name is not snake_case', () => {
      render(
        <InlineFieldManager {...DEFAULT_PROPS} schema={BASIC_SCHEMA} />
      )
      fireEvent.click(screen.getByLabelText('Add a new field'))

      const nameInput = screen.getByLabelText('Field Name (snake_case)')
      fireEvent.change(nameInput, { target: { value: 'BadName' } })

      const addButtons = screen.getAllByRole('button', { name: /Add Field/i })
      const formAddBtn = addButtons[addButtons.length - 1]
      fireEvent.click(formAddBtn)

      expect(screen.getByRole('alert').textContent).toContain(
        'lowercase snake_case'
      )
    })

    it('shows error when field name already exists', () => {
      render(
        <InlineFieldManager {...DEFAULT_PROPS} schema={BASIC_SCHEMA} />
      )
      fireEvent.click(screen.getByLabelText('Add a new field'))

      const nameInput = screen.getByLabelText('Field Name (snake_case)')
      fireEvent.change(nameInput, { target: { value: 'company_name' } })

      const addButtons = screen.getAllByRole('button', { name: /Add Field/i })
      const formAddBtn = addButtons[addButtons.length - 1]
      fireEvent.click(formAddBtn)

      expect(screen.getByRole('alert').textContent).toContain(
        'already exists'
      )
    })
  })

  describe('confirmation dialog', () => {
    it('shows confirmation before adding a new field', () => {
      render(
        <InlineFieldManager {...DEFAULT_PROPS} schema={BASIC_SCHEMA} />
      )
      fireEvent.click(screen.getByLabelText('Add a new field'))

      const nameInput = screen.getByLabelText('Field Name (snake_case)')
      fireEvent.change(nameInput, { target: { value: 'new_field' } })

      const addButtons = screen.getAllByRole('button', { name: /Add Field/i })
      const formAddBtn = addButtons[addButtons.length - 1]
      fireEvent.click(formAddBtn)

      // Confirmation dialog should appear with the block type name
      expect(
        screen.getByText(/changes the field configuration for all Client blocks/)
      ).toBeTruthy()
    })

    it('confirmation can be cancelled', () => {
      render(
        <InlineFieldManager {...DEFAULT_PROPS} schema={BASIC_SCHEMA} />
      )
      fireEvent.click(screen.getByLabelText('Add a new field'))

      const nameInput = screen.getByLabelText('Field Name (snake_case)')
      fireEvent.change(nameInput, { target: { value: 'new_field' } })

      const addButtons = screen.getAllByRole('button', { name: /Add Field/i })
      const formAddBtn = addButtons[addButtons.length - 1]
      fireEvent.click(formAddBtn)

      // Cancel confirmation
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      // Confirmation should be gone, fetch should not have been called
      expect(
        screen.queryByText(/changes the field configuration/)
      ).toBeNull()
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('confirmation proceeds with API call', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: {} }),
      })

      render(
        <InlineFieldManager {...DEFAULT_PROPS} schema={BASIC_SCHEMA} />
      )
      fireEvent.click(screen.getByLabelText('Add a new field'))

      const nameInput = screen.getByLabelText('Field Name (snake_case)')
      fireEvent.change(nameInput, { target: { value: 'new_field' } })

      const addButtons = screen.getAllByRole('button', { name: /Add Field/i })
      const formAddBtn = addButtons[addButtons.length - 1]
      fireEvent.click(formAddBtn)

      // Confirm
      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/block-types/type-uuid-123/fields',
          expect.objectContaining({ method: 'POST' })
        )
      })
    })
  })

  describe('group collapse', () => {
    it('collapses and expands group sections', () => {
      render(
        <InlineFieldManager {...DEFAULT_PROPS} schema={GROUPED_SCHEMA} />
      )

      // Find the Basic Info group toggle
      const basicToggle = screen.getByRole('button', { name: /Basic Info/ })
      expect(basicToggle.getAttribute('aria-expanded')).toBe('true')

      // Click to collapse
      fireEvent.click(basicToggle)
      expect(basicToggle.getAttribute('aria-expanded')).toBe('false')

      // Click again to expand
      fireEvent.click(basicToggle)
      expect(basicToggle.getAttribute('aria-expanded')).toBe('true')
    })
  })

  describe('AI suggest panel', () => {
    it('disables Suggest button when description is empty', () => {
      render(
        <InlineFieldManager {...DEFAULT_PROPS} schema={BASIC_SCHEMA} />
      )
      fireEvent.click(screen.getByLabelText('AI field suggestions'))

      const suggestBtn = screen.getByRole('button', { name: 'Suggest' }) as HTMLButtonElement
      expect(suggestBtn.disabled).toBe(true)
    })

    it('calls suggest-fields API with correct payload', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              suggested_fields: [
                {
                  name: 'phone',
                  type: 'phone',
                  label: 'Phone',
                  description: 'Contact phone',
                  required: false,
                  group: 'general',
                },
              ],
              suggested_groups: [],
              suggested_relationships: [],
              reasoning: 'Test reasoning',
            },
          }),
      })

      render(
        <InlineFieldManager {...DEFAULT_PROPS} schema={BASIC_SCHEMA} />
      )
      fireEvent.click(screen.getByLabelText('AI field suggestions'))

      const descInput = screen.getByLabelText('Describe what fields you need')
      fireEvent.change(descInput, {
        target: { value: 'I need a phone number field' },
      })

      fireEvent.click(screen.getByRole('button', { name: 'Suggest' }))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/block-types/suggest-fields',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              description: 'I need a phone number field',
              block_type_slug: 'client',
            }),
          })
        )
      })

      // Suggestions should render
      await waitFor(() => {
        expect(screen.getByText('phone')).toBeTruthy()
        expect(screen.getByText('Test reasoning')).toBeTruthy()
      })
    })

    it('marks existing fields as non-selectable in suggestions', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              suggested_fields: [
                {
                  name: 'company_name',
                  type: 'text',
                  label: 'Company Name',
                  description: 'Already exists',
                  required: false,
                  group: 'general',
                },
                {
                  name: 'new_field',
                  type: 'text',
                  label: 'New Field',
                  description: 'A new field',
                  required: false,
                  group: 'general',
                },
              ],
              suggested_groups: [],
              suggested_relationships: [],
              reasoning: '',
            },
          }),
      })

      render(
        <InlineFieldManager {...DEFAULT_PROPS} schema={BASIC_SCHEMA} />
      )
      fireEvent.click(screen.getByLabelText('AI field suggestions'))

      fireEvent.change(
        screen.getByLabelText('Describe what fields you need'),
        { target: { value: 'test description text' } }
      )
      fireEvent.click(screen.getByRole('button', { name: 'Suggest' }))

      await waitFor(() => {
        expect(screen.getByText('(exists)')).toBeTruthy()
      })

      // The existing field checkbox should be disabled
      const existingCheckbox = screen.getByLabelText('Accept field company_name') as HTMLInputElement
      expect(existingCheckbox.disabled).toBe(true)

      // The new field checkbox should be enabled
      const newCheckbox = screen.getByLabelText('Accept field new_field') as HTMLInputElement
      expect(newCheckbox.disabled).toBe(false)
    })
  })

  describe('delete field', () => {
    it('shows confirmation dialog before deleting', () => {
      render(
        <InlineFieldManager {...DEFAULT_PROPS} schema={BASIC_SCHEMA} />
      )

      fireEvent.click(screen.getByLabelText('Delete field company_name'))

      expect(
        screen.getByText(/changes the field configuration for all Client blocks/)
      ).toBeTruthy()
    })
  })
})
