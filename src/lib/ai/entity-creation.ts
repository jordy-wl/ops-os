/**
 * entity-creation.ts — Validate block creation inputs against field schemas.
 *
 * When AI creates a block with custom fields, this module validates the provided
 * field values against the block type's JSON Schema (field_schema from block_type_definitions).
 */

import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export type BlockTypeSchema = {
  type: string
  label: string
  field_schema: Record<string, unknown>
}

// Internal DB row shape — matches actual column names in block_type_definitions
type BlockTypeRow = {
  type_name: string
  display_name: string
  field_schema: Record<string, unknown>
}

/**
 * Fetch all block type definitions for an org to provide to AI context.
 * Returns type name, label, and field schema for each block type.
 */
export async function getBlockTypeSchemas(orgId: string): Promise<BlockTypeSchema[]> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('block_type_definitions')
    .select('type_name, display_name, field_schema')
    .eq('org_id', orgId)
    .order('type_name')

  if (error) {
    logger.error('entity-creation', 'fetch_schemas.failed', { error_code: error.code })
    return []
  }

  return (data ?? []).map((d: BlockTypeRow) => ({
    type: d.type_name,
    label: d.display_name,
    field_schema: (d.field_schema as Record<string, unknown>) ?? {},
  }))
}

/**
 * Validate metadata fields against a block type's field_schema.
 * Returns valid fields (stripped of unknown keys) and validation errors.
 */
export function validateFieldsAgainstSchema(
  fields: Record<string, unknown>,
  fieldSchema: Record<string, unknown>
): { validFields: Record<string, unknown>; errors: string[] } {
  const errors: string[] = []
  const validFields: Record<string, unknown> = {}

  // Extract property names from JSON Schema
  const properties = (fieldSchema.properties as Record<string, Record<string, unknown>>) ?? {}
  const allowedKeys = new Set(Object.keys(properties))

  for (const [key, value] of Object.entries(fields)) {
    if (!allowedKeys.has(key)) {
      errors.push(`Unknown field "${key}" — not in block type schema`)
      continue
    }

    const propSchema = properties[key]
    if (!propSchema) continue

    // Basic type validation
    const expectedType = propSchema.type as string
    const isSystemField = propSchema['x-is-system'] === true

    if (isSystemField) {
      errors.push(`Field "${key}" is a system field and cannot be set manually`)
      continue
    }

    if (expectedType === 'string' && typeof value !== 'string') {
      errors.push(`Field "${key}" expects a string value`)
      continue
    }
    if (expectedType === 'number' && typeof value !== 'number') {
      errors.push(`Field "${key}" expects a number value`)
      continue
    }
    if (expectedType === 'boolean' && typeof value !== 'boolean') {
      errors.push(`Field "${key}" expects a boolean value`)
      continue
    }
    if (expectedType === 'array' && !Array.isArray(value)) {
      errors.push(`Field "${key}" expects an array value`)
      continue
    }

    // Enum validation for select fields
    const enumValues = propSchema.enum as unknown[] | undefined
    if (enumValues && enumValues.length > 0 && !enumValues.includes(value)) {
      errors.push(`Field "${key}" must be one of: ${enumValues.join(', ')}`)
      continue
    }

    validFields[key] = value
  }

  return { validFields, errors }
}
