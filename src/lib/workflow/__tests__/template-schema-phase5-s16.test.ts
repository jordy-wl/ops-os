import { describe, it, expect } from 'vitest'
import { WorkflowTemplateSchema } from '../template-schema'

describe('WorkflowTemplateSchema — Phase 5 Sprint 16 extensions', () => {
  const baseTemplate = {
    applies_to_type: 'client',
    trigger: { type: 'manual' as const },
  }

  const newStepTypes = [
    'ai_analysis',
    'ai_classify',
    'ai_summarize',
    'ai_risk_assessment',
    'store_file',
  ] as const

  it.each(newStepTypes)('accepts %s step type', (stepType) => {
    const result = WorkflowTemplateSchema.safeParse({
      ...baseTemplate,
      steps: [{ name: 'test_step', type: stepType }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts ai_analysis with all config fields', () => {
    const result = WorkflowTemplateSchema.safeParse({
      ...baseTemplate,
      steps: [{
        name: 'analyze_deal',
        type: 'ai_analysis',
        ai_prompt: 'Analyze risk factors for this deal',
        ai_output_format: 'json',
        ai_max_tokens: 2048,
        ai_context_block_id: 'some-uuid',
      }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts ai_classify with categories', () => {
    const result = WorkflowTemplateSchema.safeParse({
      ...baseTemplate,
      steps: [{
        name: 'classify_lead',
        type: 'ai_classify',
        ai_categories: ['hot', 'warm', 'cold'],
        ai_prompt: 'Classify by engagement level',
      }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts ai_summarize with events flag', () => {
    const result = WorkflowTemplateSchema.safeParse({
      ...baseTemplate,
      steps: [{
        name: 'summarize_client',
        type: 'ai_summarize',
        ai_prompt: 'Executive summary',
        ai_include_events: true,
        ai_max_tokens: 512,
      }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts ai_risk_assessment with risk categories', () => {
    const result = WorkflowTemplateSchema.safeParse({
      ...baseTemplate,
      steps: [{
        name: 'assess_risk',
        type: 'ai_risk_assessment',
        ai_risk_categories: ['compliance', 'financial', 'operational'],
        ai_include_policies: true,
      }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts store_file with all config fields', () => {
    const result = WorkflowTemplateSchema.safeParse({
      ...baseTemplate,
      steps: [{
        name: 'save_report',
        type: 'store_file',
        file_content: 'report data',
        file_name: 'report.csv',
        file_bucket: 'exports',
        file_content_type: 'text/csv',
        file_path_prefix: 'monthly',
      }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid ai_output_format', () => {
    const result = WorkflowTemplateSchema.safeParse({
      ...baseTemplate,
      steps: [{
        name: 'bad_format',
        type: 'ai_analysis',
        ai_prompt: 'test',
        ai_output_format: 'xml',
      }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects ai_max_tokens above 4096', () => {
    const result = WorkflowTemplateSchema.safeParse({
      ...baseTemplate,
      steps: [{
        name: 'too_many_tokens',
        type: 'ai_analysis',
        ai_prompt: 'test',
        ai_max_tokens: 10000,
      }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects ai_categories with fewer than 2 items', () => {
    const result = WorkflowTemplateSchema.safeParse({
      ...baseTemplate,
      steps: [{
        name: 'too_few_cats',
        type: 'ai_classify',
        ai_categories: ['only_one'],
      }],
    })
    expect(result.success).toBe(false)
  })

  it('still accepts all 22 step types (13 original + 4 Sprint 15 + 5 Sprint 16)', () => {
    const allTypes = [
      'emit_event', 'run_action', 'wait', 'condition', 'call_api',
      'send_email', 'book_meeting', 'generate_document', 'update_block',
      'generate_task', 'run_sub_workflow', 'input', 'output',
      'create_edge', 'search_blocks', 'send_notification', 'create_shared_link',
      'ai_analysis', 'ai_classify', 'ai_summarize', 'ai_risk_assessment', 'store_file',
    ]
    for (const type of allTypes) {
      const result = WorkflowTemplateSchema.safeParse({
        ...baseTemplate,
        steps: [{ name: 'test_step', type }],
      })
      expect(result.success).toBe(true)
    }
  })
})
