import { describe, it, expect } from 'vitest'
import { SYSTEM_BLOCK_TYPES } from '../system-types'

// Structural tests for the system block type definitions.
// These tests verify the shape and completeness of the static data
// without needing any mocks or external dependencies.

describe('SYSTEM_BLOCK_TYPES', () => {
  // ── Required fields on every type ───────────────────────────────────────────

  describe('required fields on all types', () => {
    it('has exactly 18 system block types', () => {
      expect(SYSTEM_BLOCK_TYPES).toHaveLength(18)
    })

    it.each(SYSTEM_BLOCK_TYPES.map((t) => [t.type_name, t]))(
      '%s has all required fields',
      (_name, typeDef) => {
        expect(typeDef).toHaveProperty('type_name')
        expect(typeDef).toHaveProperty('display_name')
        expect(typeDef).toHaveProperty('description')
        expect(typeDef).toHaveProperty('icon')
        expect(typeDef).toHaveProperty('color')
        expect(typeDef).toHaveProperty('field_schema')

        // field values are non-empty strings
        expect(typeof typeDef.type_name).toBe('string')
        expect(typeDef.type_name.length).toBeGreaterThan(0)
        expect(typeof typeDef.display_name).toBe('string')
        expect(typeDef.display_name.length).toBeGreaterThan(0)
        expect(typeof typeDef.description).toBe('string')
        expect(typeDef.description.length).toBeGreaterThan(0)
        expect(typeof typeDef.icon).toBe('string')
        expect(typeDef.icon.length).toBeGreaterThan(0)
        expect(typeof typeDef.color).toBe('string')
        expect(typeDef.color.length).toBeGreaterThan(0)
      }
    )
  })

  // ── Unique type_name values ─────────────────────────────────────────────────

  describe('unique type names', () => {
    it('has no duplicate type_name values', () => {
      const names = SYSTEM_BLOCK_TYPES.map((t) => t.type_name)
      const unique = new Set(names)
      expect(unique.size).toBe(names.length)
    })
  })

  // ── New Sprint 2 types exist ────────────────────────────────────────────────

  describe('Sprint 2 new types', () => {
    const newTypeNames = ['solution', 'product', 'service', 'team_member', 'policy'] as const

    it.each(newTypeNames)('includes the %s type', (typeName) => {
      const found = SYSTEM_BLOCK_TYPES.find((t) => t.type_name === typeName)
      expect(found).toBeDefined()
    })

    it('solution has expected fields', () => {
      const solution = SYSTEM_BLOCK_TYPES.find((t) => t.type_name === 'solution')!
      const props = solution.field_schema.properties
      expect(props).toHaveProperty('status')
      expect(props).toHaveProperty('category')
      expect(props).toHaveProperty('pricing_model')
      expect(props).toHaveProperty('product_refs')
      expect(props).toHaveProperty('service_refs')
    })

    it('product has unit_price with minimum 0', () => {
      const product = SYSTEM_BLOCK_TYPES.find((t) => t.type_name === 'product')!
      const unitPrice = product.field_schema.properties.unit_price
      expect(unitPrice.type).toBe('number')
      expect(unitPrice.minimum).toBe(0)
    })

    it('service has service_type, delivery_model, and sla_tier enums', () => {
      const service = SYSTEM_BLOCK_TYPES.find((t) => t.type_name === 'service')!
      const props = service.field_schema.properties
      expect(props.service_type.enum).toContain('consulting')
      expect(props.delivery_model.enum).toContain('remote')
      expect(props.sla_tier.enum).toContain('enterprise')
    })

    it('team_member has email with format: email', () => {
      const teamMember = SYSTEM_BLOCK_TYPES.find((t) => t.type_name === 'team_member')!
      expect(teamMember.field_schema.properties.email.format).toBe('email')
    })

    it('policy has jurisdiction enum including global', () => {
      const policy = SYSTEM_BLOCK_TYPES.find((t) => t.type_name === 'policy')!
      expect(policy.field_schema.properties.jurisdiction.enum).toContain('global')
      expect(policy.field_schema.properties.jurisdiction.enum).toContain('AU')
    })
  })

  // ── Contact type enriched fields ────────────────────────────────────────────

  describe('contact type enriched fields', () => {
    const contact = SYSTEM_BLOCK_TYPES.find((t) => t.type_name === 'contact')!

    it('has response_time_sla with enum values', () => {
      const prop = contact.field_schema.properties.response_time_sla
      expect(prop).toBeDefined()
      expect(prop.type).toBe('string')
      expect(prop.enum).toEqual(['1h', '4h', '8h', '24h', '48h'])
    })

    it('has timezone with maxLength 50', () => {
      const prop = contact.field_schema.properties.timezone
      expect(prop).toBeDefined()
      expect(prop.type).toBe('string')
      expect(prop.maxLength).toBe(50)
    })

    it('has notes with maxLength 5000', () => {
      const prop = contact.field_schema.properties.notes
      expect(prop).toBeDefined()
      expect(prop.type).toBe('string')
      expect(prop.maxLength).toBe(5000)
    })

    it('has communication_preference enum', () => {
      const prop = contact.field_schema.properties.communication_preference
      expect(prop).toBeDefined()
      expect(prop.enum).toEqual(['email', 'phone', 'slack', 'teams'])
    })

    it('has preferred_contact_method enum', () => {
      const prop = contact.field_schema.properties.preferred_contact_method
      expect(prop).toBeDefined()
      expect(prop.enum).toEqual(['email', 'phone', 'in_person', 'video_call'])
    })

    it('has signature_template with maxLength 2000', () => {
      const prop = contact.field_schema.properties.signature_template
      expect(prop).toBeDefined()
      expect(prop.type).toBe('string')
      expect(prop.maxLength).toBe(2000)
    })

    it('has email with format: email', () => {
      const prop = contact.field_schema.properties.email
      expect(prop).toBeDefined()
      expect(prop.format).toBe('email')
    })
  })

  // ── Field schemas are valid JSON Schema objects ─────────────────────────────

  describe('field schemas are valid JSON Schema objects', () => {
    it.each(SYSTEM_BLOCK_TYPES.map((t) => [t.type_name, t]))(
      '%s has a valid JSON Schema structure',
      (_name, typeDef) => {
        const schema = typeDef.field_schema

        // Must be type: object with properties defined
        expect(schema.type).toBe('object')
        expect(schema).toHaveProperty('properties')
        expect(typeof schema.properties).toBe('object')
        expect(schema.properties).not.toBeNull()

        // Each property must have a type
        for (const [_propName, propDef] of Object.entries(schema.properties)) {
          expect(propDef).toHaveProperty('type')
          expect(typeof propDef.type).toBe('string')

          // type must be a valid JSON Schema primitive type
          const validTypes = ['string', 'number', 'boolean', 'array', 'object', 'integer']
          expect(validTypes).toContain(propDef.type)

          // If enum is present, it must be an array
          if ('enum' in propDef && propDef.enum !== undefined) {
            expect(Array.isArray(propDef.enum)).toBe(true)
          }

          // If minimum/maximum are present, property type must be number
          if ('minimum' in propDef || 'maximum' in propDef) {
            expect(propDef.type).toBe('number')
          }

          // If maxLength is present, property type must be string
          if ('maxLength' in propDef) {
            expect(propDef.type).toBe('string')
          }

          // If items is present, property type must be array
          if ('items' in propDef) {
            expect(propDef.type).toBe('array')
          }
        }
      }
    )

    it('types with required arrays reference existing properties', () => {
      for (const typeDef of SYSTEM_BLOCK_TYPES) {
        const schema = typeDef.field_schema
        if ('required' in schema && Array.isArray(schema.required)) {
          const propertyNames = Object.keys(schema.properties)
          for (const req of schema.required) {
            expect(propertyNames).toContain(req)
          }
        }
      }
    })
  })

  // ── Snapshot of all type names for regression ───────────────────────────────

  describe('complete type name list', () => {
    it('contains exactly the expected 18 types in order', () => {
      const names = SYSTEM_BLOCK_TYPES.map((t) => t.type_name)
      expect(names).toEqual([
        'client',
        'deal',
        'project',
        'contact',
        'contract',
        'workflow_template',
        'workflow_instance',
        'task_queue_item',
        'document_template',
        'brand_kit',
        'solution',
        'product',
        'service',
        'team_member',
        'policy',
        'swot_analysis',
        'value_proposition',
        'form_template',
      ])
    })
  })
})
