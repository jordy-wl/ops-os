import { describe, it, expect } from 'vitest'
import {
  buildFieldSchema,
  addFieldToSchema,
  removeFieldFromSchema,
  updateFieldInSchema,
  extractFieldsFromSchema,
  type FieldDefinition,
  type BuiltSchema,
} from '../field-schema-builder'
import { isValidJsonSchema } from '@/lib/validation/json-schema'

describe('buildFieldSchema', () => {
  it('builds a valid JSON Schema from field definitions', () => {
    const fields: FieldDefinition[] = [
      { name: 'name', fieldType: 'text', description: 'Full name' },
      { name: 'age', fieldType: 'number', description: 'Age' },
    ]

    const schema = buildFieldSchema(fields)

    expect(schema.type).toBe('object')
    expect(Object.keys(schema.properties)).toEqual(['name', 'age'])
    expect(schema.properties.name.type).toBe('string')
    expect(schema.properties.name['x-field-type']).toBe('text')
    expect(schema.properties.age.type).toBe('number')
  })

  it('produces a schema that passes AJV validation', () => {
    const fields: FieldDefinition[] = [
      { name: 'email', fieldType: 'email', required: true },
      { name: 'website', fieldType: 'url' },
      { name: 'price', fieldType: 'currency', config: { 'x-currency-code': 'USD' } },
    ]

    const schema = buildFieldSchema(fields)
    expect(isValidJsonSchema(schema)).toBe(true)
  })

  it('handles required fields', () => {
    const fields: FieldDefinition[] = [
      { name: 'name', fieldType: 'text', required: true },
      { name: 'notes', fieldType: 'text', required: false },
    ]

    const schema = buildFieldSchema(fields)
    expect(schema.required).toEqual(['name'])
  })

  it('omits required array when no fields are required', () => {
    const fields: FieldDefinition[] = [
      { name: 'notes', fieldType: 'text' },
    ]

    const schema = buildFieldSchema(fields)
    expect(schema.required).toBeUndefined()
  })

  it('assigns x-display-order automatically', () => {
    const fields: FieldDefinition[] = [
      { name: 'a', fieldType: 'text' },
      { name: 'b', fieldType: 'number' },
      { name: 'c', fieldType: 'email' },
    ]

    const schema = buildFieldSchema(fields)
    expect(schema.properties.a['x-display-order']).toBe(0)
    expect(schema.properties.b['x-display-order']).toBe(1)
    expect(schema.properties.c['x-display-order']).toBe(2)
  })

  it('uses explicit displayOrder when provided', () => {
    const fields: FieldDefinition[] = [
      { name: 'a', fieldType: 'text', displayOrder: 10 },
      { name: 'b', fieldType: 'number', displayOrder: 5 },
    ]

    const schema = buildFieldSchema(fields)
    expect(schema.properties.a['x-display-order']).toBe(10)
    expect(schema.properties.b['x-display-order']).toBe(5)
  })

  it('sets x-placeholder when provided', () => {
    const fields: FieldDefinition[] = [
      { name: 'name', fieldType: 'text', placeholder: 'Enter name...' },
    ]

    const schema = buildFieldSchema(fields)
    expect(schema.properties.name['x-placeholder']).toBe('Enter name...')
  })

  it('sets x-is-system when isSystem is true', () => {
    const fields: FieldDefinition[] = [
      { name: 'status', fieldType: 'select', isSystem: true },
    ]

    const schema = buildFieldSchema(fields)
    expect(schema.properties.status['x-is-system']).toBe(true)
  })

  it('merges config into the property', () => {
    const fields: FieldDefinition[] = [
      {
        name: 'stage',
        fieldType: 'select',
        config: { enum: ['open', 'closed'] },
      },
    ]

    const schema = buildFieldSchema(fields)
    expect(schema.properties.stage.enum).toEqual(['open', 'closed'])
  })

  it('handles relation field with target', () => {
    const fields: FieldDefinition[] = [
      {
        name: 'client',
        fieldType: 'relation',
        config: { 'x-relation-target': 'client' },
      },
    ]

    const schema = buildFieldSchema(fields)
    expect(schema.properties.client['x-relation-target']).toBe('client')
    expect(schema.properties.client['x-field-type']).toBe('relation')
  })

  it('handles multi-select with items enum', () => {
    const fields: FieldDefinition[] = [
      {
        name: 'tags',
        fieldType: 'multi-select',
        config: { items: { type: 'string', enum: ['a', 'b', 'c'] } },
      },
    ]

    const schema = buildFieldSchema(fields)
    expect(schema.properties.tags.type).toBe('array')
    expect((schema.properties.tags.items as Record<string, unknown>).enum).toEqual(['a', 'b', 'c'])
  })

  it('returns empty properties for empty input', () => {
    const schema = buildFieldSchema([])
    expect(schema.type).toBe('object')
    expect(Object.keys(schema.properties)).toHaveLength(0)
  })

  it('skips fields with invalid field type', () => {
    const fields = [
      { name: 'valid', fieldType: 'text' as const },
      { name: 'invalid', fieldType: 'nonexistent' as never },
    ]

    const schema = buildFieldSchema(fields)
    expect(Object.keys(schema.properties)).toEqual(['valid'])
  })
})

