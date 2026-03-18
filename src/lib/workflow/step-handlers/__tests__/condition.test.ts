import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WorkflowStep } from '../../template-schema'
import type { InstanceMetadata } from '../types'

// ─── Mock Supabase ──────────────────────────────────────────────────────────

function createMockSupabase(blockData?: Record<string, unknown>) {
  const defaultBlock = {
    type: 'client',
    name: 'Acme Corp',
    metadata: {
      status: 'approved',
      amount: '5000',
      priority: 'high',
      nested: { level: 'deep' },
    },
  }

  const singleResult = {
    data: blockData ?? defaultBlock,
    error: null,
  }

  function makeChain(): Record<string, unknown> {
    const chain: Record<string, unknown> = {}
    const self = () => chain
    chain.eq = vi.fn(self)
    chain.select = vi.fn(self)
    chain.single = vi.fn().mockResolvedValue(singleResult)
    return chain
  }

  return {
    from: vi.fn().mockReturnValue(makeChain()),
  }
}

function createMockSupabaseNoBlock() {
  function makeChain(): Record<string, unknown> {
    const chain: Record<string, unknown> = {}
    const self = () => chain
    chain.eq = vi.fn(self)
    chain.select = vi.fn(self)
    chain.single = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    return chain
  }

  return {
    from: vi.fn().mockReturnValue(makeChain()),
  }
}

