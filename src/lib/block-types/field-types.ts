/**
 * Field type definitions for user-configurable block fields.
 * Each field type maps to a JSON Schema property with `x-*` extensions.
 *
 * Supported x-* extensions (JSON Schema spec-compliant):
 * - x-field-type: canonical field type identifier
 * - x-display-order: integer for rendering order
 * - x-relation-target: target block type for relation fields
 * - x-currency-code: ISO 4217 currency code
 * - x-placeholder: custom placeholder text
 * - x-is-system: marks field as system-managed (locked from editing)
 */

export const FIELD_TYPES = [
  'text',
  'number',
  'email',
  'date',
  'select',
  'multi-select',
  'boolean',
  'url',
  'phone',
  'currency',
  'relation',
  'rich-text',
] as const

export type FieldType = (typeof FIELD_TYPES)[number]

export interface FieldTypeDefinition {
  type: FieldType
  label: string
  icon: string
  /** JSON Schema `type` value */
  jsonSchemaType: string
  /** Default JSON Schema properties for this field type */
  defaultSchema: Record<string, unknown>
}

/** Map of field type → definition with defaults and JSON Schema mapping */
export const FIELD_TYPE_DEFINITIONS: Record<FieldType, FieldTypeDefinition> = {
  text: {
    type: 'text',
    label: 'Text',
    icon: 'type',
    jsonSchemaType: 'string',
    defaultSchema: {
      type: 'string',
      'x-field-type': 'text',
    },
  },
  number: {
    type: 'number',
    label: 'Number',
    icon: 'hash',
    jsonSchemaType: 'number',
    defaultSchema: {
      type: 'number',
      'x-field-type': 'number',
    },
  },
  email: {
    type: 'email',
    label: 'Email',
    icon: 'mail',
    jsonSchemaType: 'string',
    defaultSchema: {
      type: 'string',
      format: 'email',
      'x-field-type': 'email',
    },
  },
  date: {
    type: 'date',
    label: 'Date',
    icon: 'calendar',
    jsonSchemaType: 'string',
    defaultSchema: {
      type: 'string',
      format: 'date',
      'x-field-type': 'date',
    },
  },
  select: {
    type: 'select',
    label: 'Select',
    icon: 'list',
    jsonSchemaType: 'string',
    defaultSchema: {
      type: 'string',
      enum: [],
      'x-field-type': 'select',
    },
  },
  'multi-select': {
    type: 'multi-select',
    label: 'Multi-Select',
    icon: 'list-checks',
    jsonSchemaType: 'array',
    defaultSchema: {
      type: 'array',
      items: { type: 'string', enum: [] },
      'x-field-type': 'multi-select',
    },
  },
  boolean: {
    type: 'boolean',
    label: 'Boolean',
    icon: 'toggle-left',
    jsonSchemaType: 'boolean',
    defaultSchema: {
      type: 'boolean',
      'x-field-type': 'boolean',
    },
  },
  url: {
    type: 'url',
    label: 'URL',
    icon: 'link',
    jsonSchemaType: 'string',
    defaultSchema: {
      type: 'string',
      format: 'uri',
      'x-field-type': 'url',
    },
  },
  phone: {
    type: 'phone',
    label: 'Phone',
    icon: 'phone',
    jsonSchemaType: 'string',
    defaultSchema: {
      type: 'string',
      'x-field-type': 'phone',
    },
  },
  currency: {
    type: 'currency',
    label: 'Currency',
    icon: 'dollar-sign',
    jsonSchemaType: 'number',
    defaultSchema: {
      type: 'number',
      minimum: 0,
      'x-field-type': 'currency',
      'x-currency-code': 'AUD',
    },
  },
  relation: {
    type: 'relation',
    label: 'Relation',
    icon: 'link-2',
    jsonSchemaType: 'string',
    defaultSchema: {
      type: 'string',
      'x-field-type': 'relation',
      'x-relation-target': '',
    },
  },
  'rich-text': {
    type: 'rich-text',
    label: 'Rich Text',
    icon: 'text',
    jsonSchemaType: 'string',
    defaultSchema: {
      type: 'string',
      'x-field-type': 'rich-text',
    },
  },
}

/** Returns true if the given string is a valid FieldType */
export function isValidFieldType(type: string): type is FieldType {
  return FIELD_TYPES.includes(type as FieldType)
}

/** Get the FieldTypeDefinition for a given type string, or undefined */
export function getFieldTypeDefinition(type: string): FieldTypeDefinition | undefined {
  if (!isValidFieldType(type)) return undefined
  return FIELD_TYPE_DEFINITIONS[type]
}

/**
 * Infer the FieldType from an existing JSON Schema property.
 * Used to determine field type for existing system schemas that
 * may not have x-field-type set.
 */
export function inferFieldType(schemaProp: Record<string, unknown>): FieldType {
  const xFieldType = schemaProp['x-field-type'] as string | undefined
  if (xFieldType && isValidFieldType(xFieldType)) return xFieldType

  const type = schemaProp.type as string | undefined
  const format = schemaProp.format as string | undefined
  const enumValues = schemaProp.enum as unknown[] | undefined

  if (type === 'boolean') return 'boolean'
  if (type === 'number' || type === 'integer') {
    if (schemaProp['x-currency-code']) return 'currency'
    return 'number'
  }
  if (type === 'array') return 'multi-select'

  // String subtypes
  if (type === 'string') {
    if (format === 'email') return 'email'
    if (format === 'uri') return 'url'
    if (format === 'date') return 'date'
    if (enumValues && enumValues.length > 0) return 'select'
    return 'text'
  }

  return 'text'
}
