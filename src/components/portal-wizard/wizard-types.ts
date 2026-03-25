import type { ExposedBlockTypeConfig } from '@/lib/portal-constants'

// --- Data prop types (passed from server page) ---

export interface FormTemplateSummary {
  id: string
  name: string
  questionCount: number
  status: string
}

export interface ClientOption {
  id: string
  name: string
}

export interface WorkflowTemplateSummary {
  id: string
  name: string
  description: string
}

export interface DocumentTemplateSummary {
  id: string
  name: string
  category: string
}

export interface RequestTypeConfigItem {
  workflow_template_id: string
  form_template_id?: string
  display_name?: string
}

// --- Wizard state ---

export type WizardStep = 1 | 2 | 3 | 4 | 5

export const WIZARD_STEPS = [
  { step: 1 as const, label: 'Name & Look' },
  { step: 2 as const, label: 'Data' },
  { step: 3 as const, label: 'Forms & Docs' },
  { step: 4 as const, label: 'Requests' },
  { step: 5 as const, label: 'Preview & Save' },
] as const

export interface WizardState {
  name: string
  dashboardEnabled: boolean
  documentsEnabled: boolean
  requestsEnabled: boolean
  formsEnabled: boolean
  displayName: string
  logoUrl: string
  primaryColor: string
  exposedBlockTypeConfig: ExposedBlockTypeConfig
  selectedFormTemplateIds: string[]
  selectedDocumentTemplateIds: string[]
  requestTypeConfig: RequestTypeConfigItem[]
  selectedClientId: string | null
}

// --- AI Suggestion interface (stubs for now) ---

export interface AiSuggestion {
  id: string
  label: string
  description?: string
  action: () => void
  confidence: 'high' | 'medium' | 'low'
}
