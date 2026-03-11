import { describe, it, expect } from 'vitest'
import { stepsToCanvas, canvasToTemplate, type CanvasLayout } from '../canvas-layout'
import type { WorkflowTemplate } from '../template-schema'

// ─── stepsToCanvas ──────────────────────────────────────────────────────────

describe('stepsToCanvas', () => {
  it('creates trigger node + step nodes from template', () => {
    const template: WorkflowTemplate = {
      applies_to_type: 'client',
      trigger: { type: 'manual' },
      steps: [
        { name: 'step_1', type: 'emit_event', event_type: 'onboarding.started' },
        { name: 'step_2', type: 'wait', wait_seconds: 30 },
      ],
    }

    const layout = stepsToCanvas(template)

    expect(layout.nodes).toHaveLength(3) // trigger + 2 steps
    expect(layout.edges).toHaveLength(2) // trigger→step_1, step_1→step_2

    // Trigger node
    expect(layout.nodes[0].type).toBe('trigger')
    expect(layout.nodes[0].data.label).toBe('Manual Start')
    expect(layout.nodes[0].data.config.triggerType).toBe('manual')

    // Step nodes
    expect(layout.nodes[1].type).toBe('action') // emit_event → action node
    expect(layout.nodes[1].data.stepName).toBe('step_1')
    expect(layout.nodes[1].data.stepType).toBe('emit_event')
    expect(layout.nodes[1].data.config.event_type).toBe('onboarding.started')

    expect(layout.nodes[2].type).toBe('wait')
    expect(layout.nodes[2].data.stepName).toBe('step_2')
    expect(layout.nodes[2].data.config.wait_seconds).toBe(30)
  })

  it('creates event trigger with event pattern', () => {
    const template: WorkflowTemplate = {
      applies_to_type: 'deal',
      trigger: { type: 'event', event_pattern: 'block.created' },
      steps: [{ name: 'notify', type: 'emit_event', event_type: 'deal.started' }],
    }

    const layout = stepsToCanvas(template)

    expect(layout.nodes[0].data.label).toBe('On: block.created')
    expect(layout.nodes[0].data.config.triggerType).toBe('event')
    expect(layout.nodes[0].data.config.event_pattern).toBe('block.created')
  })

  it('maps condition step to condition node type', () => {
    const template: WorkflowTemplate = {
      applies_to_type: 'client',
      trigger: { type: 'manual' },
      steps: [{ name: 'check', type: 'condition', condition: 'x > 5' }],
    }

    const layout = stepsToCanvas(template)

    expect(layout.nodes[1].type).toBe('condition')
    expect(layout.nodes[1].data.config.condition).toBe('x > 5')
  })

  it('maps call_api step to action node with config', () => {
    const template: WorkflowTemplate = {
      applies_to_type: 'client',
      trigger: { type: 'manual' },
      steps: [
        {
          name: 'api_call',
          type: 'call_api',
          connector_id: 'conn-123',
          method: 'POST',
          path: '/api/notify',
          body_template: '{"msg":"hello"}',
          timeout_ms: 5000,
          max_retries: 2,
        },
      ],
    }

    const layout = stepsToCanvas(template)

    expect(layout.nodes[1].type).toBe('action')
    expect(layout.nodes[1].data.stepType).toBe('call_api')
    expect(layout.nodes[1].data.config.connector_id).toBe('conn-123')
    expect(layout.nodes[1].data.config.method).toBe('POST')
    expect(layout.nodes[1].data.config.path).toBe('/api/notify')
    expect(layout.nodes[1].data.config.body_template).toBe('{"msg":"hello"}')
    expect(layout.nodes[1].data.config.timeout_ms).toBe(5000)
    expect(layout.nodes[1].data.config.max_retries).toBe(2)
  })

  it('produces linear top-to-bottom positions', () => {
    const template: WorkflowTemplate = {
      applies_to_type: 'client',
      trigger: { type: 'manual' },
      steps: [
        { name: 's1', type: 'emit_event', event_type: 'a' },
        { name: 's2', type: 'emit_event', event_type: 'b' },
        { name: 's3', type: 'emit_event', event_type: 'c' },
      ],
    }

    const layout = stepsToCanvas(template)

    // All nodes should share the same X position
    const xs = layout.nodes.map((n) => n.position.x)
    expect(new Set(xs).size).toBe(1)

    // Y positions should be strictly increasing
    for (let i = 1; i < layout.nodes.length; i++) {
      expect(layout.nodes[i].position.y).toBeGreaterThan(layout.nodes[i - 1].position.y)
    }
  })

  it('handles empty steps array', () => {
    const template: WorkflowTemplate = {
      applies_to_type: 'client',
      trigger: { type: 'manual' },
      steps: [],
    }

    const layout = stepsToCanvas(template)

    expect(layout.nodes).toHaveLength(1) // trigger only
    expect(layout.edges).toHaveLength(0)
  })
})