const META: InstanceMetadata = {
  template_id: 'tpl-1',
  source_block_id: 'block-source',
  applies_to_type: 'client',
  status: 'running',
  current_step_index: 2,
  step_results: [
    {
      step_name: 'previous_step',
      step_type: 'run_action',
      status: 'completed',
      output: { result_value: 'hello', score: '85' },
      executed_at: '2026-01-01T00:00:00Z',
    },
  ],
  started_at: '2026-01-01T00:00:00Z',
  completed_at: null,
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Operator Unit Tests ────────────────────────────────────────────────────

describe('evaluateOperator', () => {
  let evaluateOperator: typeof import('../condition')['evaluateOperator']

  beforeEach(async () => {
    evaluateOperator = (await import('../condition')).evaluateOperator
  })

  it('is: strict string equality', () => {
    expect(evaluateOperator('is', 'approved', 'approved')).toBe(true)
    expect(evaluateOperator('is', 'approved', 'pending')).toBe(false)
    expect(evaluateOperator('is', '', '')).toBe(true)
  })

  it('is_not: strict string inequality', () => {
    expect(evaluateOperator('is_not', 'approved', 'pending')).toBe(true)
    expect(evaluateOperator('is_not', 'approved', 'approved')).toBe(false)
  })

  it('contains: string includes', () => {
    expect(evaluateOperator('contains', 'hello world', 'world')).toBe(true)
    expect(evaluateOperator('contains', 'hello', 'world')).toBe(false)
    expect(evaluateOperator('contains', '', '')).toBe(true)
  })

  it('not_contains: string does not include', () => {
    expect(evaluateOperator('not_contains', 'hello', 'world')).toBe(true)
    expect(evaluateOperator('not_contains', 'hello world', 'world')).toBe(false)
  })

  it('greater_than: numeric comparison', () => {
    expect(evaluateOperator('greater_than', '100', '50')).toBe(true)
    expect(evaluateOperator('greater_than', '50', '100')).toBe(false)
    expect(evaluateOperator('greater_than', '50', '50')).toBe(false)
  })

  it('greater_than: returns false for non-numeric', () => {
    expect(evaluateOperator('greater_than', 'abc', '50')).toBe(false)
    expect(evaluateOperator('greater_than', '50', 'abc')).toBe(false)
  })

  it('less_than: numeric comparison', () => {
    expect(evaluateOperator('less_than', '50', '100')).toBe(true)
    expect(evaluateOperator('less_than', '100', '50')).toBe(false)
    expect(evaluateOperator('less_than', '50', '50')).toBe(false)
  })

  it('less_than: returns false for non-numeric', () => {
    expect(evaluateOperator('less_than', 'abc', '50')).toBe(false)
  })

  it('is_empty: true for empty string', () => {
    expect(evaluateOperator('is_empty', '', '')).toBe(true)
    expect(evaluateOperator('is_empty', 'something', '')).toBe(false)
  })

  it('is_not_empty: true for non-empty string', () => {
    expect(evaluateOperator('is_not_empty', 'something', '')).toBe(true)
    expect(evaluateOperator('is_not_empty', '', '')).toBe(false)
  })
})

// ─── Truthiness Unit Tests ──────────────────────────────────────────────────

describe('evaluateTruthiness', () => {
  let evaluateTruthiness: typeof import('../condition')['evaluateTruthiness']

  beforeEach(async () => {
    evaluateTruthiness = (await import('../condition')).evaluateTruthiness
  })

  it('returns false for empty string', () => {
    expect(evaluateTruthiness('')).toBe(false)
    expect(evaluateTruthiness('   ')).toBe(false)
  })

  it('returns false for falsy literals', () => {
    expect(evaluateTruthiness('false')).toBe(false)
    expect(evaluateTruthiness('False')).toBe(false)
    expect(evaluateTruthiness('0')).toBe(false)
    expect(evaluateTruthiness('null')).toBe(false)
    expect(evaluateTruthiness('undefined')).toBe(false)
  })

  it('evaluates strict equality (===)', () => {
    expect(evaluateTruthiness('approved === approved')).toBe(true)
    expect(evaluateTruthiness('approved === pending')).toBe(false)
    expect(evaluateTruthiness('approved === "approved"')).toBe(true)
    expect(evaluateTruthiness('"hello" === "hello"')).toBe(true)
  })

  it('evaluates strict inequality (!==)', () => {
    expect(evaluateTruthiness('approved !== pending')).toBe(true)
    expect(evaluateTruthiness('approved !== approved')).toBe(false)
  })

  it('evaluates loose equality (==)', () => {
    expect(evaluateTruthiness('yes == yes')).toBe(true)
    expect(evaluateTruthiness('yes == no')).toBe(false)
  })

  it('evaluates loose inequality (!=)', () => {
    expect(evaluateTruthiness('yes != no')).toBe(true)
    expect(evaluateTruthiness('yes != yes')).toBe(false)
  })

  it('evaluates greater than (>)', () => {
    expect(evaluateTruthiness('100 > 50')).toBe(true)
    expect(evaluateTruthiness('50 > 100')).toBe(false)
  })

  it('evaluates less than (<)', () => {
    expect(evaluateTruthiness('50 < 100')).toBe(true)
    expect(evaluateTruthiness('100 < 50')).toBe(false)
  })

  it('evaluates greater than or equal (>=)', () => {
    expect(evaluateTruthiness('100 >= 50')).toBe(true)
    expect(evaluateTruthiness('50 >= 50')).toBe(true)
    expect(evaluateTruthiness('49 >= 50')).toBe(false)
  })

  it('evaluates less than or equal (<=)', () => {
    expect(evaluateTruthiness('50 <= 100')).toBe(true)
    expect(evaluateTruthiness('50 <= 50')).toBe(true)
    expect(evaluateTruthiness('51 <= 50')).toBe(false)
  })

  it('evaluates logical AND (&&)', () => {
    expect(evaluateTruthiness('100 > 50 && 200 > 100')).toBe(true)
    expect(evaluateTruthiness('100 > 50 && 200 < 100')).toBe(false)
  })

  it('evaluates logical OR (||)', () => {
    expect(evaluateTruthiness('100 < 50 || 200 > 100')).toBe(true)
    expect(evaluateTruthiness('100 < 50 || 200 < 100')).toBe(false)
  })

  it('returns true for non-empty truthy strings', () => {
    expect(evaluateTruthiness('approved')).toBe(true)
    expect(evaluateTruthiness('true')).toBe(true)
    expect(evaluateTruthiness('1')).toBe(true)
  })
})

// ─── Field Resolution ───────────────────────────────────────────────────────

describe('resolveFieldValue', () => {
  let resolveFieldValue: typeof import('../condition')['resolveFieldValue']

  beforeEach(async () => {
    resolveFieldValue = (await import('../condition')).resolveFieldValue
  })

  it('resolves block.type from source block', async () => {
    const supabase = createMockSupabase()
    const result = await resolveFieldValue('block.type', META, supabase as never)
    expect(result).toBe('client')
  })

  it('resolves block.name from source block', async () => {
    const supabase = createMockSupabase()
    const result = await resolveFieldValue('block.name', META, supabase as never)
    expect(result).toBe('Acme Corp')
  })

  it('resolves block.status from metadata', async () => {
    const supabase = createMockSupabase()
    const result = await resolveFieldValue('block.status', META, supabase as never)
    expect(result).toBe('approved')
  })

  it('resolves nested metadata path (block.nested.level)', async () => {
    const supabase = createMockSupabase()
    const result = await resolveFieldValue('block.nested.level', META, supabase as never)
    expect(result).toBe('deep')
  })

  it('returns empty string when block not found', async () => {
    const supabase = createMockSupabaseNoBlock()
    const result = await resolveFieldValue('block.status', META, supabase as never)
    expect(result).toBe('')
  })

  it('returns empty string when no source_block_id', async () => {
    const metaNoBlock = { ...META, source_block_id: '' }
    const supabase = createMockSupabase()
    const result = await resolveFieldValue('block.status', metaNoBlock, supabase as never)
    expect(result).toBe('')
  })

  it('resolves context.* from step_results output', async () => {
    const supabase = createMockSupabase()
    const result = await resolveFieldValue('context.result_value', META, supabase as never)
    expect(result).toBe('hello')
  })

  it('resolves context.score from step_results output', async () => {
    const supabase = createMockSupabase()
    const result = await resolveFieldValue('context.score', META, supabase as never)
    expect(result).toBe('85')
  })

  it('returns empty string for missing context path', async () => {
    const supabase = createMockSupabase()
    const result = await resolveFieldValue('context.nonexistent', META, supabase as never)
    expect(result).toBe('')
  })

  it('returns literal string for unknown prefix', async () => {
    const supabase = createMockSupabase()
    const result = await resolveFieldValue('some_literal', META, supabase as never)
    expect(result).toBe('some_literal')
  })
})

// ─── Simple Mode ────────────────────────────────────────────────────────────

describe('condition handler — simple mode', () => {
  it('evaluates a simple "is" condition against block metadata', async () => {
    const handler = (await import('../condition')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'check_status',
      type: 'condition',
      condition_value: {
        mode: 'simple',
        simple: { field: 'block.status', operator: 'is', value: 'approved' },
      },
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as never)

    expect(result.status).toBe('completed')
    expect(result.output?.condition_mode).toBe('simple')
    expect(result.output?.result).toBe(true)
    expect(result.output?.evaluated_conditions).toHaveLength(1)
  })

  it('returns false for a failing simple condition', async () => {
    const handler = (await import('../condition')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'check_status',
      type: 'condition',
      condition_value: {
        mode: 'simple',
        simple: { field: 'block.status', operator: 'is', value: 'pending' },
      },
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as never)

    expect(result.status).toBe('completed')
    expect(result.output?.result).toBe(false)
  })

  it('supports is_empty operator', async () => {
    const handler = (await import('../condition')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'check_empty',
      type: 'condition',
      condition_value: {
        mode: 'simple',
        simple: { field: 'block.nonexistent', operator: 'is_empty', value: '' },
      },
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as never)
    expect(result.output?.result).toBe(true)
  })

  it('supports greater_than operator on metadata fields', async () => {
    const handler = (await import('../condition')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'check_amount',
      type: 'condition',
      condition_value: {
        mode: 'simple',
        simple: { field: 'block.amount', operator: 'greater_than', value: '1000' },
      },
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as never)
    expect(result.output?.result).toBe(true) // 5000 > 1000
  })

  it('supports contains operator', async () => {
    const handler = (await import('../condition')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'check_name',
      type: 'condition',
      condition_value: {
        mode: 'simple',
        simple: { field: 'block.name', operator: 'contains', value: 'Acme' },
      },
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as never)
    expect(result.output?.result).toBe(true)
  })
})

// ─── Compound Mode ──────────────────────────────────────────────────────────

describe('condition handler — compound mode', () => {
  it('evaluates AND group (all must be true)', async () => {
    const handler = (await import('../condition')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'check_compound_and',
      type: 'condition',
      condition_value: {
        mode: 'compound',
        compound: {
          logic: 'and',
          conditions: [
            { field: 'block.status', operator: 'is', value: 'approved' },
            { field: 'block.amount', operator: 'greater_than', value: '1000' },
          ],
        },
      },
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as never)

    expect(result.status).toBe('completed')
    expect(result.output?.condition_mode).toBe('compound')
    expect(result.output?.logic).toBe('and')
    expect(result.output?.result).toBe(true)
  })

  it('returns false for AND group when one fails', async () => {
    const handler = (await import('../condition')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'check_compound_and_fail',
      type: 'condition',
      condition_value: {
        mode: 'compound',
        compound: {
          logic: 'and',
          conditions: [
            { field: 'block.status', operator: 'is', value: 'approved' },
            { field: 'block.amount', operator: 'less_than', value: '1000' },
          ],
        },
      },
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as never)

    expect(result.output?.result).toBe(false)
  })

  it('evaluates OR group (any must be true)', async () => {
    const handler = (await import('../condition')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'check_compound_or',
      type: 'condition',
      condition_value: {
        mode: 'compound',
        compound: {
          logic: 'or',
          conditions: [
            { field: 'block.status', operator: 'is', value: 'pending' },    // false
            { field: 'block.amount', operator: 'greater_than', value: '1000' }, // true
          ],
        },
      },
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as never)

    expect(result.output?.result).toBe(true)
  })

  it('returns false for OR group when all fail', async () => {
    const handler = (await import('../condition')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'check_compound_or_fail',
      type: 'condition',
      condition_value: {
        mode: 'compound',
        compound: {
          logic: 'or',
          conditions: [
            { field: 'block.status', operator: 'is', value: 'pending' },
            { field: 'block.status', operator: 'is', value: 'rejected' },
          ],
        },
      },
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as never)

    expect(result.output?.result).toBe(false)
  })

  it('short-circuits AND on first false', async () => {
    const handler = (await import('../condition')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'check_and_shortcircuit',
      type: 'condition',
      condition_value: {
        mode: 'compound',
        compound: {
          logic: 'and',
          conditions: [
            { field: 'block.status', operator: 'is', value: 'pending' }, // false
            { field: 'block.amount', operator: 'greater_than', value: '1000' }, // would be true
          ],
        },
      },
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as never)

    expect(result.output?.result).toBe(false)
    // Should short-circuit — only 1 evaluated condition
    expect((result.output?.evaluated_conditions as unknown[])?.length).toBe(1)
  })

  it('short-circuits OR on first true', async () => {
    const handler = (await import('../condition')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'check_or_shortcircuit',
      type: 'condition',
      condition_value: {
        mode: 'compound',
        compound: {
          logic: 'or',
          conditions: [
            { field: 'block.status', operator: 'is', value: 'approved' }, // true
            { field: 'block.status', operator: 'is', value: 'pending' }, // would be false
          ],
        },
      },
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as never)

    expect(result.output?.result).toBe(true)
    // Should short-circuit — only 1 evaluated condition
    expect((result.output?.evaluated_conditions as unknown[])?.length).toBe(1)
  })
})

// ─── Advanced Mode ──────────────────────────────────────────────────────────

describe('condition handler — advanced mode', () => {
  it('interpolates variables and evaluates expression', async () => {
    const handler = (await import('../condition')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'check_advanced',
      type: 'condition',
      condition_value: {
        mode: 'advanced',
        advanced: '{{block.status}} === "approved"',
      },
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as never)

    expect(result.status).toBe('completed')
    expect(result.output?.condition_mode).toBe('advanced')
    expect(result.output?.result).toBe(true)
    expect(result.output?.interpolated_expression).toBe('approved === "approved"')
  })

  it('evaluates false for mismatched advanced expression', async () => {
    const handler = (await import('../condition')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'check_advanced_false',
      type: 'condition',
      condition_value: {
        mode: 'advanced',
        advanced: '{{block.status}} === "pending"',
      },
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as never)

    expect(result.output?.result).toBe(false)
    expect(result.output?.interpolated_expression).toBe('approved === "pending"')
  })

  it('supports context variables in advanced mode', async () => {
    const handler = (await import('../condition')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'check_context',
      type: 'condition',
      condition_value: {
        mode: 'advanced',
        advanced: '{{context.score}} > 80',
      },
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as never)

    expect(result.output?.result).toBe(true) // 85 > 80
  })

  it('supports && in advanced expressions', async () => {
    const handler = (await import('../condition')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'check_advanced_and',
      type: 'condition',
      condition_value: {
        mode: 'advanced',
        advanced: '{{block.status}} === "approved" && {{block.amount}} > 1000',
      },
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as never)

    expect(result.output?.result).toBe(true)
  })
})

// ─── Legacy Mode ────────────────────────────────────────────────────────────

describe('condition handler — legacy mode', () => {
  it('evaluates legacy string condition as advanced expression', async () => {
    const handler = (await import('../condition')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'check_legacy',
      type: 'condition',
      condition: '{{block.status}} === "approved"',
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as never)

    expect(result.status).toBe('completed')
    expect(result.output?.condition_mode).toBe('legacy')
    expect(result.output?.result).toBe(true)
  })

  it('returns true for legacy "true" string', async () => {
    const handler = (await import('../condition')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'check_legacy_true',
      type: 'condition',
      condition: 'true',
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as never)

    expect(result.output?.result).toBe(true)
  })

  it('returns false for legacy "false" string', async () => {
    const handler = (await import('../condition')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'check_legacy_false',
      type: 'condition',
      condition: 'false',
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as never)

    expect(result.output?.result).toBe(false)
  })

  it('returns true when no condition is configured at all', async () => {
    const handler = (await import('../condition')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'check_nothing',
      type: 'condition',
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as never)

    expect(result.status).toBe('completed')
    expect(result.output?.condition_mode).toBe('legacy')
    expect(result.output?.result).toBe(true)
    expect(result.output?.reason).toContain('defaulting to true')
  })
})

// ─── Edge Cases ─────────────────────────────────────────────────────────────

describe('condition handler — edge cases', () => {
  it('handles condition_value with mode but no data for that mode', async () => {
    const handler = (await import('../condition')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'check_empty_mode',
      type: 'condition',
      condition_value: { mode: 'simple' },
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as never)

    expect(result.status).toBe('completed')
    expect(result.output?.result).toBe(true)
    expect(result.output?.reason).toContain('defaulting to true')
  })

  it('prefers condition_value over legacy condition when both present', async () => {
    const handler = (await import('../condition')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'check_both',
      type: 'condition',
      condition: 'false', // legacy: would be false
      condition_value: {
        mode: 'simple',
        simple: { field: 'block.status', operator: 'is', value: 'approved' },
      },
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as never)

    // condition_value should take precedence
    expect(result.output?.condition_mode).toBe('simple')
    expect(result.output?.result).toBe(true)
  })

  it('resolves context from the most recent step result', async () => {
    const metaMultiStep: InstanceMetadata = {
      ...META,
      step_results: [
        {
          step_name: 'old_step',
          step_type: 'run_action',
          status: 'completed',
          output: { score: '50' },
          executed_at: '2026-01-01T00:00:00Z',
        },
        {
          step_name: 'recent_step',
          step_type: 'run_action',
          status: 'completed',
          output: { score: '95' },
          executed_at: '2026-01-01T00:01:00Z',
        },
      ],
    }

    const handler = (await import('../condition')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'check_recent',
      type: 'condition',
      condition_value: {
        mode: 'simple',
        simple: { field: 'context.score', operator: 'greater_than', value: '90' },
      },
    } as unknown as WorkflowStep

    const result = await handler(step, metaMultiStep, 'org-1', supabase as never)

    expect(result.output?.result).toBe(true) // 95 > 90 from most recent step
  })

  it('handles error in block fetch gracefully', async () => {
    const handler = (await import('../condition')).default
    const supabase = createMockSupabaseNoBlock()

    const step = {
      name: 'check_missing_block',
      type: 'condition',
      condition_value: {
        mode: 'simple',
        simple: { field: 'block.status', operator: 'is_empty', value: '' },
      },
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as never)

    // block not found => field resolves to '' => is_empty => true
    expect(result.status).toBe('completed')
    expect(result.output?.result).toBe(true)
  })
})
