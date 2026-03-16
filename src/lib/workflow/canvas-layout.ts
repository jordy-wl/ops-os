import type { WorkflowStep, WorkflowTemplate, DataInput, DataOutput } from './template-schema'
import type { Permission } from '@/lib/rbac/types'

/**
 * Canvas layout types — stored in workflow template metadata as `canvas_layout`.
 * React Flow node positions and edge connections for the visual builder.
 */

export interface CanvasNode {
  id: string
  type: 'trigger' | 'action' | 'condition' | 'wait' | 'input' | 'output' | 'task' | 'end'
  position: { x: number; y: number }
  data: {
    stepName?: string
    stepType?: WorkflowStep['type']
    label: string
    /** Step config stored here, maps to WorkflowStep fields */
    config: Record<string, unknown>
  }
}

export interface CanvasEdge {
  id: string
  source: string
  target: string
  /** For condition nodes: 'true' or 'false' branch */
  sourceHandle?: string
  /** Edge label — e.g. 'data' for data flow edges, undefined for control flow */
  label?: string
}

export interface CanvasLayout {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

// Default positions for auto-layout
const NODE_GAP_Y = 120
const START_X = 300
const START_Y = 50

/**
 * Convert a WorkflowTemplate's steps array into a canvas layout.
 * Creates a linear top-to-bottom flow. Users can then rearrange nodes.
 */
export function stepsToCanvas(template: WorkflowTemplate): CanvasLayout {
  const nodes: CanvasNode[] = []
  const edges: CanvasEdge[] = []

  // Trigger node (always first)
  const triggerId = 'trigger-0'
  nodes.push({
    id: triggerId,
    type: 'trigger',
    position: { x: START_X, y: START_Y },
    data: {
      label: template.trigger.type === 'manual' ? 'Manual Start' : `On: ${template.trigger.type === 'event' ? template.trigger.event_pattern : ''}`,
      config: { triggerType: template.trigger.type, ...(template.trigger.type === 'event' ? { event_pattern: template.trigger.event_pattern } : {}) },
    },
  })

  let prevId = triggerId

  // Data input nodes (placed to the left of the main flow)
  const dataInputs = template.data_inputs ?? []
  dataInputs.forEach((input, i) => {
    const nodeId = `input-${i}`
    nodes.push({
      id: nodeId,
      type: 'input',
      position: { x: START_X - 250, y: START_Y + (i + 1) * NODE_GAP_Y },
      data: {
        stepName: input.name,
        stepType: 'input',
        label: `Input: ${input.source_type}`,
        config: {
          source_type: input.source_type,
          description: input.description ?? '',
          ...(input.field_mappings ? { field_mappings: input.field_mappings } : {}),
          ...(input.payload_schema ? { payload_schema: input.payload_schema } : {}),
        },
      },
    })
  })

  // Step nodes
  template.steps.forEach((step, i) => {
    const nodeId = `step-${i}`
    const nodeType = stepTypeToNodeType(step.type)

    nodes.push({
      id: nodeId,
      type: nodeType,
      position: { x: START_X, y: START_Y + (i + 1) * NODE_GAP_Y },
      data: {
        stepName: step.name,
        stepType: step.type,
        label: stepToLabel(step),
        config: stepToConfig(step),
      },
    })

    edges.push({
      id: `edge-${prevId}-${nodeId}`,
      source: prevId,
      target: nodeId,
    })

    prevId = nodeId
  })

  // Data output nodes (placed to the right of the last step)
  const dataOutputs = template.data_outputs ?? []
  dataOutputs.forEach((output, i) => {
    const nodeId = `output-${i}`
    nodes.push({
      id: nodeId,
      type: 'output',
      position: { x: START_X + 250, y: START_Y + (template.steps.length) * NODE_GAP_Y + (i + 1) * NODE_GAP_Y },
      data: {
        stepName: output.name,
        stepType: 'output',
        label: `Output: ${output.output_type}`,
        config: {
          output_type: output.output_type,
          description: output.description ?? '',
          ...(output.field_mappings ? { field_mappings: output.field_mappings } : {}),
        },
      },
    })
  })

  return { nodes, edges }
}

/**
 * Convert canvas nodes + edges back into a WorkflowTemplate-compatible shape.
 * Returns the trigger and ordered steps array.
 */
export function canvasToTemplate(layout: CanvasLayout): {
  trigger: WorkflowTemplate['trigger']
  steps: WorkflowStep[]
  data_inputs?: DataInput[]
  data_outputs?: DataOutput[]
} {
  // Find the trigger node
  const triggerNode = layout.nodes.find((n) => n.type === 'trigger')
  if (!triggerNode) {
    return { trigger: { type: 'manual' }, steps: [] }
  }

  // Build trigger
  const triggerConfig = triggerNode.data.config
  const trigger: WorkflowTemplate['trigger'] =
    triggerConfig.triggerType === 'event' && typeof triggerConfig.event_pattern === 'string'
      ? { type: 'event', event_pattern: triggerConfig.event_pattern }
      : { type: 'manual' }

  // Topological sort: walk from trigger through edges
  const adjacency = new Map<string, string[]>()
  for (const edge of layout.edges) {
    const targets = adjacency.get(edge.source) ?? []
    targets.push(edge.target)
    adjacency.set(edge.source, targets)
  }

  const ordered: CanvasNode[] = []
  const visited = new Set<string>()
  const queue = [triggerNode.id]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)