// ─── canvasToTemplate ───────────────────────────────────────────────────────

describe('canvasToTemplate', () => {
  it('converts canvas with manual trigger to template', () => {
    const layout: CanvasLayout = {
      nodes: [
        {
          id: 'trigger-0',
          type: 'trigger',
          position: { x: 300, y: 50 },
          data: { label: 'Manual Start', config: { triggerType: 'manual' } },
        },
        {
          id: 'step-0',
          type: 'action',
          position: { x: 300, y: 170 },
          data: {
            stepName: 'notify',
            stepType: 'emit_event',
            label: 'Emit: started',
            config: { event_type: 'started' },
          },
        },
      ],
      edges: [{ id: 'e-0', source: 'trigger-0', target: 'step-0' }],
    }

    const result = canvasToTemplate(layout)

    expect(result.trigger).toEqual({ type: 'manual' })
    expect(result.steps).toHaveLength(1)
    expect(result.steps[0].name).toBe('notify')
    expect(result.steps[0].type).toBe('emit_event')
    expect(result.steps[0].event_type).toBe('started')
  })

  it('converts canvas with event trigger', () => {
    const layout: CanvasLayout = {
      nodes: [
        {
          id: 'trigger-0',
          type: 'trigger',
          position: { x: 300, y: 50 },
          data: {
            label: 'On: block.created',
            config: { triggerType: 'event', event_pattern: 'block.created' },
          },
        },
      ],
      edges: [],
    }

    const result = canvasToTemplate(layout)

    expect(result.trigger).toEqual({ type: 'event', event_pattern: 'block.created' })
    expect(result.steps).toHaveLength(0)
  })

  it('orders steps by following edges from trigger', () => {
    const layout: CanvasLayout = {
      nodes: [
        {
          id: 'trigger-0',
          type: 'trigger',
          position: { x: 300, y: 50 },
          data: { label: 'Manual', config: { triggerType: 'manual' } },
        },
        {
          id: 'step-b',
          type: 'action',
          position: { x: 300, y: 290 },
          data: { stepName: 'second', stepType: 'emit_event', label: 'B', config: { event_type: 'b' } },
        },
        {
          id: 'step-a',
          type: 'action',
          position: { x: 300, y: 170 },
          data: { stepName: 'first', stepType: 'run_action', label: 'A', config: { action_type: 'a' } },
        },
      ],
      edges: [
        { id: 'e-1', source: 'trigger-0', target: 'step-a' },
        { id: 'e-2', source: 'step-a', target: 'step-b' },
      ],
    }

    const result = canvasToTemplate(layout)

    // Should follow edge order, not array order
    expect(result.steps).toHaveLength(2)
    expect(result.steps[0].name).toBe('first')
    expect(result.steps[0].type).toBe('run_action')
    expect(result.steps[1].name).toBe('second')
    expect(result.steps[1].type).toBe('emit_event')
  })

  it('returns default trigger when no trigger node exists', () => {
    const layout: CanvasLayout = {
      nodes: [
        {
          id: 'step-0',
          type: 'action',
          position: { x: 300, y: 170 },
          data: { stepName: 'orphan', stepType: 'emit_event', label: 'Orphan', config: {} },
        },
      ],
      edges: [],
    }

    const result = canvasToTemplate(layout)

    expect(result.trigger).toEqual({ type: 'manual' })
    expect(result.steps).toHaveLength(0) // orphan nodes not reachable from trigger
  })

  it('skips end nodes in step conversion', () => {
    const layout: CanvasLayout = {
      nodes: [
        {
          id: 'trigger-0',
          type: 'trigger',
          position: { x: 300, y: 50 },
          data: { label: 'Manual', config: { triggerType: 'manual' } },
        },
        {
          id: 'step-0',
          type: 'action',
          position: { x: 300, y: 170 },
          data: { stepName: 'do_thing', stepType: 'emit_event', label: 'Do', config: { event_type: 'done' } },
        },
        {
          id: 'end-0',
          type: 'end',
          position: { x: 300, y: 290 },
          data: { label: 'End', config: {} },
        },
      ],
      edges: [
        { id: 'e-1', source: 'trigger-0', target: 'step-0' },
        { id: 'e-2', source: 'step-0', target: 'end-0' },
      ],
    }

    const result = canvasToTemplate(layout)

    expect(result.steps).toHaveLength(1) // end node excluded
    expect(result.steps[0].name).toBe('do_thing')
  })

  it('converts condition and wait nodes correctly', () => {
    const layout: CanvasLayout = {
      nodes: [
        {
          id: 'trigger-0',
          type: 'trigger',
          position: { x: 300, y: 50 },
          data: { label: 'Manual', config: { triggerType: 'manual' } },
        },
        {
          id: 'step-0',
          type: 'condition',
          position: { x: 300, y: 170 },
          data: { stepName: 'check_approval', stepType: 'condition', label: 'Check', config: { condition: 'approved === true' } },
        },
        {
          id: 'step-1',
          type: 'wait',
          position: { x: 300, y: 290 },
          data: { stepName: 'delay', stepType: 'wait', label: 'Wait', config: { wait_seconds: 3600 } },
        },
      ],
      edges: [
        { id: 'e-1', source: 'trigger-0', target: 'step-0' },
        { id: 'e-2', source: 'step-0', target: 'step-1' },
      ],
    }

    const result = canvasToTemplate(layout)

    expect(result.steps[0].type).toBe('condition')
    expect(result.steps[0].condition).toBe('approved === true')
    expect(result.steps[1].type).toBe('wait')
    expect(result.steps[1].wait_seconds).toBe(3600)
  })

  it('converts call_api nodes with all config fields', () => {
    const layout: CanvasLayout = {
      nodes: [
        {
          id: 'trigger-0',
          type: 'trigger',
          position: { x: 300, y: 50 },
          data: { label: 'Manual', config: { triggerType: 'manual' } },
        },
        {
          id: 'step-0',
          type: 'action',
          position: { x: 300, y: 170 },
          data: {
            stepName: 'call_external',
            stepType: 'call_api',
            label: 'API Call',
            config: {
              connector_id: 'conn-abc',
              method: 'PUT',
              path: '/update',
              body_template: '{}',
              timeout_ms: 10000,
              max_retries: 3,
            },
          },
        },
      ],
      edges: [{ id: 'e-1', source: 'trigger-0', target: 'step-0' }],
    }

    const result = canvasToTemplate(layout)

    expect(result.steps[0]).toMatchObject({
      name: 'call_external',
      type: 'call_api',
      connector_id: 'conn-abc',
      method: 'PUT',
      path: '/update',
      body_template: '{}',
      timeout_ms: 10000,
      max_retries: 3,
    })
  })

  it('maps update_block step to action node with block_id and fields', () => {
    const template: WorkflowTemplate = {
      applies_to_type: 'client',
      trigger: { type: 'manual' },
      steps: [
        {
          name: 'update_status',
          type: 'update_block',
          block_id: '{{context.source_block_id}}',
          fields: { status: 'active', priority: 'high' },
        },
      ],
    }

    const layout = stepsToCanvas(template)

    expect(layout.nodes[1].type).toBe('action')
    expect(layout.nodes[1].data.stepType).toBe('update_block')
    expect(layout.nodes[1].data.label).toBe('Update Block')
    expect(layout.nodes[1].data.config.block_id).toBe('{{context.source_block_id}}')
    expect(layout.nodes[1].data.config.fields).toEqual({ status: 'active', priority: 'high' })
  })

  it('converts update_block canvas node back to step', () => {
    const layout: CanvasLayout = {
      nodes: [
        {
          id: 'trigger-0',
          type: 'trigger',
          position: { x: 300, y: 50 },
          data: { label: 'Manual', config: { triggerType: 'manual' } },
        },
        {
          id: 'step-0',
          type: 'action',
          position: { x: 300, y: 170 },
          data: {
            stepName: 'update_client',
            stepType: 'update_block',
            label: 'Update Block',
            config: {
              block_id: 'block-123',
              fields: { onboarded: true },
            },
          },
        },
      ],
      edges: [{ id: 'e-1', source: 'trigger-0', target: 'step-0' }],
    }

    const result = canvasToTemplate(layout)

    expect(result.steps).toHaveLength(1)
    expect(result.steps[0]).toMatchObject({
      name: 'update_client',
      type: 'update_block',
      block_id: 'block-123',
      fields: { onboarded: true },
    })
  })
})

