/**
 * Schema builder utility for constructing valid JSON Schema objects
 * with x-* extensions from field definitions.
 */

import { type FieldType, FIELD_TYPE_DEFINITIONS, isValidFieldType } from './field-types'

export interface FieldDefinition {
  /** Field name (snake_case, unique within schema) */
  name: string
  /** Field type from FIELD_TYPES */
  fieldType: FieldType
  /** Human-readable description (used as label) */
  description?: string
  /** Whether this field is required */
  required?: boolean
  /** Display order (auto-assigned if not provided) */
  displayOrder?: number
  /** Custom placeholder text */
  placeholder?: string
  /** Whether this is a system-managed field */
  isSystem?: boolean
  /** Type-specific config — merged into the JSON Schema property */
  config?: Record<string, unknown>
}

export interface BuiltSchema {
  type: 'object'
  properties: Record<string, Record<string, unknown>>
  required?: string[]
  /** Allow top-level x-* extensions (e.g. x-field-groups) */
  [key: string]: unknown
}

/**
 * Build a JSON Schema object from an array of FieldDefinitions.
 * Each field becomes a property with appropriate type and x-* extensions.
 */
export function buildFieldSchema(fields: FieldDefinition[]): BuiltSchema {
  const properties: Record<string, Record<string, unknown>> = {}
  const requiredFields: string[] = []

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i]
    const typeDef = FIELD_TYPE_DEFINITIONS[field.fieldType]
    if (!typeDef) continue

    const prop: Record<string, unknown> = {
      ...typeDef.defaultSchema,
      description: field.description ?? field.name.replace(/_/g, ' '),
      'x-display-order': field.displayOrder ?? i,
    }

    if (field.placeholder) {
      prop['x-placeholder'] = field.placeholder
    }

    if (field.isSystem) {
      prop['x-is-system'] = true
    }

    // Merge type-specific config (e.g., enum values, relation target, currency code)
    if (field.config) {
      Object.assign(prop, field.config)
    }

    properties[field.name] = prop

    if (field.required) {
      requiredFields.push(field.name)
    }
  }

  const schema: BuiltSchema = { type: 'object', properties }
  if (requiredFields.length > 0) {
    schema.required = requiredFields
  }

  return schema
}

/**
 * Add a single field to an existing schema. Returns a new schema object.
 * Assigns x-display-order as max(existing orders) + 1.
 */
export function addFieldToSchema(
  schema: BuiltSchema,
  field: FieldDefinition
): BuiltSchema {
  const existingOrders = Object.values(schema.properties).map(
    (p) => (p['x-display-order'] as number) ?? 0
  )
  const nextOrder = existingOrders.length > 0 ? Math.max(...existingOrders) + 1 : 0

  const fieldWithOrder = { ...field, displayOrder: field.displayOrder ?? nextOrder }
  const newProp = buildFieldSchema([fieldWithOrder]).properties[field.name]

  const properties = { ...schema.properties, [field.name]: newProp }
  const required = [...(schema.required ?? [])]
  if (field.required && !required.includes(field.name)) {
    required.push(field.name)
  }

  return {
    ...schema,
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
  }
}

/**
 * Remove a field from an existing schema. Returns a new schema object.
 * Throws if field has x-is-system set.
 */
export function removeFieldFromSchema(
  schema: BuiltSchema,
  fieldName: string
): BuiltSchema {
  const existing = schema.properties[fieldName]
  if (!existing) {
    throw new Error(`Field "${fieldName}" does not exist in schema`)
  }
  if (existing['x-is-system']) {
    throw new Error(`Field "${fieldName}" is a system field and cannot be removed`)
  }

  const { [fieldName]: _removed, ...rest } = schema.properties
  const required = (schema.required ?? []).filter((r) => r !== fieldName)

  return {
    ...schema,
    type: 'object',
    properties: rest,
    required: required.length > 0 ? required : undefined,
  }
}

/**
 * Update a field's properties in an existing schema. Returns a new schema object.
 * Throws if field has x-is-system set.
 */
export function updateFieldInSchema(
  schema: BuiltSchema,
  fieldName: string,
  updates: Partial<Pick<FieldDefinition, 'description' | 'placeholder' | 'required' | 'displayOrder' | 'config'>>
): BuiltSchema {
  const existing = schema.properties[fieldName]
  if (!existing) {
    throw new Error(`Field "${fieldName}" does not exist in schema`)
  }
  if (existing['x-is-system']) {
    throw new Error(`Field "${fieldName}" is a system field and cannot be modified`)
  }

  const updated = { ...existing }

  if (updates.description !== undefined) {
    updated.description = updates.description
  }
  if (updates.placeholder !== undefined) {
    updated['x-placeholder'] = updates.placeholder
  }
  if (updates.displayOrder !== undefined) {
    updated['x-display-order'] = updates.displayOrder
  }
  if (updates.config) {
    Object.assign(updated, updates.config)
  }

  const properties = { ...schema.properties, [fieldName]: updated }

  let required = [...(schema.required ?? [])]
  if (updates.required !== undefined) {
    if (updates.required && !required.includes(fieldName)) {
      required.push(fieldName)
    } else if (!updates.required) {
      required = required.filter((r) => r !== fieldName)
    }
  }

  return {
    ...schema,
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
  }
}

/**
 * Extract ordered field definitions from an existing JSON Schema.
 * Used to convert a raw schema into a list for the UI.
 */
export function extractFieldsFromSchema(
  schema: BuiltSchema
): Array<{ name: string; fieldType: FieldType; property: Record<string, unknown>; order: number }> {
  const properties = schema.properties ?? {}
  const fields = Object.entries(properties).map(([name, prop]) => {
    const xFieldType = prop['x-field-type'] as string | undefined
    let fieldType: FieldType = 'text'
    if (xFieldType && isValidFieldType(xFieldType)) {
      fieldType = xFieldType
    }

    return {
      name,
      fieldType,
      property: prop,
      order: (prop['x-display-order'] as number) ?? 0,
    }
  })

  return fields.sort((a, b) => a.order - b.order)
}