    const node = layout.nodes.find((n) => n.id === current)
    if (node && node.type !== 'trigger' && node.type !== 'end' && node.type !== 'input' && node.type !== 'output') {
      ordered.push(node)
    }

    const targets = adjacency.get(current) ?? []
    for (const t of targets) {
      if (!visited.has(t)) queue.push(t)
    }
  }

  // Convert nodes to steps
  const steps: WorkflowStep[] = ordered.map((node) => configToStep(node.data))

  // Extract data input/output nodes
  const inputNodes = layout.nodes.filter((n) => n.type === 'input')
  const outputNodes = layout.nodes.filter((n) => n.type === 'output')

  const data_inputs: DataInput[] = inputNodes.map((n) => ({
    name: n.data.stepName ?? `input_${Date.now()}`,
    source_type: (n.data.config.source_type as DataInput['source_type']) ?? 'block_fields',
    ...(n.data.config.description ? { description: String(n.data.config.description) } : {}),
    ...(Array.isArray(n.data.config.field_mappings) ? { field_mappings: n.data.config.field_mappings as Array<{ from: string; to: string }> } : {}),
    ...(n.data.config.payload_schema ? { payload_schema: n.data.config.payload_schema as Record<string, unknown> } : {}),
  }))

  const data_outputs: DataOutput[] = outputNodes.map((n) => ({
    name: n.data.stepName ?? `output_${Date.now()}`,
    output_type: (n.data.config.output_type as DataOutput['output_type']) ?? 'update_fields',
    ...(n.data.config.description ? { description: String(n.data.config.description) } : {}),
    ...(Array.isArray(n.data.config.field_mappings) ? { field_mappings: n.data.config.field_mappings as Array<{ from: string; to: string }> } : {}),
  }))

  return {
    trigger,
    steps,
    ...(data_inputs.length > 0 ? { data_inputs } : {}),
    ...(data_outputs.length > 0 ? { data_outputs } : {}),
  }
}

function stepTypeToNodeType(stepType: WorkflowStep['type']): CanvasNode['type'] {
  switch (stepType) {
    case 'condition':
      return 'condition'
    case 'wait':
      return 'wait'
    case 'input':
      return 'input'
    case 'output':
      return 'output'
    case 'generate_task':
      return 'task'
    default:
      return 'action'
  }
}

function stepToLabel(step: WorkflowStep): string {
  switch (step.type) {
    case 'emit_event':
      return `Emit: ${step.event_type ?? 'event'}`
    case 'run_action':
      return `Action: ${step.action_type ?? 'action'}`
    case 'wait':
      return `Wait ${step.wait_seconds ?? 0}s`
    case 'condition':
      return `If: ${step.condition ?? 'condition'}`
    case 'call_api':
      return `API: ${step.method ?? 'GET'} ${step.path ?? '/'}`
    case 'update_block':
      return 'Update Block'
    case 'input':
      return `Input: ${step.source_type ?? 'block_fields'}`
    case 'output':
      return `Output: ${step.output_type ?? 'update_fields'}`
    case 'generate_task':
      return step.task_form_schema?.title ?? 'Create Task'
    default:
      return step.name
  }
}