// ─── Round-trip ─────────────────────────────────────────────────────────────

describe('round-trip: stepsToCanvas → canvasToTemplate', () => {
  it('preserves template data through serialization round-trip', () => {
    const original: WorkflowTemplate = {
      applies_to_type: 'client',
      trigger: { type: 'event', event_pattern: 'client.onboarded' },
      steps: [
        { name: 'emit_welcome', type: 'emit_event', event_type: 'welcome.sent' },
        { name: 'wait_review', type: 'wait', wait_seconds: 86400 },
        { name: 'check_status', type: 'condition', condition: 'status === "active"' },
        { name: 'notify', type: 'run_action', action_type: 'send_notification' },
      ],
    }

    const layout = stepsToCanvas(original)
    const result = canvasToTemplate(layout)

    expect(result.trigger).toEqual(original.trigger)
    expect(result.steps).toHaveLength(original.steps.length)

    // Verify each step
    for (let i = 0; i < original.steps.length; i++) {
      expect(result.steps[i].name).toBe(original.steps[i].name)
      expect(result.steps[i].type).toBe(original.steps[i].type)
    }

    // Verify specific config round-trips
    expect(result.steps[0].event_type).toBe('welcome.sent')
    expect(result.steps[1].wait_seconds).toBe(86400)
    expect(result.steps[2].condition).toBe('status === "active"')
    expect(result.steps[3].action_type).toBe('send_notification')
  })

  it('preserves call_api config through round-trip', () => {
    const original: WorkflowTemplate = {
      applies_to_type: 'deal',
      trigger: { type: 'manual' },
      steps: [
        {
          name: 'api_call',
          type: 'call_api',
          connector_id: 'uuid-here',
          method: 'POST',
          path: '/webhook',
          body_template: '{"data": "{{block.name}}"}',
          timeout_ms: 15000,
          max_retries: 1,
        },
      ],
    }

    const layout = stepsToCanvas(original)
    const result = canvasToTemplate(layout)

    expect(result.steps[0]).toMatchObject({
      name: 'api_call',
      type: 'call_api',
      connector_id: 'uuid-here',
      method: 'POST',
      path: '/webhook',
      body_template: '{"data": "{{block.name}}"}',
      timeout_ms: 15000,
      max_retries: 1,
    })
  })

  it('preserves update_block config through round-trip', () => {
    const original: WorkflowTemplate = {
      applies_to_type: 'client',
      trigger: { type: 'manual' },
      steps: [
        {
          name: 'set_status',
          type: 'update_block',
          block_id: '{{context.source_block_id}}',
          fields: { status: 'onboarded', onboarded_at: '2026-01-01' },
        },
      ],
    }

    const layout = stepsToCanvas(original)
    const result = canvasToTemplate(layout)

    expect(result.steps[0]).toMatchObject({
      name: 'set_status',
      type: 'update_block',
      block_id: '{{context.source_block_id}}',
      fields: { status: 'onboarded', onboarded_at: '2026-01-01' },
    })
  })
})
