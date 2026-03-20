import { describe, it, expect } from 'vitest'
import {
  FIELD_TYPES,
  FIELD_TYPE_DEFINITIONS,
  isValidFieldType,
  getFieldTypeDefinition,
  inferFieldType,
  getFieldGroups,
  groupFieldsByCategory,
  DEFAULT_FIELD_GROUP,
  type FieldType,
  type FieldGroup,
} from '../field-types'

describe('FIELD_TYPES constant', () => {
  it('has 13 field types', () => {
    expect(FIELD_TYPES).toHaveLength(13)
  })

  it('includes all expected types', () => {
    const expected = [
      'text', 'number', 'email', 'date', 'select', 'multi-select',
      'boolean', 'url', 'phone', 'currency', 'relation', 'multi-relation', 'rich-text',
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

// ─── Field Groups (Sprint 5) ─────────────────────────────────────────────────

describe('DEFAULT_FIELD_GROUP', () => {
  it('has id "general", label "General", and high order', () => {
    expect(DEFAULT_FIELD_GROUP.id).toBe('general')
    expect(DEFAULT_FIELD_GROUP.label).toBe('General')
    expect(DEFAULT_FIELD_GROUP.order).toBe(999)
  })
})

describe('getFieldGroups', () => {
  it('returns [General] when schema has no x-field-groups', () => {
    const schema = {
      type: 'object',
      properties: { name: { type: 'string' } },
    }
    const groups = getFieldGroups(schema)
    expect(groups).toHaveLength(1)
    expect(groups[0]).toEqual(DEFAULT_FIELD_GROUP)
  })

  it('returns [General] when x-field-groups is empty array', () => {
    const schema = {
      type: 'object',
      properties: { name: { type: 'string' } },
      'x-field-groups': [],
    }
    const groups = getFieldGroups(schema)
    expect(groups).toHaveLength(1)
    expect(groups[0].id).toBe('general')
  })

  it('returns defined groups sorted by order', () => {
    const schema = {
      type: 'object',
      properties: {
        email: { type: 'string', 'x-field-group': 'contact' },
        revenue: { type: 'number', 'x-field-group': 'financial' },
      },
      'x-field-groups': [
        { id: 'financial', label: 'Financial', order: 2 },
        { id: 'contact', label: 'Contact Info', order: 1 },
      ],
    }
    const groups = getFieldGroups(schema)
    expect(groups[0].id).toBe('contact')
    expect(groups[1].id).toBe('financial')
  })

  it('adds General group when ungrouped fields exist', () => {
    const schema = {
      type: 'object',
      properties: {
        email: { type: 'string', 'x-field-group': 'contact' },
        notes: { type: 'string' }, // no group assigned
      },
      'x-field-groups': [
        { id: 'contact', label: 'Contact Info', order: 1 },
      ],
    }
    const groups = getFieldGroups(schema)
    expect(groups.some((g) => g.id === 'general')).toBe(true)
    expect(groups.some((g) => g.id === 'contact')).toBe(true)
  })

  it('does not add duplicate General when already defined', () => {
    const schema = {
      type: 'object',
      properties: {
        notes: { type: 'string' },
      },
      'x-field-groups': [
        { id: 'general', label: 'General', order: 999 },
      ],
    }
    const groups = getFieldGroups(schema)
    const generalGroups = groups.filter((g) => g.id === 'general')
    expect(generalGroups).toHaveLength(1)
  })

  it('skips invalid entries in x-field-groups', () => {
    const schema = {
      type: 'object',
      properties: { name: { type: 'string', 'x-field-group': 'valid' } },
      'x-field-groups': [
        { id: 'valid', label: 'Valid', order: 1 },
        { id: 123, label: 'Bad ID' }, // invalid: id not string
        null, // invalid: null
        { label: 'No ID', order: 2 }, // invalid: missing id
      ],
    }
    const groups = getFieldGroups(schema)
    expect(groups.some((g) => g.id === 'valid')).toBe(true)
    // only valid group + general fallback (since some invalid entries exist)
    expect(groups.length).toBeLessThanOrEqual(2)
  })

  it('defaults order to 999 when not specified', () => {
    const schema = {
      type: 'object',
      properties: { name: { type: 'string', 'x-field-group': 'misc' } },
      'x-field-groups': [
        { id: 'misc', label: 'Miscellaneous' },
      ],
    }
    const groups = getFieldGroups(schema)
    const misc = groups.find((g) => g.id === 'misc')
    expect(misc?.order).toBe(999)
  })

  it('adds General when field group does not match any defined group', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string', 'x-field-group': 'nonexistent' },
      },
      'x-field-groups': [
        { id: 'contact', label: 'Contact', order: 1 },
      ],
    }
    const groups = getFieldGroups(schema)
    expect(groups.some((g) => g.id === 'general')).toBe(true)
  })
})

describe('groupFieldsByCategory', () => {
  it('groups fields by x-field-group', () => {
    const schema = {
      type: 'object',
      properties: {
        email: { type: 'string', 'x-field-group': 'contact', 'x-display-order': 1 },
        phone: { type: 'string', 'x-field-group': 'contact', 'x-display-order': 2 },
        revenue: { type: 'number', 'x-field-group': 'financial', 'x-display-order': 1 },
      },
      'x-field-groups': [
        { id: 'contact', label: 'Contact Info', order: 1 },
        { id: 'financial', label: 'Financial', order: 2 },
      ],
    }

    const grouped = groupFieldsByCategory(schema)

    expect(grouped.get('contact')).toHaveLength(2)
    expect(grouped.get('contact')![0][0]).toBe('email')
    expect(grouped.get('contact')![1][0]).toBe('phone')
    expect(grouped.get('financial')).toHaveLength(1)
    expect(grouped.get('financial')![0][0]).toBe('revenue')
  })

  it('puts ungrouped fields in general', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string', 'x-field-group': 'contact' },
      },
      'x-field-groups': [
        { id: 'contact', label: 'Contact', order: 1 },
      ],
    }

    const grouped = groupFieldsByCategory(schema)

    expect(grouped.get('general')).toHaveLength(1)
    expect(grouped.get('general')![0][0]).toBe('name')
    expect(grouped.get('contact')).toHaveLength(1)
  })

  it('sorts fields within groups by x-display-order', () => {
    const schema = {
      type: 'object',
      properties: {
        phone: { type: 'string', 'x-field-group': 'contact', 'x-display-order': 3 },
        email: { type: 'string', 'x-field-group': 'contact', 'x-display-order': 1 },
        name: { type: 'string', 'x-field-group': 'contact', 'x-display-order': 2 },
      },
      'x-field-groups': [
        { id: 'contact', label: 'Contact', order: 1 },
      ],
    }

    const grouped = groupFieldsByCategory(schema)
    const contact = grouped.get('contact')!

    expect(contact[0][0]).toBe('email')  // order 1
    expect(contact[1][0]).toBe('name')   // order 2
    expect(contact[2][0]).toBe('phone')  // order 3
  })

  it('falls back to alphabetical sort when display-order is equal', () => {
    const schema = {
      type: 'object',
      properties: {
        zebra: { type: 'string', 'x-field-group': 'general' },
        alpha: { type: 'string', 'x-field-group': 'general' },
      },
      'x-field-groups': [
        { id: 'general', label: 'General', order: 1 },
      ],
    }

    const grouped = groupFieldsByCategory(schema)
    const general = grouped.get('general')!

    expect(general[0][0]).toBe('alpha')
    expect(general[1][0]).toBe('zebra')
  })

  it('handles schema with no properties', () => {
    const schema = {
      type: 'object',
    }

    const grouped = groupFieldsByCategory(schema)
    expect(grouped.get('general')).toEqual([])
  })

  it('routes invalid group assignment to general', () => {
    const schema = {
      type: 'object',
      properties: {
        orphan: { type: 'string', 'x-field-group': 'nonexistent' },
      },
      'x-field-groups': [
        { id: 'contact', label: 'Contact', order: 1 },
      ],
    }

    const grouped = groupFieldsByCategory(schema)
    expect(grouped.get('general')!).toHaveLength(1)
    expect(grouped.get('general')![0][0]).toBe('orphan')
  })
})
