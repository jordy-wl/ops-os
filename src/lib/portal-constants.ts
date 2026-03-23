export const COMMON_BLOCK_TYPES = [
  { value: 'deal', label: 'Deals' },
  { value: 'project', label: 'Projects' },
  { value: 'task', label: 'Tasks' },
  { value: 'document_template', label: 'Documents' },
  { value: 'product', label: 'Products' },
  { value: 'service', label: 'Services' },
  { value: 'solution', label: 'Solutions' },
  { value: 'policy', label: 'Policies' },
] as const

export const PORTAL_FEATURE_FLAGS = [
  { key: 'dashboard_enabled', label: 'Dashboard', description: 'Block overview and activity' },
  { key: 'documents_enabled', label: 'Documents', description: 'Document viewing and downloads' },
  { key: 'requests_enabled', label: 'Requests', description: 'Submit support requests' },
  { key: 'forms_enabled', label: 'Forms', description: 'Fill out and submit forms' },
] as const

export type PortalFeatureKey = (typeof PORTAL_FEATURE_FLAGS)[number]['key']
