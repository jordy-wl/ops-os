import { describe, it, expect } from 'vitest'
import { WorkflowTemplateSchema } from '../template-schema'

describe('WorkflowTemplateSchema — Phase 5 extensions', () => {
  const baseTemplate = {
    applies_to_type: 'client',
    trigger: { type: 'manual' as const },
  }

  const newStepTypes = [
    'create_edge',
    'search_blocks',
    'send_notification',
    'create_shared_link',
  ] as const

  it.each(newStepTypes)('accepts %s step type', (stepType) => {
    const result = WorkflowTemplateSchema.safeParse({
      ...baseTemplate,
      steps: [{ name: 'test_step', type: stepType }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts create_edge with all config fields', () => {
    const result = WorkflowTemplateSchema.safeParse({
      ...baseTemplate,
      steps: [{
        name: 'link_blocks',
        type: 'create_edge',
        from_block_id: '{{context.source_block_id}}',
        to_block_id: 'some-uuid',
        edge_type: 'related',
      }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts search_blocks with all config fields', () => {
    const result = WorkflowTemplateSchema.safeParse({
      ...baseTemplate,
      steps: [{
        name: 'find_items',
        type: 'search_blocks',
        search_type: 'client',
        search_name: 'Thornfield',
        search_filters: { status: 'active' },
        search_limit: 20,
      }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts send_notification with all config fields', () => {
    const result = WorkflowTemplateSchema.safeParse({
      ...baseTemplate,
      steps: [{
        name: 'notify_team',
        type: 'send_notification',
        notification_title: 'Deal approved',
        notification_body: 'The deal has been approved.',
        notification_type: 'success',
        notification_user_id: 'user-123',
        notification_link: '/blocks/abc',
      }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts create_shared_link with all config fields', () => {
    const result = WorkflowTemplateSchema.safeParse({
      ...baseTemplate,
      steps: [{
        name: 'share_portal',
        type: 'create_shared_link',
        link_block_id: 'some-uuid',
        link_type: 'form',
        link_expires_hours: 48,
      }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid notification_type', () => {
    const result = WorkflowTemplateSchema.safeParse({
      ...baseTemplate,
      steps: [{
        name: 'bad_notify',
        type: 'send_notification',
        notification_type: 'critical',
      }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid link_type', () => {
    const result = WorkflowTemplateSchema.safeParse({
      ...baseTemplate,
      steps: [{
        name: 'bad_link',
        type: 'create_shared_link',
        link_type: 'download',
      }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects search_limit above 50', () => {
    const result = WorkflowTemplateSchema.safeParse({
      ...baseTemplate,
      steps: [{
        name: 'big_search',
        type: 'search_blocks',
        search_limit: 100,
      }],
    })
    expect(result.success).toBe(false)
  })

  it('still accepts all original 13 step types', () => {
    const originalTypes = [
      'emit_event', 'run_action', 'wait', 'condition', 'call_api',
      'send_email', 'book_meeting', 'generate_document', 'update_block',
      'generate_task', 'run_sub_workflow', 'input', 'output',
    ]
    for (const type of originalTypes) {
      const result = WorkflowTemplateSchema.safeParse({
        ...baseTemplate,
        steps: [{ name: 'test_step', type }],
      })
      expect(result.success).toBe(true)
    }
  })
})
