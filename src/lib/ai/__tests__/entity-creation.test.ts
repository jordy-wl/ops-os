import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Supabase mock chain (hoisted so vi.mock factory can reference it) --------
const mocks = vi.hoisted(() => ({
  mockChain: {
    from: vi.fn(),
  },
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: () => mocks.mockChain,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { getBlockTypeSchemas, validateFieldsAgainstSchema } from '../entity-creation'

// ---- Fixtures ----------------------------------------------------------------

// Reusable field_schema for validation tests
const FIELD_SCHEMA: Record<string, unknown> = {
  properties: {
    name: { type: 'string' },
    age: { type: 'number' },
    active: { type: 'boolean' },
    tags: { type: 'array' },
    status: { type: 'string', enum: ['draft', 'active', 'archived'] },
    created_at: { type: 'string', 'x-is-system': true },
  },
}

// ---- validateFieldsAgainstSchema (pure function, no mocks needed) -------------

describe('validateFieldsAgainstSchema', () => {
  it('accepts valid string fields', () => {
    const { validFields, errors } = validateFieldsAgainstSchema(
      { name: 'Thornfield Capital' },
      FIELD_SCHEMA
    )
    expect(validFields).toEqual({ name: 'Thornfield Capital' })
    expect(errors).toHaveLength(0)
  })

  it('accepts valid number fields', () => {
    const { validFields, errors } = validateFieldsAgainstSchema(
      { age: 42 },
      FIELD_SCHEMA
    )
    expect(validFields).toEqual({ age: 42 })
    expect(errors).toHaveLength(0)
  })

  it('accepts valid boolean fields', () => {
    const { validFields, errors } = validateFieldsAgainstSchema(
      { active: true },
      FIELD_SCHEMA
    )
    expect(validFields).toEqual({ active: true })
    expect(errors).toHaveLength(0)
  })

  it('accepts valid array fields', () => {
    const { validFields, errors } = validateFieldsAgainstSchema(
      { tags: ['vip', 'asx-listed'] },
      FIELD_SCHEMA
    )
    expect(validFields).toEqual({ tags: ['vip', 'asx-listed'] })
    expect(errors).toHaveLength(0)
  })

  it('rejects unknown fields not in schema', () => {
    const { validFields, errors } = validateFieldsAgainstSchema(
      { unknown_field: 'value' },
      FIELD_SCHEMA
    )
    expect(validFields).toEqual({})
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('Unknown field "unknown_field"')
  })

  it('rejects system fields (x-is-system: true)', () => {
    const { validFields, errors } = validateFieldsAgainstSchema(
      { created_at: '2026-01-01' },
      FIELD_SCHEMA
    )
    expect(validFields).toEqual({})
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('system field')
    expect(errors[0]).toContain('created_at')
  })

  it('rejects wrong type — string field given number', () => {
    const { validFields, errors } = validateFieldsAgainstSchema(
      { name: 123 },
      FIELD_SCHEMA
    )
    expect(validFields).toEqual({})
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('"name"')
    expect(errors[0]).toContain('string')
  })

  it('rejects wrong type — number field given string', () => {
    const { validFields, errors } = validateFieldsAgainstSchema(
      { age: 'twenty' },
      FIELD_SCHEMA
    )
    expect(validFields).toEqual({})
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('"age"')
    expect(errors[0]).toContain('number')
  })

  it('rejects wrong type — boolean field given string', () => {
    const { validFields, errors } = validateFieldsAgainstSchema(
      { active: 'yes' },
      FIELD_SCHEMA
    )
    expect(validFields).toEqual({})
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('"active"')
    expect(errors[0]).toContain('boolean')
  })

  it('rejects wrong type — array field given object', () => {
    const { validFields, errors } = validateFieldsAgainstSchema(
      { tags: { key: 'value' } },
      FIELD_SCHEMA
    )
    expect(validFields).toEqual({})
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('"tags"')
    expect(errors[0]).toContain('array')
  })

  it('rejects enum field with invalid value', () => {
    const { validFields, errors } = validateFieldsAgainstSchema(
      { status: 'deleted' },
      FIELD_SCHEMA
    )
    expect(validFields).toEqual({})
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('must be one of')
    expect(errors[0]).toContain('draft')
    expect(errors[0]).toContain('active')
    expect(errors[0]).toContain('archived')
  })

  it('accepts enum field with valid value', () => {
    const { validFields, errors } = validateFieldsAgainstSchema(
      { status: 'active' },
      FIELD_SCHEMA
    )
    expect(validFields).toEqual({ status: 'active' })
    expect(errors).toHaveLength(0)
  })

  it('returns both valid fields and errors for mixed input', () => {
    const { validFields, errors } = validateFieldsAgainstSchema(
      { name: 'Acme Corp', age: 'not-a-number', bogus: true },
      FIELD_SCHEMA
    )
    expect(validFields).toEqual({ name: 'Acme Corp' })
    expect(errors).toHaveLength(2)
    expect(errors.some((e) => e.includes('"age"'))).toBe(true)
    expect(errors.some((e) => e.includes('Unknown field "bogus"'))).toBe(true)
  })

  it('handles empty fields object', () => {
    const { validFields, errors } = validateFieldsAgainstSchema({}, FIELD_SCHEMA)
    expect(validFields).toEqual({})
    expect(errors).toHaveLength(0)
  })

  it('handles empty schema (no properties)', () => {
    const { validFields, errors } = validateFieldsAgainstSchema(
      { name: 'test' },
      {}
    )
    expect(validFields).toEqual({})
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('Unknown field "name"')
  })
})

// ---- getBlockTypeSchemas (requires Supabase mock) ----------------------------

describe('getBlockTypeSchemas', () => {
  // Build a chainable mock: .from().select().eq().order() -> { data, error }
  function setupChain(result: { data: unknown; error: unknown }) {
    const orderFn = vi.fn().mockResolvedValue(result)
    const eqFn = vi.fn().mockReturnValue({ order: orderFn })
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn })
    mocks.mockChain.from.mockReturnValue({ select: selectFn })
    return { selectFn, eqFn, orderFn }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns mapped schemas on success', async () => {
    const rawRows = [
      { type_name: 'client', display_name: 'Client', field_schema: { properties: { name: { type: 'string' } } } },
      { type_name: 'deal', display_name: 'Deal', field_schema: { properties: { value: { type: 'number' } } } },
    ]
    const { eqFn } = setupChain({ data: rawRows, error: null })

    const result = await getBlockTypeSchemas('org-123')

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      type: 'client',
      label: 'Client',
      field_schema: { properties: { name: { type: 'string' } } },
    })
    expect(result[1]).toEqual({
      type: 'deal',
      label: 'Deal',
      field_schema: { properties: { value: { type: 'number' } } },
    })

    // Verify it queried the right table and filtered by org_id
    expect(mocks.mockChain.from).toHaveBeenCalledWith('block_type_definitions')
    expect(eqFn).toHaveBeenCalledWith('org_id', 'org-123')
  })

  it('returns empty array on error', async () => {
    setupChain({ data: null, error: { code: 'PGRST301', message: 'relation not found' } })

    const result = await getBlockTypeSchemas('org-123')

    expect(result).toEqual([])
  })

  it('returns empty array when data is null', async () => {
    setupChain({ data: null, error: null })

    const result = await getBlockTypeSchemas('org-123')

    expect(result).toEqual([])
  })

  it('defaults field_schema to empty object when null in DB row', async () => {
    setupChain({
      data: [{ type_name: 'note', display_name: 'Note', field_schema: null }],
      error: null,
    })

    const result = await getBlockTypeSchemas('org-123')

    expect(result).toHaveLength(1)
    expect(result[0].field_schema).toEqual({})
  })
})
