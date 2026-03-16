import { z } from 'zod'
import { PERMISSIONS } from '@/lib/rbac/types'

/**
 * Zod schema for workflow template metadata.
 * Workflow templates are stored as Blocks with type `workflow_template`.
 * The block's metadata must conform to this shape.
 */

const TriggerSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('manual'),
  }),
  z.object({
    type: z.literal('event'),
    event_pattern: z.string().min(1).max(100),
  }),
  z.object({
    type: z.literal('webhook'),
    config: z.object({
      connector_id: z.string().uuid(),
      event_type_mapping: z.record(z.string()).optional(),
    }).optional(),
  }),
])

const StepSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z][a-z0-9_]*$/, 'Step name must be lowercase snake_case'),
  type: z.enum(['emit_event', 'run_action', 'wait', 'condition', 'call_api', 'send_email', 'book_meeting', 'generate_document', 'update_block', 'generate_task', 'run_sub_workflow', 'input', 'output']),
  event_type: z.string().min(1).max(100).optional(),
  action_type: z.string().min(1).max(100).optional(),
  wait_seconds: z.number().int().positive().optional(),
  condition: z.string().max(500).optional(),
  // call_api step fields
  connector_id: z.string().uuid().optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
  path: z.string().max(500).optional(),
  body_template: z.string().max(5000).optional(),
  timeout_ms: z.number().int().min(100).max(30000).optional(),
  max_retries: z.number().int().min(0).max(5).optional(),
  // update_block step fields
  block_id: z.string().max(500).optional(),
  fields: z.record(z.unknown()).optional(),
  // routing fields (Sprint 4)
  routing_mode: z.enum(['human_only', 'ai_only', 'hybrid', 'escalation_chain', 'policy_default']).optional(),
  instructions: z.string().max(5000).optional(),
  required_permissions: z.array(z.enum(PERMISSIONS)).optional(),
  // input/output fields (Sprint 5)
  source_type: z.enum(['block_fields', 'webhook', 'api']).optional(),
  output_type: z.enum(['update_fields', 'api_call', 'emit_event', 'document']).optional(),
  field_mappings: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
  payload_schema: z.record(z.unknown()).optional(),
  // generate_task step fields (Phase 4)
  task_form_schema: z.object({
    title: z.string().max(200).optional(),
    fields: z.array(z.object({
      type: z.enum(['text', 'textarea', 'select', 'number', 'date', 'checkbox']),
      name: z.string().min(1).max(100),
      label: z.string().max(200),
      required: z.boolean().optional(),
      options: z.array(z.string()).optional(),
      max_length: z.number().int().positive().optional(),
      source: z.string().max(200).optional(),
    })).max(20).optional(),
    actions: z.array(z.object({
      label: z.string().max(100),
      value: z.string().max(100),
      style: z.enum(['primary', 'destructive', 'outline', 'secondary']).optional(),
    })).max(10).optional(),
  }).optional(),
  task_assign_to: z.enum(['routing_engine', 'specific_user', 'role']).optional(),
  task_priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  // run_sub_workflow step fields (Phase 4)
  sub_workflow_template_id: z.string().uuid().optional(),
  wait_for_completion: z.boolean().optional(),
})

const DataInputSchema = z.object({
  name: z.string().min(1).max(100),
  source_type: z.enum(['block_fields', 'webhook', 'api']),
  description: z.string().max(500).optional(),
  field_mappings: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
  payload_schema: z.record(z.unknown()).optional(),
})

const DataOutputSchema = z.object({
  name: z.string().min(1).max(100),
  output_type: z.enum(['update_fields', 'api_call', 'emit_event', 'document']),
  description: z.string().max(500).optional(),
  field_mappings: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
})

export const WorkflowTemplateSchema = z.object({
  applies_to_type: z.string().min(1).max(50),
  trigger: TriggerSchema,
  steps: z.array(StepSchema).max(50),
  data_inputs: z.array(DataInputSchema).max(10).optional(),
  data_outputs: z.array(DataOutputSchema).max(10).optional(),
  description: z.string().max(500).optional(),
  canvas_layout: z.unknown().optional(),
})

export type WorkflowTemplate = z.infer<typeof WorkflowTemplateSchema>
export type WorkflowTrigger = z.infer<typeof TriggerSchema>
export type WorkflowStep = z.infer<typeof StepSchema>
export type DataInput = z.infer<typeof DataInputSchema>
export type DataOutput = z.infer<typeof DataOutputSchema>
