import Ajv from 'ajv'

const ajv = new Ajv({ allErrors: true, strict: false })

/**
 * Validates that a value is a valid JSON Schema document (draft-07).
 * Used to ensure user-submitted field_schema values are compilable.
 */
export function isValidJsonSchema(schema: unknown): boolean {
  if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) {
    return false
  }
  try {
    ajv.compile(schema as object)
    return true
  } catch {
    return false
  }
}
