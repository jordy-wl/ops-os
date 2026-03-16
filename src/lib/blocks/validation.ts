import { createServerClient } from '@/lib/supabase/server'

interface FieldSchema {
  type: string
  properties?: Record<string, FieldProperty>
  required?: string[]
}

interface FieldProperty {
  type: string
  enum?: (string | number | boolean)[]
  minimum?: number
  maximum?: number
  maxLength?: number
  format?: string
  description?: string
  items?: FieldProperty
  properties?: Record<string, FieldProperty>
}

interface ValidationError {
  field: string
  message: string
}

/**
 * Fetches the field_schema for a block type from block_type_definitions.
 * Returns null if the type has no schema or doesn't exist.
 */
export async function getFieldSchema(
  orgId: string,
  typeName: string
): Promise<FieldSchema | null> {
  const supabase = createServerClient()

  const { data } = await supabase
    .from('block_type_definitions')
    .select('field_schema')
    .or(`org_id.eq.${orgId},org_id.is.null`)
    .eq('type_name', typeName)
    .limit(1)
    .maybeSingle()

  return data?.field_schema ?? null
}

/**
 * Validates metadata fields against the type's field_schema.
 * Returns an array of validation errors (empty = valid).
 *
 * This is a lightweight JSON Schema subset validator — supports:
 * - type checking (string, number, boolean, array, object)
 * - enum validation
 * - minimum/maximum for numbers
 * - maxLength for strings
 * - required fields
 * - format: email (basic check)
 */
export function validateFields(
  schema: FieldSchema,
  metadata: Record<string, unknown>
): ValidationError[] {
  const errors: ValidationError[] = []

  if (!schema.properties) return errors

  // Check required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (metadata[field] === undefined || metadata[field] === null) {
        errors.push({ field, message: `Required field '${field}' is missing` })
      }
    }
  }

  // Validate each provided field against its property schema
  for (const [key, value] of Object.entries(metadata)) {
    const propSchema = schema.properties[key]
    if (!propSchema) continue // allow extra fields — extensible

    if (value === null || value === undefined) continue // skip nullish

    const fieldErrors = validateProperty(key, value, propSchema)
    errors.push(...fieldErrors)
  }

  return errors
}

function validateProperty(
  field: string,
  value: unknown,
  schema: FieldProperty
): ValidationError[] {
  const errors: ValidationError[] = []

  // Type check
  if (schema.type === 'string' && typeof value !== 'string') {
    errors.push({ field, message: `Expected string, got ${typeof value}` })
    return errors
  }
  if (schema.type === 'number' && typeof value !== 'number') {
    errors.push({ field, message: `Expected number, got ${typeof value}` })
    return errors
  }
  if (schema.type === 'boolean' && typeof value !== 'boolean') {
    errors.push({ field, message: `Expected boolean, got ${typeof value}` })
    return errors
  }
  if (schema.type === 'array' && !Array.isArray(value)) {
    errors.push({ field, message: `Expected array, got ${typeof value}` })
    return errors
  }
  if (schema.type === 'object' && (typeof value !== 'object' || Array.isArray(value))) {
    errors.push({ field, message: `Expected object, got ${typeof value}` })
    return errors
  }

  // Enum check
  if (schema.enum && !schema.enum.includes(value as string | number | boolean)) {
    errors.push({
      field,
      message: `Value '${String(value)}' is not one of: ${schema.enum.join(', ')}`,
    })
  }

  // Number range
  if (schema.type === 'number' && typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({ field, message: `Value ${value} is below minimum ${schema.minimum}` })
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({ field, message: `Value ${value} exceeds maximum ${schema.maximum}` })
    }
  }

  // String constraints
  if (schema.type === 'string' && typeof value === 'string') {
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({
        field,
        message: `Value exceeds maximum length of ${schema.maxLength}`,
      })
    }
    if (schema.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      errors.push({ field, message: `Invalid email format` })
    }
  }

  return errors
}
