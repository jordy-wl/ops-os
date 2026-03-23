export interface BranchingConfig {
  condition_field: string
  condition_value: string
  condition_operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than'
}

export interface FormQuestion {
  id: string
  type:
    | 'text'
    | 'textarea'
    | 'number'
    | 'select'
    | 'multi_select'
    | 'scale'
    | 'likert'
    | 'emoji'
    | 'date'
    | 'url'
    | 'file_upload'
    | 'yes_no'
  label: string
  description?: string
  required: boolean
  options?: string[]
  max_length?: number
  scale_min?: number
  scale_max?: number
  scale_labels?: { min: string; max: string } | string[]
  branching?: BranchingConfig
  order: number
}

export const QUESTION_TYPES = [
  { value: 'text', label: 'Short Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Dropdown' },
  { value: 'multi_select', label: 'Multi-Select' },
  { value: 'scale', label: 'Number Scale' },
  { value: 'likert', label: 'Likert Scale' },
  { value: 'emoji', label: 'Emoji Rating' },
  { value: 'date', label: 'Date' },
  { value: 'url', label: 'URL' },
  { value: 'file_upload', label: 'File Upload' },
  { value: 'yes_no', label: 'Yes / No' },
] as const

export const BRANCHING_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Does not equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'greater_than', label: 'Greater than' },
  { value: 'less_than', label: 'Less than' },
] as const

export const LIKERT_LABELS_DEFAULT = [
  'Strongly Disagree',
  'Disagree',
  'Neutral',
  'Agree',
  'Strongly Agree',
]

/** Evaluate whether a question should be visible based on its branching config and current answers */
export function evaluateBranching(
  branching: BranchingConfig,
  answers: Record<string, unknown>
): boolean {
  const { condition_field, condition_value, condition_operator } = branching
  const fieldValue = answers[condition_field]

  if (fieldValue == null) return false

  const target = condition_value

  switch (condition_operator) {
    case 'equals':
      return String(fieldValue) === String(target)
    case 'not_equals':
      return String(fieldValue) !== String(target)
    case 'contains':
      return String(fieldValue).toLowerCase().includes(String(target).toLowerCase())
    case 'greater_than':
      return Number(fieldValue) > Number(target)
    case 'less_than':
      return Number(fieldValue) < Number(target)
    default:
      return true
  }
}
