import { describe, it, expect } from 'vitest'
import {
  getFieldGroups,
  groupFieldsByCategory,
  type FieldGroup,
} from '../field-types'
import { buildFieldSchema, addFieldToSchema, removeFieldFromSchema, type BuiltSchema } from '../field-schema-builder'

describe('field group utilities', () => {
  const schemaWithGroups: BuiltSchema = {
    type: 'object',
    properties: {
      email: {
        type: 'string',
        format: 'email',
        'x-field-type': 'email',
        'x-field-group': 'contact_info',
        'x-display-order': 0,
      },
      phone: {
        type: 'string',
        'x-field-type': 'phone',
        'x-field-group': 'contact_info',
        'x-display-order': 1,
      },
      revenue: {
        type: 'number',
        'x-field-type': 'currency',
        'x-field-group': 'financial',
        'x-display-order': 2,
      },
      notes: {
        type: 'string',
        'x-field-type': 'text',
        'x-display-order': 3,
      },
    },
    'x-field-groups': [
      { id: 'contact_info', label: 'Contact Information', order: 1 },
      { id: 'financial', label: 'Financial Details', order: 2 },
    ] as FieldGroup[],
  }

  describe('getFieldGroups', () => {
    it('extracts field groups from schema (includes General for ungrouped fields)', () => {
      const groups = getFieldGroups(schemaWithGroups)
      // 2 explicit groups + General (for "notes" which has no x-field-group)
      expect(groups).toHaveLength(3)
      expect(groups[0].id).toBe('contact_info')
      expect(groups[1].id).toBe('financial')
      expect(groups[2].id).toBe('general')
    })

    it('returns General fallback when no groups defined', () => {
      const simpleSchema: BuiltSchema = {
        type: 'object',
        properties: { name: { type: 'string' } },
      }
      const groups = getFieldGroups(simpleSchema)
      expect(groups).toHaveLength(1)
      expect(groups[0].id).toBe('general')
    })

    it('sorts groups by order (General appended for ungrouped fields)', () => {
      const schema: BuiltSchema = {
        ...schemaWithGroups,
        'x-field-groups': [
          { id: 'b', label: 'B', order: 2 },
          { id: 'a', label: 'A', order: 1 },
          { id: 'c', label: 'C', order: 3 },
        ],
      }
      const groups = getFieldGroups(schema)
      // a, b, c sorted by order + general appended (properties reference contact_info/financial which aren't in a/b/c)
      expect(groups.map((g) => g.id)).toEqual(['a', 'b', 'c', 'general'])
    })
  })

  describe('groupFieldsByCategory', () => {
    it('groups fields by their x-field-group', () => {
      const grouped = groupFieldsByCategory(schemaWithGroups)
      expect(grouped.get('contact_info')).toHaveLength(2)
      expect(grouped.get('financial')).toHaveLength(1)
    })

    it('puts ungrouped fields in default group', () => {
      const grouped = groupFieldsByCategory(schemaWithGroups)
      const defaultGroup = grouped.get('general')
      // notes field has no group
      expect(defaultGroup).toBeDefined()
      expect(defaultGroup!.length).toBe(1)
      expect(defaultGroup![0][0]).toBe('notes')
    })

    it('handles schema with no groups (all fields in default)', () => {
      const simpleSchema: BuiltSchema = {
        type: 'object',
        properties: {
          a: { type: 'string', 'x-display-order': 0 },
          b: { type: 'string', 'x-display-order': 1 },
        },
      }
      const grouped = groupFieldsByCategory(simpleSchema)
      const fieldNames = [...grouped.values()].flat().map((entry) => entry[0])
      expect(fieldNames).toContain('a')
      expect(fieldNames).toContain('b')
    })
  })

  describe('field-schema-builder preserves x-field-groups', () => {
    it('addFieldToSchema preserves x-field-groups', () => {
      const result = addFieldToSchema(schemaWithGroups, {
        name: 'website',
        fieldType: 'url',
        description: 'Company website',
      })

      const groups = result['x-field-groups'] as FieldGroup[]
      expect(groups).toHaveLength(2)
      expect(groups[0].id).toBe('contact_info')
      expect(result.properties.website).toBeDefined()
    })

    it('removeFieldFromSchema preserves x-field-groups', () => {
      const result = removeFieldFromSchema(schemaWithGroups, 'notes')

      const groups = result['x-field-groups'] as FieldGroup[]
      expect(groups).toHaveLength(2)
      expect(result.properties.notes).toBeUndefined()
    })

    it('buildFieldSchema creates schema without x-field-groups', () => {
      const result = buildFieldSchema([
        { name: 'name', fieldType: 'text' },
      ])
      expect(result['x-field-groups']).toBeUndefined()
    })
  })
})
