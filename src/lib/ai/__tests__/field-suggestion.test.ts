import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock Anthropic SDK ─────────────────────────────────────────────────────────

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}))

vi.mock('fs', () => ({
  readFileSync: vi.fn().mockReturnValue('Suggest fields. Return JSON.'),
}))

import {
  suggestFields,
  type SuggestionContext,
  type FieldSuggestionResult,
} from '../field-suggestion'

// ─── Helpers ────────────────────────────────────────────────────────────────────

function mockClaudeResponse(json: Record<string, unknown>) {
  mockCreate.mockResolvedValueOnce({
    content: [{ type: 'text', text: JSON.stringify(json) }],
    usage: { input_tokens: 200, output_tokens: 300 },
  })
}

function mockClaudeResponseText(text: string) {
  mockCreate.mockResolvedValueOnce({
    content: [{ type: 'text', text }],
    usage: { input_tokens: 200, output_tokens: 300 },
  })
}

const baseContext: SuggestionContext = {
  description: 'Set up a client block for financial services with compliance fields',
  blockType: {
    name: 'Client',
    slug: 'client',
    existingFields: [
      { name: 'jurisdiction', type: 'select', group: 'compliance' },
    ],
    existingGroups: [
      { id: 'compliance', label: 'Compliance' },
    ],
  },
  availableBlockTypes: [
    { name: 'Deal', slug: 'deal' },
    { name: 'Contact', slug: 'contact' },
  ],
}

const validResponse: Record<string, unknown> = {
  suggested_fields: [
    {
      name: 'abn',
      type: 'text',
      label: 'ABN',
      description: 'Australian Business Number',
      required: true,
      group: 'compliance',
    },
    {
      name: 'annual_revenue',
      type: 'currency',
      label: 'Annual Revenue',
      description: 'Annual revenue in AUD',
      required: false,
      group: 'financial',
    },
    {
      name: 'risk_rating',
      type: 'select',
      label: 'Risk Rating',
      description: 'Client risk classification',
      required: true,
      group: 'compliance',
    },
  ],
  suggested_groups: [
    { id: 'financial', label: 'Financial Details', order: 2 },
  ],
  suggested_relationships: [
    {
      field_name: 'primary_contact',
      target_block_type: 'contact',
      description: 'Link to primary contact person',
    },
  ],
  reasoning: 'Financial services clients need compliance and financial tracking fields.',
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('suggestFields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns suggested fields from Claude response', async () => {
    mockClaudeResponse(validResponse)
    const result = await suggestFields(baseContext)

    expect(result.suggested_fields).toHaveLength(3)
    expect(result.suggested_fields[0]).toEqual({
      name: 'abn',
      type: 'text',
      label: 'ABN',
      description: 'Australian Business Number',
      required: true,
      group: 'compliance',
    })
    expect(result.suggested_groups).toHaveLength(1)
    expect(result.suggested_groups[0].id).toBe('financial')
    expect(result.suggested_relationships).toHaveLength(1)
    expect(result.suggested_relationships[0].target_block_type).toBe('contact')
    expect(result.reasoning).toContain('Financial services')
  })

  it('includes org context in the prompt', async () => {
    mockClaudeResponse(validResponse)
    await suggestFields(baseContext)

    const callArgs = mockCreate.mock.calls[0][0]
    const userMsg = callArgs.messages[0].content as string
    expect(userMsg).toContain('financial services')
    expect(userMsg).toContain('Client')
    expect(userMsg).toContain('jurisdiction')
    expect(userMsg).toContain('Deal')
    expect(userMsg).toContain('Contact')
  })

  it('handles markdown code fences in response', async () => {
    mockClaudeResponseText('```json\n' + JSON.stringify(validResponse) + '\n```')
    const result = await suggestFields(baseContext)
    expect(result.suggested_fields).toHaveLength(3)
  })

  it('filters out fields with invalid types', async () => {
    mockClaudeResponse({
      ...validResponse,
      suggested_fields: [
        ...validResponse.suggested_fields as unknown[],
        { name: 'bad_field', type: 'invalid_type', label: 'Bad', description: '', required: false, group: 'general' },
      ],
    })
    const result = await suggestFields(baseContext)
    expect(result.suggested_fields).toHaveLength(3) // invalid_type filtered out
    expect(result.suggested_fields.every((f) => ['text', 'currency', 'select'].includes(f.type))).toBe(true)
  })

  it('sanitizes field names to snake_case', async () => {
    mockClaudeResponse({
      ...validResponse,
      suggested_fields: [
        { name: 'My Field Name!', type: 'text', label: 'Test', description: '', required: false, group: 'general' },
      ],
    })
    const result = await suggestFields(baseContext)
    expect(result.suggested_fields[0].name).toBe('my_field_name_')
  })

  it('returns empty result on API failure', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Rate limited'))
    const result = await suggestFields(baseContext)
    expect(result.suggested_fields).toHaveLength(0)
    expect(result.suggested_groups).toHaveLength(0)
    expect(result.suggested_relationships).toHaveLength(0)
    expect(result.reasoning).toContain('manually')
  })

  it('returns empty result on unparseable response', async () => {
    mockClaudeResponseText('This is not JSON at all.')
    const result = await suggestFields(baseContext)
    expect(result.suggested_fields).toHaveLength(0)
  })

  it('handles response with missing optional arrays', async () => {
    mockClaudeResponse({
      suggested_fields: [
        { name: 'test', type: 'text', label: 'Test', description: 'A test field', required: false, group: 'general' },
      ],
      reasoning: 'Minimal suggestion',
    })
    const result = await suggestFields(baseContext)
    expect(result.suggested_fields).toHaveLength(1)
    expect(result.suggested_groups).toHaveLength(0)
    expect(result.suggested_relationships).toHaveLength(0)
  })

  it('defaults group to general when not specified', async () => {
    mockClaudeResponse({
      suggested_fields: [
        { name: 'test', type: 'text', label: 'Test', description: '' },
      ],
      reasoning: 'Test',
    })
    const result = await suggestFields(baseContext)
    expect(result.suggested_fields[0].group).toBe('general')
  })
})
