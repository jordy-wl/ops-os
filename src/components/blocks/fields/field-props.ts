/** Shared props interface for all field components */
export interface FieldComponentProps {
  name: string
  value: unknown
  onChange: (value: unknown) => void
  /** JSON Schema property definition */
  fieldDef: Record<string, unknown>
  mode: 'edit' | 'view'
  required?: boolean
  error?: string
}
