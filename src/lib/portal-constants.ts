import { SYSTEM_BLOCK_TYPES } from './block-types/system-types'

// Internal-only types that should never be portal-visible
const INTERNAL_BLOCK_TYPES = new Set([
  'workflow_template',
  'workflow_instance',
  'task_queue_item',
  'brand_kit',
])

export const ALL_PORTAL_BLOCK_TYPES = SYSTEM_BLOCK_TYPES
  .filter((def) => !INTERNAL_BLOCK_TYPES.has(def.type_name))
  .map((def) => ({ value: def.type_name, label: def.display_name }))

// Keep COMMON_BLOCK_TYPES as alias for backward compatibility
export const COMMON_BLOCK_TYPES = ALL_PORTAL_BLOCK_TYPES

export const PORTAL_FEATURE_FLAGS = [
  { key: 'dashboard_enabled', label: 'Dashboard', description: 'Block overview and activity' },
  { key: 'documents_enabled', label: 'Documents', description: 'Document viewing and downloads' },
  { key: 'requests_enabled', label: 'Requests', description: 'Submit support requests' },
  { key: 'forms_enabled', label: 'Forms', description: 'Fill out and submit forms' },
] as const

export type PortalFeatureKey = (typeof PORTAL_FEATURE_FLAGS)[number]['key']

/** Per-type field visibility configuration stored in portal_configurations.exposed_block_type_config */
export interface BlockTypeFieldConfig {
  enabled: boolean
  fields: Record<string, boolean>
}

export type ExposedBlockTypeConfig = Record<string, BlockTypeFieldConfig>