describe('addFieldToSchema', () => {
  const base: BuiltSchema = {
    type: 'object',
    properties: {
      name: { type: 'string', 'x-field-type': 'text', 'x-display-order': 0, description: 'Name' },
    },
    required: ['name'],
  }

  it('adds a field with next display order', () => {
    const result = addFieldToSchema(base, { name: 'age', fieldType: 'number' })
    expect(result.properties.age).toBeDefined()
    expect(result.properties.age['x-display-order']).toBe(1)
  })

  it('preserves existing fields', () => {
    const result = addFieldToSchema(base, { name: 'age', fieldType: 'number' })
    expect(result.properties.name).toBeDefined()
  })

  it('adds to required array when field is required', () => {
    const result = addFieldToSchema(base, { name: 'email', fieldType: 'email', required: true })
    expect(result.required).toContain('email')
    expect(result.required).toContain('name')
  })

  it('does not add duplicate to required', () => {
    const result = addFieldToSchema(base, { name: 'name', fieldType: 'text', required: true })
    const nameCount = result.required!.filter((r) => r === 'name').length
    expect(nameCount).toBe(1)
  })
})

describe('removeFieldFromSchema', () => {
  const base: BuiltSchema = {
    type: 'object',
    properties: {
      name: { type: 'string', 'x-field-type': 'text', 'x-display-order': 0, description: 'Name' },
      age: { type: 'number', 'x-field-type': 'number', 'x-display-order': 1, description: 'Age' },
    },
    required: ['name'],
  }

  it('removes the field', () => {
    const result = removeFieldFromSchema(base, 'age')
    expect(result.properties.age).toBeUndefined()
    expect(result.properties.name).toBeDefined()
  })

  it('removes from required array', () => {
    const result = removeFieldFromSchema(base, 'name')
    expect(result.required).toBeUndefined()
  })

  it('throws for nonexistent field', () => {
    expect(() => removeFieldFromSchema(base, 'nope')).toThrow('does not exist')
  })

  it('throws for system field', () => {
    const withSystem: BuiltSchema = {
      type: 'object',
      properties: {
        status: { type: 'string', 'x-is-system': true, 'x-display-order': 0 },
      },
    }
    expect(() => removeFieldFromSchema(withSystem, 'status')).toThrow('system field')
  })
})

describe('updateFieldInSchema', () => {
  const base: BuiltSchema = {
    type: 'object',
    properties: {
      name: { type: 'string', 'x-field-type': 'text', 'x-display-order': 0, description: 'Name' },
    },
  }

  it('updates description', () => {
    const result = updateFieldInSchema(base, 'name', { description: 'Full name' })
    expect(result.properties.name.description).toBe('Full name')
  })

  it('updates placeholder', () => {
    const result = updateFieldInSchema(base, 'name', { placeholder: 'Enter...' })
    expect(result.properties.name['x-placeholder']).toBe('Enter...')
  })

  it('updates display order', () => {
    const result = updateFieldInSchema(base, 'name', { displayOrder: 5 })
    expect(result.properties.name['x-display-order']).toBe(5)
  })

  it('adds to required when setting required: true', () => {
    const result = updateFieldInSchema(base, 'name', { required: true })
    expect(result.required).toContain('name')
  })

  it('removes from required when setting required: false', () => {
    const withRequired: BuiltSchema = { ...base, required: ['name'] }
    const result = updateFieldInSchema(withRequired, 'name', { required: false })
    expect(result.required).toBeUndefined()
  })

  it('merges config', () => {
    const result = updateFieldInSchema(base, 'name', { config: { maxLength: 100 } })
    expect(result.properties.name.maxLength).toBe(100)
  })

  it('throws for nonexistent field', () => {
    expect(() => updateFieldInSchema(base, 'nope', { description: 'x' })).toThrow('does not exist')
  })

  it('throws for system field', () => {
    const withSystem: BuiltSchema = {
      type: 'object',
      properties: {
        status: { type: 'string', 'x-is-system': true, 'x-display-order': 0 },
      },
    }
    expect(() => updateFieldInSchema(withSystem, 'status', { description: 'x' })).toThrow('system field')
  })
})

describe('extractFieldsFromSchema', () => {
  it('extracts fields sorted by x-display-order', () => {
    const schema: BuiltSchema = {
      type: 'object',
      properties: {
        b: { type: 'number', 'x-field-type': 'number', 'x-display-order': 2 },
        a: { type: 'string', 'x-field-type': 'text', 'x-display-order': 0 },
        c: { type: 'string', 'x-field-type': 'email', 'x-display-order': 1 },
      },
    }

    const fields = extractFieldsFromSchema(schema)
    expect(fields.map((f) => f.name)).toEqual(['a', 'c', 'b'])
    expect(fields[0].fieldType).toBe('text')
    expect(fields[1].fieldType).toBe('email')
    expect(fields[2].fieldType).toBe('number')
  })

  it('handles empty schema', () => {
    const schema: BuiltSchema = { type: 'object', properties: {} }
    expect(extractFieldsFromSchema(schema)).toEqual([])
  })

  it('defaults to text for unknown x-field-type', () => {
    const schema: BuiltSchema = {
      type: 'object',
      properties: {
        field: { type: 'string', 'x-field-type': 'nonexistent' },
      },
    }
    const fields = extractFieldsFromSchema(schema)
    expect(fields[0].fieldType).toBe('text')
  })
})
