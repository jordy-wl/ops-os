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
  type: z.enum([
    'emit_event', 'run_action', 'wait', 'condition', 'call_api', 'send_email', 'book_meeting',
    'generate_document', 'update_block', 'generate_task', 'run_sub_workflow', 'input', 'output',
    // Phase 5 Sprint 15: Data Operations + Human Interaction
    'create_edge', 'search_blocks', 'send_notification', 'create_shared_link',
    // Phase 5 Sprint 16: AI + External
    'ai_analysis', 'ai_classify', 'ai_summarize', 'ai_risk_assessment', 'store_file',
    // Phase 6 Sprint 23: Route + For Each
    'route', 'for_each',
    // Phase 7: Portal provisioning
    'provision_portal',
  ]),
  event_type: z.string().min(1).max(100).optional(),
  action_type: z.string().min(1).max(100).optional(),
  wait_seconds: z.number().int().positive().optional(),
  condition: z.string().max(500).optional(),
  // condition_value: structured condition from ConditionBuilder (Phase 6 Sprint 23)
  condition_value: z.object({
    mode: z.enum(['simple', 'compound', 'advanced']),
    simple: z.object({
      field: z.string(),
      operator: z.enum(['is', 'is_not', 'contains', 'not_contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty']),
      value: z.string(),
    }).optional(),
    compound: z.object({
      logic: z.enum(['and', 'or']),
      conditions: z.array(z.object({
        field: z.string(),
        operator: z.enum(['is', 'is_not', 'contains', 'not_contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty']),
        value: z.string(),
      })),
    }).optional(),
    advanced: z.string().optional(),
  }).optional(),
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
  // create_edge step fields (Phase 5)
  from_block_id: z.string().max(500).optional(),
  to_block_id: z.string().max(500).optional(),
  edge_type: z.string().max(100).optional(),
  // search_blocks step fields (Phase 5)
  search_type: z.string().max(100).optional(),
  search_name: z.string().max(200).optional(),
  search_filters: z.record(z.unknown()).optional(),
  search_limit: z.number().int().min(1).max(50).optional(),
  // send_notification step fields (Phase 5)
  notification_title: z.string().max(200).optional(),
  notification_body: z.string().max(2000).optional(),
  notification_type: z.enum(['info', 'warning', 'success', 'error']).optional(),
  notification_user_id: z.string().max(200).optional(),
  notification_link: z.string().max(500).optional(),
  // create_shared_link step fields (Phase 5)
  link_block_id: z.string().max(500).optional(),
  link_type: z.enum(['view', 'form', 'sign', 'portal']).optional(),
  link_expires_hours: z.number().int().min(1).max(8760).optional(),
  // AI step fields (Phase 5 Sprint 16)
  ai_prompt: z.string().max(5000).optional(),
  ai_output_format: z.enum(['json', 'text']).optional(),
  ai_max_tokens: z.number().int().min(64).max(4096).optional(),
  ai_context_block_id: z.string().max(500).optional(),
  ai_categories: z.array(z.string().max(100)).min(2).max(20).optional(),
  ai_include_events: z.boolean().optional(),
  ai_risk_categories: z.array(z.string().max(100)).max(10).optional(),
  ai_include_policies: z.boolean().optional(),
  // store_file step fields (Phase 5 Sprint 16)
  file_content: z.string().max(100000).optional(),
  file_name: z.string().max(200).optional(),
  file_bucket: z.string().max(100).optional(),
  file_content_type: z.string().max(100).optional(),
  file_path_prefix: z.string().max(200).optional(),
  // route step fields (Phase 6 Sprint 23)
  route_field: z.string().max(200).optional(),
  route_branches: z.array(z.object({
    value: z.string().max(200),
    label: z.string().max(200).optional(),
  })).max(20).optional(),
  route_default_label: z.string().max(200).optional(),
  route_branch_targets: z.record(z.string()).optional(),
  // for_each step fields (Phase 6 Sprint 23)
  for_each_source: z.string().max(200).optional(),
  for_each_max_parallel: z.number().int().min(1).max(25).optional(),
  for_each_max_iterations: z.number().int().min(1).max(1000).optional(),
  portal_config_id: z.string().uuid().optional(),
  // provision_portal step fields (Phase 7)
  portal_name: z.string().max(255).optional(),
  portal_expires_hours: z.number().int().min(1).max(8760).optional(),
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
  // Workflow-level completion behavior (Phase 6 Sprint 23)
  completion_behavior: z.enum(['none', 'restart_after_delay', 'trigger_workflow']).optional(),
  completion_delay_seconds: z.number().int().positive().optional(),
  completion_trigger_template_id: z.string().uuid().optional(),
})

export type WorkflowTemplate = z.infer<typeof WorkflowTemplateSchema>
export type WorkflowTrigger = z.infer<typeof TriggerSchema>
export type WorkflowStep = z.infer<typeof StepSchema>
export type DataInput = z.infer<typeof DataInputSchema>
export type DataOutput = z.infer<typeof DataOutputSchema>
