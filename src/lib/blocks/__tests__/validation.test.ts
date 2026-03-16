import { describe, it, expect } from 'vitest'
import { validateFields } from '../validation'

// FieldSchema and FieldProperty types mirror the module's internal interfaces.
// We build schemas inline per test so each case is self-contained.

describe('validateFields', () => {
  // ── Happy path ──────────────────────────────────────────────────────────────

  describe('valid metadata', () => {
    it('returns no errors when all fields match the schema', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number', minimum: 0, maximum: 150 },
          active: { type: 'boolean' },
        },
        required: ['name'],
      }

      const errors = validateFields(schema, { name: 'Alice', age: 30, active: true })
      expect(errors).toEqual([])
    })

    it('returns no errors for empty metadata when nothing is required', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      }

      const errors = validateFields(schema, {})
      expect(errors).toEqual([])
    })

    it('returns no errors when schema has no properties', () => {
      const schema = { type: 'object' }

      const errors = validateFields(schema, { anything: 'goes' })
      expect(errors).toEqual([])
    })
  })

  // ── Type mismatch ──────────────────────────────────────────────────────────

  describe('type mismatch', () => {
    it('returns error when string field receives a number', () => {
      const schema = {
        type: 'object',
        properties: { name: { type: 'string' } },
      }

      const errors = validateFields(schema, { name: 42 })
      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('name')
      expect(errors[0].message).toContain('Expected string')
      expect(errors[0].message).toContain('number')
    })

    it('returns error when number field receives a string', () => {
      const schema = {
        type: 'object',
        properties: { count: { type: 'number' } },
      }

      const errors = validateFields(schema, { count: 'ten' })
      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('count')
      expect(errors[0].message).toContain('Expected number')
    })

    it('returns error when boolean field receives a string', () => {
      const schema = {
        type: 'object',
        properties: { active: { type: 'boolean' } },
      }

      const errors = validateFields(schema, { active: 'true' })
      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('active')
      expect(errors[0].message).toContain('Expected boolean')
    })

    it('returns error when array field receives an object', () => {
      const schema = {
        type: 'object',
        properties: { tags: { type: 'array' } },
      }

      const errors = validateFields(schema, { tags: { a: 1 } })
      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('tags')
      expect(errors[0].message).toContain('Expected array')
    })

    it('returns error when object field receives an array', () => {
      const schema = {
        type: 'object',
        properties: { config: { type: 'object' } },
      }

      const errors = validateFields(schema, { config: [1, 2, 3] })
      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('config')
      expect(errors[0].message).toContain('Expected object')
    })
  })

  // ── Enum validation ─────────────────────────────────────────────────────────

  describe('enum violation', () => {
    it('returns error when value is not in the enum list', () => {
      const schema = {
        type: 'object',
        properties: {
          stage: { type: 'string', enum: ['draft', 'active', 'archived'] },
        },
      }

      const errors = validateFields(schema, { stage: 'deleted' })
      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('stage')
      expect(errors[0].message).toContain('deleted')
      expect(errors[0].message).toContain('draft')
    })

    it('passes when value is a valid enum member', () => {
      const schema = {
        type: 'object',
        properties: {
          stage: { type: 'string', enum: ['draft', 'active', 'archived'] },
        },
      }

      const errors = validateFields(schema, { stage: 'active' })
      expect(errors).toEqual([])
    })
  })

  // ── Number range ────────────────────────────────────────────────────────────

  describe('number below minimum', () => {
    it('returns error when number is below minimum', () => {
      const schema = {
        type: 'object',
        properties: {
          deal_value: { type: 'number', minimum: 0 },
        },
      }

      const errors = validateFields(schema, { deal_value: -100 })
      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('deal_value')
      expect(errors[0].message).toContain('below minimum')
      expect(errors[0].message).toContain('0')
    })

    it('passes when number equals the minimum', () => {
      const schema = {
        type: 'object',
        properties: {
          deal_value: { type: 'number', minimum: 0 },
        },
      }

      const errors = validateFields(schema, { deal_value: 0 })
      expect(errors).toEqual([])
    })
  })

  describe('number above maximum', () => {
    it('returns error when number exceeds maximum', () => {
      const schema = {
        type: 'object',
        properties: {
          rating: { type: 'number', minimum: 0, maximum: 5 },
        },
      }

      const errors = validateFields(schema, { rating: 10 })
      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('rating')
      expect(errors[0].message).toContain('exceeds maximum')
      expect(errors[0].message).toContain('5')
    })

    it('passes when number equals the maximum', () => {
      const schema = {
        type: 'object',
        properties: {
          rating: { type: 'number', minimum: 0, maximum: 5 },
        },
      }

      const errors = validateFields(schema, { rating: 5 })
      expect(errors).toEqual([])
    })
  })

  // ── String maxLength ────────────────────────────────────────────────────────

  describe('string exceeds maxLength', () => {
    it('returns error when string length exceeds maxLength', () => {
      const schema = {
        type: 'object',
        properties: {
          code: { type: 'string', maxLength: 3 },
        },
      }

      const errors = validateFields(schema, { code: 'ABCD' })
      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('code')
      expect(errors[0].message).toContain('maximum length')
      expect(errors[0].message).toContain('3')
    })

    it('passes when string length equals maxLength', () => {
      const schema = {
        type: 'object',
        properties: {
          code: { type: 'string', maxLength: 3 },
        },
      }

      const errors = validateFields(schema, { code: 'AUD' })
      expect(errors).toEqual([])
    })
  })

  // ── Email format ────────────────────────────────────────────────────────────

  describe('invalid email format', () => {
    it('returns error for email without @ symbol', () => {
      const schema = {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
        },
      }

      const errors = validateFields(schema, { email: 'not-an-email' })
      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('email')
      expect(errors[0].message).toContain('Invalid email')
    })

    it('returns error for email without domain', () => {
      const schema = {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
        },
      }

      const errors = validateFields(schema, { email: 'user@' })
      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('email')
    })

    it('returns error for email with spaces', () => {
      const schema = {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
        },
      }

      const errors = validateFields(schema, { email: 'user @example.com' })
      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('email')
    })

    it('passes for a valid email address', () => {
      const schema = {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
        },
      }

      const errors = validateFields(schema, { email: 'alice@example.com' })
      expect(errors).toEqual([])
    })
  })

  // ── Required fields ─────────────────────────────────────────────────────────

  describe('required field missing', () => {
    it('returns error when required field is absent from metadata', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
        },
        required: ['name', 'email'],
      }

      const errors = validateFields(schema, {})
      expect(errors).toHaveLength(2)
      expect(errors.map((e) => e.field).sort()).toEqual(['email', 'name'])
      expect(errors[0].message).toContain('Required field')
      expect(errors[0].message).toContain('missing')
    })

    it('returns error when required field is null', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      }

      const errors = validateFields(schema, { name: null })
      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('name')
      expect(errors[0].message).toContain('missing')
    })

    it('returns error when required field is undefined', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      }

      const errors = validateFields(schema, { name: undefined })
      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('name')
    })
  })

  // ── Extra fields are allowed ────────────────────────────────────────────────

  describe('extra fields are allowed', () => {
    it('does not return errors for fields not in the schema', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      }

      const errors = validateFields(schema, {
        name: 'Alice',
        unknown_field: 'some value',
        another_extra: 42,
      })
      expect(errors).toEqual([])
    })
  })

  // ── Nullish values skip validation ──────────────────────────────────────────

  describe('nullish values skip type validation', () => {
    it('does not type-check null values on non-required fields', () => {
      const schema = {
        type: 'object',
        properties: {
          notes: { type: 'string' },
        },
      }

      const errors = validateFields(schema, { notes: null })
      expect(errors).toEqual([])
    })

    it('does not type-check undefined values on non-required fields', () => {
      const schema = {
        type: 'object',
        properties: {
          notes: { type: 'string' },
        },
      }

      const errors = validateFields(schema, { notes: undefined })
      expect(errors).toEqual([])
    })
  })

  // ── Combined errors ─────────────────────────────────────────────────────────

  describe('multiple errors at once', () => {
    it('returns multiple errors when several fields are invalid', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number', minimum: 0 },
          stage: { type: 'string', enum: ['draft', 'active'] },
        },
        required: ['name'],
      }

      const errors = validateFields(schema, { age: -5, stage: 'invalid' })

      // required 'name' missing + age below min + stage not in enum = 3 errors
      expect(errors).toHaveLength(3)

      const fields = errors.map((e) => e.field)
      expect(fields).toContain('name')
      expect(fields).toContain('age')
      expect(fields).toContain('stage')
    })
  })

  // ── Type mismatch short-circuits further checks ─────────────────────────────

  describe('type mismatch short-circuits', () => {
    it('does not report enum or range errors when type itself is wrong', () => {
      const schema = {
        type: 'object',
        properties: {
          rating: { type: 'number', minimum: 1, maximum: 5, enum: [1, 2, 3, 4, 5] },
        },
      }

      const errors = validateFields(schema, { rating: 'three' })
      // Only the type mismatch error, not the enum/range errors
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toContain('Expected number')
    })
  })
})