function stepToConfig(step: WorkflowStep): Record<string, unknown> {
  const config: Record<string, unknown> = {}
  if (step.event_type) config.event_type = step.event_type
  if (step.action_type) config.action_type = step.action_type
  if (step.wait_seconds != null) config.wait_seconds = step.wait_seconds
  if (step.condition) config.condition = step.condition
  if (step.connector_id) config.connector_id = step.connector_id
  if (step.method) config.method = step.method
  if (step.path) config.path = step.path
  if (step.body_template) config.body_template = step.body_template
  if (step.timeout_ms != null) config.timeout_ms = step.timeout_ms
  if (step.max_retries != null) config.max_retries = step.max_retries
  if (step.block_id) config.block_id = step.block_id
  if (step.fields) config.fields = step.fields
  // Routing fields (Sprint 4)
  if (step.routing_mode) config.routing_mode = step.routing_mode
  if (step.instructions) config.instructions = step.instructions
  if (step.required_permissions) config.required_permissions = step.required_permissions
  // Input/Output fields (Sprint 5)
  if (step.source_type) config.source_type = step.source_type
  if (step.output_type) config.output_type = step.output_type
  if (step.field_mappings) config.field_mappings = step.field_mappings
  if (step.payload_schema) config.payload_schema = step.payload_schema
  // Task fields (Phase 4)
  if (step.task_form_schema) config.task_form_schema = step.task_form_schema
  if (step.task_assign_to) config.task_assign_to = step.task_assign_to
  if (step.task_priority) config.task_priority = step.task_priority
  return config
}

function configToStep(data: CanvasNode['data']): WorkflowStep {
  const base = {
    name: data.stepName ?? `step_${Date.now()}`,
    type: data.stepType ?? 'emit_event' as WorkflowStep['type'],
  }

  const config = data.config
  return {
    ...base,
    ...(config.event_type ? { event_type: String(config.event_type) } : {}),
    ...(config.action_type ? { action_type: String(config.action_type) } : {}),
    ...(config.wait_seconds != null ? { wait_seconds: Number(config.wait_seconds) } : {}),
    ...(config.condition ? { condition: String(config.condition) } : {}),
    ...(config.connector_id ? { connector_id: String(config.connector_id) } : {}),
    ...(config.method ? { method: config.method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' } : {}),
    ...(config.path ? { path: String(config.path) } : {}),
    ...(config.body_template ? { body_template: String(config.body_template) } : {}),
    ...(config.timeout_ms != null ? { timeout_ms: Number(config.timeout_ms) } : {}),
    ...(config.max_retries != null ? { max_retries: Number(config.max_retries) } : {}),
    ...(config.block_id ? { block_id: String(config.block_id) } : {}),
    ...(config.fields ? { fields: config.fields as Record<string, unknown> } : {}),
    // Routing fields (Sprint 4)
    ...(config.routing_mode && config.routing_mode !== 'policy_default'
      ? { routing_mode: config.routing_mode as 'human_only' | 'ai_only' | 'hybrid' | 'escalation_chain' | 'policy_default' }
      : {}),
    ...(config.instructions ? { instructions: String(config.instructions) } : {}),
    ...(Array.isArray(config.required_permissions) && config.required_permissions.length > 0
      ? { required_permissions: config.required_permissions as Permission[] }
      : {}),
    // Input/Output fields (Sprint 5)
    ...(config.source_type ? { source_type: config.source_type as 'block_fields' | 'webhook' | 'api' } : {}),
    ...(config.output_type ? { output_type: config.output_type as 'update_fields' | 'api_call' | 'emit_event' | 'document' } : {}),
    ...(Array.isArray(config.field_mappings) ? { field_mappings: config.field_mappings as Array<{ from: string; to: string }> } : {}),
    ...(config.payload_schema ? { payload_schema: config.payload_schema as Record<string, unknown> } : {}),
    // Task fields (Phase 4)
    ...(config.task_form_schema ? { task_form_schema: config.task_form_schema } : {}),
    ...(config.task_assign_to ? { task_assign_to: config.task_assign_to as 'routing_engine' | 'specific_user' | 'role' } : {}),
    ...(config.task_priority ? { task_priority: config.task_priority as 'low' | 'medium' | 'high' | 'urgent' } : {}),
  }
}
