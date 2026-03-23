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
 * - x-field-group: group/category ID this field belongs to (string)
 * - x-relation-edge-type: edge type string to auto-create in block_edges when
 *   this relation field has a value (empty = no edge sync)
 *
 * Top-level schema extension for field groups:
 * - x-field-groups: array of { id, label, order } defining available groups
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
  'multi-relation',
  'rich-text',
  'form-questions',
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
      'x-relation-edge-type': '',
    },
  },
  'multi-relation': {
    type: 'multi-relation',
    label: 'Multi-Relation',
    icon: 'link-2',
    jsonSchemaType: 'array',
    defaultSchema: {
      type: 'array',
      items: { type: 'string' },
      'x-field-type': 'multi-relation',
      'x-relation-target': '',
      'x-relation-edge-type': '',
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
  'form-questions': {
    type: 'form-questions',
    label: 'Form Questions',
    icon: 'list-checks',
    jsonSchemaType: 'array',
    defaultSchema: {
      type: 'array',
      'x-field-type': 'form-questions',
      items: { type: 'object' },
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

// --- Standard Edge Types ---

/** Edge types available for relation field auto-sync with block_edges */
export const STANDARD_EDGE_TYPES = [
  // Hierarchy
  { value: 'part_of', label: 'Part Of', description: 'This record belongs to or is a component of the target', group: 'Hierarchy' },
  { value: 'owned_by', label: 'Owned By', description: 'This record is owned or managed by the target', group: 'Hierarchy' },
  { value: 'instance_of', label: 'Instance Of', description: 'This record is a specific instance of the target template', group: 'Hierarchy' },
  // Governance
  { value: 'governed_by', label: 'Governed By', description: 'This record is subject to the rules of the target policy', group: 'Governance' },
  { value: 'counterparty_to', label: 'Counterparty To', description: 'Both records are parties to the same deal or agreement', group: 'Governance' },
  // General
  { value: 'related_to', label: 'Related To', description: 'General association — use when no specific type applies', group: 'General' },
  // Workflow
  { value: 'processing', label: 'Processing', description: 'This record is actively handling the target', group: 'Workflow' },
  { value: 'spawned', label: 'Spawned', description: 'This record was created or generated by the target', group: 'Workflow' },
  { value: 'triggered_by', label: 'Triggered By', description: 'This record was initiated by the target', group: 'Workflow' },
] as const

export const VALID_EDGE_TYPE_VALUES: readonly string[] = STANDARD_EDGE_TYPES.map((e) => e.value)

// --- Field Groups ---

export interface FieldGroup {
  id: string
  label: string
  order: number
}

/** The default group for fields without an explicit x-field-group */
export const DEFAULT_FIELD_GROUP: FieldGroup = {
  id: 'general',
  label: 'General',
  order: 999,
}

/**
 * Extract field groups from a block type's field schema.
 * Returns groups sorted by order. Always includes a "General" fallback
 * for fields without an explicit group assignment.
 */
export function getFieldGroups(fieldSchema: Record<string, unknown>): FieldGroup[] {
  const xGroups = fieldSchema['x-field-groups'] as FieldGroup[] | undefined
  if (!xGroups || !Array.isArray(xGroups) || xGroups.length === 0) {
    return [DEFAULT_FIELD_GROUP]
  }

  const groups = xGroups
    .filter((g) => g && typeof g.id === 'string' && typeof g.label === 'string')
    .map((g) => ({ id: g.id, label: g.label, order: typeof g.order === 'number' ? g.order : 999 }))
    .sort((a, b) => a.order - b.order)

  // Check if any properties lack a group — if so, ensure General exists
  const properties = (fieldSchema.properties ?? {}) as Record<string, Record<string, unknown>>
  const hasUngrouped = Object.values(properties).some(
    (prop) => !prop['x-field-group'] || !groups.some((g) => g.id === prop['x-field-group'])
  )
  if (hasUngrouped && !groups.some((g) => g.id === 'general')) {
    groups.push(DEFAULT_FIELD_GROUP)
  }

  return groups
}

/**
 * Group field entries by their x-field-group assignment.
 * Returns a Map of group ID → field entries (sorted by x-display-order within each group).
 */
export function groupFieldsByCategory(
  fieldSchema: Record<string, unknown>
): Map<string, Array<[string, Record<string, unknown>]>> {
  const properties = (fieldSchema.properties ?? {}) as Record<string, Record<string, unknown>>
  const groups = getFieldGroups(fieldSchema)
  const groupIds = new Set(groups.map((g) => g.id))
  const result = new Map<string, Array<[string, Record<string, unknown>]>>()

  // Initialize all groups
  for (const g of groups) {
    result.set(g.id, [])
  }

  // Assign fields to groups
  for (const [fieldName, prop] of Object.entries(properties)) {
    const groupId = (prop['x-field-group'] as string) || 'general'
    const targetGroup = groupIds.has(groupId) ? groupId : 'general'
    const list = result.get(targetGroup) ?? []
    list.push([fieldName, prop])
    result.set(targetGroup, list)
  }

  // Sort fields within each group by x-display-order
  for (const [groupId, fields] of result.entries()) {
    fields.sort((a, b) => {
      const orderA = (a[1]['x-display-order'] as number) ?? 999
      const orderB = (b[1]['x-display-order'] as number) ?? 999
      if (orderA !== orderB) return orderA - orderB
      return a[0].localeCompare(b[0])
    })
    result.set(groupId, fields)
  }

  return result
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
  if (type === 'array') {
    if (schemaProp['x-relation-target']) return 'multi-relation'
    return 'multi-select'
  }

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
