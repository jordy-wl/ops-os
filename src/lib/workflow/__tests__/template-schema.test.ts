import { describe, it, expect } from 'vitest'
import { WorkflowTemplateSchema } from '../template-schema'

// ─── Template Schema Validation (Sprint 5: DataInput/DataOutput) ────────────

describe('WorkflowTemplateSchema', () => {
  const baseTemplate = {
    applies_to_type: 'client',
    trigger: { type: 'manual' as const },
    steps: [],
  }

  it('validates a minimal template', () => {
    const result = WorkflowTemplateSchema.safeParse(baseTemplate)
    expect(result.success).toBe(true)
  })

  it('validates template with data_inputs', () => {
    const result = WorkflowTemplateSchema.safeParse({
      ...baseTemplate,
      data_inputs: [
        { name: 'webhook_data', source_type: 'webhook', description: 'Incoming webhook' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('validates template with data_outputs', () => {
    const result = WorkflowTemplateSchema.safeParse({
      ...baseTemplate,
      data_outputs: [
        { name: 'result', output_type: 'api_call', description: 'Send result' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('validates template with field_mappings in inputs', () => {
    const result = WorkflowTemplateSchema.safeParse({
      ...baseTemplate,
      data_inputs: [
        {
          name: 'mapped_input',
          source_type: 'api',
          field_mappings: [
            { from: 'external_id', to: 'block_id' },
            { from: 'name', to: 'display_name' },
          ],
          payload_schema: { type: 'object', properties: { id: { type: 'string' } } },
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('validates template with field_mappings in outputs', () => {
    const result = WorkflowTemplateSchema.safeParse({
      ...baseTemplate,
      data_outputs: [
        {
          name: 'doc_gen',
          output_type: 'document',
          field_mappings: [{ from: 'deal_name', to: 'title' }],
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects data_input with invalid source_type', () => {
    const result = WorkflowTemplateSchema.safeParse({
      ...baseTemplate,
      data_inputs: [
        { name: 'bad', source_type: 'invalid_source' },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('rejects data_output with invalid output_type', () => {
    const result = WorkflowTemplateSchema.safeParse({
      ...baseTemplate,
      data_outputs: [
        { name: 'bad', output_type: 'invalid_output' },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('rejects data_input with empty name', () => {
    const result = WorkflowTemplateSchema.safeParse({
      ...baseTemplate,
      data_inputs: [
        { name: '', source_type: 'webhook' },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('rejects data_input with name exceeding 100 chars', () => {
    const result = WorkflowTemplateSchema.safeParse({
      ...baseTemplate,
      data_inputs: [
        { name: 'a'.repeat(101), source_type: 'webhook' },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('rejects data_output description exceeding 500 chars', () => {
    const result = WorkflowTemplateSchema.safeParse({
      ...baseTemplate,
      data_outputs: [
        { name: 'test', output_type: 'emit_event', description: 'x'.repeat(501) },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('enforces max 10 data_inputs', () => {
    const result = WorkflowTemplateSchema.safeParse({
      ...baseTemplate,
      data_inputs: Array.from({ length: 11 }, (_, i) => ({
        name: `input_${i}`,
        source_type: 'block_fields',
      })),
    })
    expect(result.success).toBe(false)
  })

  it('enforces max 10 data_outputs', () => {
    const result = WorkflowTemplateSchema.safeParse({
      ...baseTemplate,
      data_outputs: Array.from({ length: 11 }, (_, i) => ({
        name: `output_${i}`,
        output_type: 'update_fields',
      })),
    })
    expect(result.success).toBe(false)
  })

  it('allows all valid source_type values', () => {
    for (const source_type of ['block_fields', 'webhook', 'api']) {
      const result = WorkflowTemplateSchema.safeParse({
        ...baseTemplate,
        data_inputs: [{ name: 'test', source_type }],
      })
      expect(result.success).toBe(true)
    }
  })

  it('allows all valid output_type values', () => {
    for (const output_type of ['update_fields', 'api_call', 'emit_event', 'document']) {
      const result = WorkflowTemplateSchema.safeParse({
        ...baseTemplate,
        data_outputs: [{ name: 'test', output_type }],
      })
      expect(result.success).toBe(true)
    }
  })

  it('validates step with input type and source_type', () => {
    const result = WorkflowTemplateSchema.safeParse({
      ...baseTemplate,
      steps: [
        { name: 'data_in', type: 'input', source_type: 'webhook' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('validates step with output type and output_type', () => {
    const result = WorkflowTemplateSchema.safeParse({
      ...baseTemplate,
      steps: [
        { name: 'data_out', type: 'output', output_type: 'document' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('validates step with field_mappings', () => {
    const result = WorkflowTemplateSchema.safeParse({
      ...baseTemplate,
      steps: [
        {
          name: 'mapped_step',
          type: 'input',
          source_type: 'api',
          field_mappings: [{ from: 'a', to: 'b' }],
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('validates step with payload_schema', () => {
    const result = WorkflowTemplateSchema.safeParse({
      ...baseTemplate,
      steps: [
        {
          name: 'schema_step',
          type: 'input',
          source_type: 'webhook',
          payload_schema: { type: 'object', properties: { id: { type: 'string' } } },
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('data_inputs and data_outputs are optional (backward compatible)', () => {
    const result = WorkflowTemplateSchema.safeParse({
      applies_to_type: 'client',
      trigger: { type: 'manual' },
      steps: [{ name: 'step_1', type: 'emit_event', event_type: 'test' }],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.data_inputs).toBeUndefined()
      expect(result.data.data_outputs).toBeUndefined()
    }
  })
})
