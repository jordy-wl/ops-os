import { describe, it, expect } from 'vitest'
import {
  FIELD_TYPES,
  FIELD_TYPE_DEFINITIONS,
  isValidFieldType,
  getFieldTypeDefinition,
  inferFieldType,
  type FieldType,
} from '../field-types'

describe('FIELD_TYPES constant', () => {
  it('has 12 field types', () => {
    expect(FIELD_TYPES).toHaveLength(12)
  })

  it('includes all expected types', () => {
    const expected = [
      'text', 'number', 'email', 'date', 'select', 'multi-select',
      'boolean', 'url', 'phone', 'currency', 'relation', 'rich-text',
    ]
    expect([...FIELD_TYPES]).toEqual(expected)
  })
})

describe('FIELD_TYPE_DEFINITIONS', () => {
  it('has a definition for every field type', () => {
    for (const type of FIELD_TYPES) {
      expect(FIELD_TYPE_DEFINITIONS[type]).toBeDefined()
      expect(FIELD_TYPE_DEFINITIONS[type].type).toBe(type)
    }
  })

  it('every definition has label, icon, jsonSchemaType, and defaultSchema', () => {
    for (const type of FIELD_TYPES) {
      const def = FIELD_TYPE_DEFINITIONS[type]
      expect(def.label).toBeTruthy()
      expect(def.icon).toBeTruthy()
      expect(def.jsonSchemaType).toBeTruthy()
      expect(def.defaultSchema).toBeDefined()
      expect(def.defaultSchema.type).toBe(def.jsonSchemaType)
    }
  })

  it('every defaultSchema has x-field-type matching the type key', () => {
    for (const type of FIELD_TYPES) {
      const def = FIELD_TYPE_DEFINITIONS[type]
      expect(def.defaultSchema['x-field-type']).toBe(type)
    }
  })

  it('email has format: email', () => {
    expect(FIELD_TYPE_DEFINITIONS.email.defaultSchema.format).toBe('email')
  })

  it('date has format: date', () => {
    expect(FIELD_TYPE_DEFINITIONS.date.defaultSchema.format).toBe('date')
  })

  it('url has format: uri', () => {
    expect(FIELD_TYPE_DEFINITIONS.url.defaultSchema.format).toBe('uri')
  })

  it('currency has minimum: 0 and x-currency-code: AUD', () => {
    const schema = FIELD_TYPE_DEFINITIONS.currency.defaultSchema
    expect(schema.minimum).toBe(0)
    expect(schema['x-currency-code']).toBe('AUD')
  })

  it('relation has x-relation-target', () => {
    expect(FIELD_TYPE_DEFINITIONS.relation.defaultSchema['x-relation-target']).toBe('')
  })

  it('select has empty enum array', () => {
    expect(FIELD_TYPE_DEFINITIONS.select.defaultSchema.enum).toEqual([])
  })

  it('multi-select has array type with items.enum', () => {
    const schema = FIELD_TYPE_DEFINITIONS['multi-select'].defaultSchema
    expect(schema.type).toBe('array')
    expect((schema.items as Record<string, unknown>).type).toBe('string')
    expect((schema.items as Record<string, unknown>).enum).toEqual([])
  })
})

describe('isValidFieldType', () => {
  it('returns true for all valid field types', () => {
    for (const type of FIELD_TYPES) {
      expect(isValidFieldType(type)).toBe(true)
    }
  })

  it('returns false for invalid types', () => {
    expect(isValidFieldType('invalid')).toBe(false)
    expect(isValidFieldType('')).toBe(false)
    expect(isValidFieldType('TEXT')).toBe(false)
  })
})

describe('getFieldTypeDefinition', () => {
  it('returns definition for valid type', () => {
    const def = getFieldTypeDefinition('text')
    expect(def).toBeDefined()
    expect(def!.type).toBe('text')
  })

  it('returns undefined for invalid type', () => {
    expect(getFieldTypeDefinition('invalid')).toBeUndefined()
  })
})

describe('inferFieldType', () => {
  it('uses x-field-type when present', () => {
    expect(inferFieldType({ type: 'string', 'x-field-type': 'rich-text' })).toBe('rich-text')
    expect(inferFieldType({ type: 'string', 'x-field-type': 'phone' })).toBe('phone')
  })

  it('infers boolean', () => {
    expect(inferFieldType({ type: 'boolean' })).toBe('boolean')
  })

  it('infers number', () => {
    expect(inferFieldType({ type: 'number' })).toBe('number')
    expect(inferFieldType({ type: 'integer' })).toBe('number')
  })

  it('infers currency from x-currency-code', () => {
    expect(inferFieldType({ type: 'number', 'x-currency-code': 'AUD' })).toBe('currency')
  })

  it('infers array as multi-select', () => {
    expect(inferFieldType({ type: 'array' })).toBe('multi-select')
  })

  it('infers email from format', () => {
    expect(inferFieldType({ type: 'string', format: 'email' })).toBe('email')
  })

  it('infers url from format', () => {
    expect(inferFieldType({ type: 'string', format: 'uri' })).toBe('url')
  })

  it('infers date from format', () => {
    expect(inferFieldType({ type: 'string', format: 'date' })).toBe('date')
  })

  it('infers select from enum', () => {
    expect(inferFieldType({ type: 'string', enum: ['a', 'b'] })).toBe('select')
  })

  it('defaults to text for plain string', () => {
    expect(inferFieldType({ type: 'string' })).toBe('text')
  })

  it('defaults to text for unknown type', () => {
    expect(inferFieldType({ type: 'object' })).toBe('text')
    expect(inferFieldType({})).toBe('text')
  })
})
