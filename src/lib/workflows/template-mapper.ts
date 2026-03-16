export interface WorkflowTemplateItem {
  id: string
  name: string
  applies_to_type: string
  trigger_type: string
  trigger_event_pattern?: string
  step_count: number
  description?: string
  created_at: string
}

export function mapBlockToTemplate(block: Record<string, unknown>): WorkflowTemplateItem {
  const meta = (block.metadata ?? {}) as Record<string, unknown>
  const trigger = (meta.trigger ?? {}) as Record<string, unknown>
  const steps = (meta.steps ?? []) as unknown[]
  return {
    id: block.id as string,
    name: block.name as string,
    applies_to_type: (meta.applies_to_type as string) ?? 'unknown',
    trigger_type: (trigger.type as string) ?? 'manual',
    trigger_event_pattern: trigger.event_pattern as string | undefined,
    step_count: steps.length,
    description: (meta.description as string) ?? undefined,
    created_at: block.created_at as string,
  }
}
