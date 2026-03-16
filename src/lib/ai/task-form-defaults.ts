/**
 * AI Task Form Defaults — generates a sensible task_form_schema when the
 * workflow builder leaves it empty. Uses Claude to infer appropriate fields
 * and decision buttons based on step context.
 */

import Anthropic from '@anthropic-ai/sdk'
import { logger } from '@/lib/logger'

export interface TaskFormSchemaDefaults {
  title: string
  fields: Array<{
    type: 'text' | 'textarea' | 'select' | 'number' | 'date' | 'checkbox'
    name: string
    label: string
    required: boolean
    options?: string[]
  }>
  actions: Array<{
    label: string
    value: string
    style: 'primary' | 'destructive' | 'outline' | 'secondary'
  }>
}

export interface TaskFormContext {
  /** Step name from workflow definition */
  stepName: string
  /** Block type the workflow applies to (e.g. 'client', 'deal') */
  appliesTo: string
  /** Source block name if available */
  sourceBlockName?: string
  /** Routing mode configured for this step */
  routingMode?: string
  /** Any instructions written for this step */
  instructions?: string
  /** Priority */
  priority?: string
}

const SYSTEM_PROMPT = `You are an operations workflow assistant. Given context about a workflow task step, generate a sensible default task form schema.

The form should be simple and focused — typically 2-4 fields and 2-3 action buttons. Think about what a human reviewer would need to see and decide.

Return ONLY valid JSON matching this exact shape:
{
  "title": "Short task title",
  "fields": [
    { "type": "select|text|textarea|number|date|checkbox", "name": "snake_case_name", "label": "Human Label", "required": true/false, "options": ["only for select type"] }
  ],
  "actions": [
    { "label": "Button Text", "value": "snake_case_value", "style": "primary|destructive|outline|secondary" }
  ]
}

Guidelines:
- Title should describe what the human needs to do (e.g., "Review Client Onboarding", "Approve Deal Terms")
- Include a decision dropdown (Approve/Reject/Request Changes) when the step name suggests review/approval
- Include a notes textarea for most tasks
- Action buttons should map to common decisions. Put the positive action first with "primary" style.
- Keep field names in snake_case
- Never generate more than 6 fields or 4 actions`

/**
 * Generate a default task_form_schema using Claude.
 * Returns null if AI is unavailable or fails (caller should fall back to empty schema).
 */
export async function generateTaskFormDefaults(
  context: TaskFormContext
): Promise<TaskFormSchemaDefaults | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    logger.warn('task-form-defaults', 'ai.no_api_key', {})
    return null
  }

  const userPrompt = [
    `Workflow step: "${context.stepName}"`,
    `Block type: ${context.appliesTo}`,
    context.sourceBlockName ? `Source record: ${context.sourceBlockName}` : null,
    context.routingMode ? `Routing: ${context.routingMode}` : null,
    context.priority ? `Priority: ${context.priority}` : null,
    context.instructions ? `Instructions: ${context.instructions}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      logger.warn('task-form-defaults', 'ai.no_json_in_response', { text_length: text.length })
      return null
    }

    const parsed = JSON.parse(jsonMatch[0]) as TaskFormSchemaDefaults

    // Basic validation
    if (!parsed.title || !Array.isArray(parsed.fields) || !Array.isArray(parsed.actions)) {
      logger.warn('task-form-defaults', 'ai.invalid_schema_shape', {})
      return null
    }

    logger.info('task-form-defaults', 'ai.generated_defaults', {
      step_name: context.stepName,
      field_count: parsed.fields.length,
      action_count: parsed.actions.length,
    })

    return parsed
  } catch (err) {
    logger.error('task-form-defaults', 'ai.generation_failed', {
      error: err instanceof Error ? err.message : 'Unknown error',
    })
    return null
  }
}

/**
 * Hardcoded fallback when AI is unavailable.
 * Returns a generic review form based on the step name.
 */
export function getFallbackTaskFormDefaults(context: TaskFormContext): TaskFormSchemaDefaults {
  const isReview = /review|approv|check|verify|confirm/i.test(context.stepName)
  const isAssign = /assign|route|delegate/i.test(context.stepName)

  if (isReview) {
    return {
      title: `Review: ${context.sourceBlockName || context.appliesTo}`,
      fields: [
        { type: 'select', name: 'decision', label: 'Decision', required: true, options: ['Approve', 'Reject', 'Request Changes'] },
        { type: 'textarea', name: 'notes', label: 'Notes', required: false },
      ],
      actions: [
        { label: 'Approve & Continue', value: 'approve', style: 'primary' },
        { label: 'Reject', value: 'reject', style: 'destructive' },
        { label: 'Request Changes', value: 'request_changes', style: 'outline' },
      ],
    }
  }

  if (isAssign) {
    return {
      title: `Assign: ${context.sourceBlockName || context.appliesTo}`,
      fields: [
        { type: 'text', name: 'assignee', label: 'Assign To', required: true },
        { type: 'textarea', name: 'notes', label: 'Notes', required: false },
      ],
      actions: [
        { label: 'Assign', value: 'assign', style: 'primary' },
        { label: 'Skip', value: 'skip', style: 'outline' },
      ],
    }
  }

  return {
    title: context.sourceBlockName
      ? `Task: ${context.sourceBlockName}`
      : `Complete: ${context.stepName.replace(/_/g, ' ')}`,
    fields: [
      { type: 'textarea', name: 'notes', label: 'Notes', required: false },
    ],
    actions: [
      { label: 'Complete', value: 'complete', style: 'primary' },
      { label: 'Skip', value: 'skip', style: 'outline' },
    ],
  }
}
