import type { WorkflowStep, WorkflowTemplate } from './template-schema'

/**
 * Canvas layout types — stored in workflow template metadata as `canvas_layout`.
 * React Flow node positions and edge connections for the visual builder.
 */

export interface CanvasNode {
  id: string
  type: 'trigger' | 'action' | 'condition' | 'wait' | 'end'
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

  return { nodes, edges }
}

/**
 * Convert canvas nodes + edges back into a WorkflowTemplate-compatible shape.
 * Returns the trigger and ordered steps array.
 */
export function canvasToTemplate(layout: CanvasLayout): {
  trigger: WorkflowTemplate['trigger']
  steps: WorkflowStep[]
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
    if (node && node.type !== 'trigger' && node.type !== 'end') {
      ordered.push(node)
    }

    const targets = adjacency.get(current) ?? []
    for (const t of targets) {
      if (!visited.has(t)) queue.push(t)
    }
  }

  // Convert nodes to steps
  const steps: WorkflowStep[] = ordered.map((node) => configToStep(node.data))

  return { trigger, steps }
}

function stepTypeToNodeType(stepType: WorkflowStep['type']): CanvasNode['type'] {
  switch (stepType) {
    case 'condition':
      return 'condition'
    case 'wait':
      return 'wait'
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
  }
}
