import { describe, it, expect } from 'vitest'
import { resolveHandler, getRegisteredTypes } from '../registry'

describe('step handler registry', () => {
  it('has 22 registered step types', () => {
    const types = getRegisteredTypes()
    expect(types.length).toBe(22)
  })

  it('includes Phase 6 Sprint 23 step types', () => {
    const types = getRegisteredTypes()
    expect(types).toContain('route')
    expect(types).toContain('for_each')
  })

  it('includes all original step types', () => {
    const types = getRegisteredTypes()
    const originals = [
      'emit_event', 'run_action', 'wait', 'condition', 'call_api',
      'send_email', 'book_meeting', 'generate_document', 'update_block',
      'generate_task', 'run_sub_workflow',
    ]
    for (const t of originals) {
      expect(types).toContain(t)
    }
  })

  it('includes Phase 5 Sprint 15 step types', () => {
    const types = getRegisteredTypes()
    expect(types).toContain('create_edge')
    expect(types).toContain('search_blocks')
    expect(types).toContain('send_notification')
    expect(types).toContain('create_shared_link')
  })

  it('includes Phase 5 Sprint 16 step types', () => {
    const types = getRegisteredTypes()
    expect(types).toContain('ai_analysis')
    expect(types).toContain('ai_classify')
    expect(types).toContain('ai_summarize')
    expect(types).toContain('ai_risk_assessment')
    expect(types).toContain('store_file')
  })

  it('resolves known handler', async () => {
    const handler = await resolveHandler('emit_event')
    expect(handler).toBeTypeOf('function')
  })

  it('resolves Phase 5 handlers', async () => {
    const edge = await resolveHandler('create_edge')
    expect(edge).toBeTypeOf('function')

    const search = await resolveHandler('search_blocks')
    expect(search).toBeTypeOf('function')

    const notify = await resolveHandler('send_notification')
    expect(notify).toBeTypeOf('function')

    const shared = await resolveHandler('create_shared_link')
    expect(shared).toBeTypeOf('function')
  })

  it('returns null for unknown type', async () => {
    const handler = await resolveHandler('nonexistent_type')
    expect(handler).toBeNull()
  })

  it('caches resolved handlers', async () => {
    const first = await resolveHandler('condition')
    const second = await resolveHandler('condition')
    expect(first).toBe(second)
  })
})
