import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WorkflowStep } from '../../template-schema'
import type { InstanceMetadata } from '../types'

// ─── Mock Anthropic ──────────────────────────────────────────────────────────

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}))

// ─── Mock Supabase ──────────────────────────────────────────────────────────

function createMockSupabase(blockData?: Record<string, unknown>) {
  const defaultBlock = {
    data: {
      id: 'block-1',
      name: 'Test Block',
      type: 'client',
      metadata: { status: 'active', industry: 'finance', deal_value: 50000 },
    },
    error: null,
  }

  function makeChain(): Record<string, unknown> {
    const chain: Record<string, unknown> = {}
    const self = () => chain
    chain.eq = vi.fn(self)
    chain.select = vi.fn(self)
    chain.single = vi.fn().mockResolvedValue(blockData ?? defaultBlock)
    chain.order = vi.fn(self)
    chain.limit = vi.fn().mockResolvedValue({
      data: [
        { name: 'AML Policy', metadata: { rules: ['KYC required', 'PEP check'] } },
        { name: 'Data Policy', metadata: { retention_days: 365 } },
      ],
      error: null,
    })
    return chain
  }

  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue(makeChain()),
    }),
  }
}

const META: InstanceMetadata = {
  template_id: 'tpl-1',
  source_block_id: 'block-source',
  applies_to_type: 'client',
  status: 'running',
  current_step_index: 0,
  step_results: [],
  started_at: '2026-01-01T00:00:00Z',
  completed_at: null,
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── ai_analysis ────────────────────────────────────────────────────────────

describe('ai_analysis handler', () => {
  it('runs analysis and returns structured output', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"risk_level":"medium","factors":["market volatility"]}' }],
      usage: { output_tokens: 42 },
    })

    const handler = (await import('../ai-analysis')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'analyze_client',
      type: 'ai_analysis',
      ai_prompt: 'Analyze risk factors',
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as unknown as never)

    expect(result.status).toBe('completed')
    expect(result.output?.analysis).toEqual({ risk_level: 'medium', factors: ['market volatility'] })
    expect(result.output?.tokens_used).toBe(42)
  })

  it('fails when ai_prompt is missing', async () => {
    const handler = (await import('../ai-analysis')).default
    const supabase = createMockSupabase()

    const step = { name: 'no_prompt', type: 'ai_analysis' } as unknown as WorkflowStep
    const result = await handler(step, META, 'org-1', supabase as unknown as never)

    expect(result.status).toBe('failed')
    expect(result.error).toContain('ai_prompt')
  })

  it('handles non-JSON response gracefully', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'This is plain text response' }],
      usage: { output_tokens: 10 },
    })

    const handler = (await import('../ai-analysis')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'analyze',
      type: 'ai_analysis',
      ai_prompt: 'Analyze this',
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as unknown as never)
    expect(result.status).toBe('completed')
    expect(result.output?.analysis).toHaveProperty('parse_error', true)
  })

  it('handles API failure', async () => {
    mockCreate.mockRejectedValue(new Error('Rate limited'))

    const handler = (await import('../ai-analysis')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'analyze',
      type: 'ai_analysis',
      ai_prompt: 'Analyze this',
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as unknown as never)
    expect(result.status).toBe('failed')
    expect(result.error).toContain('Rate limited')
  })
})

// ─── ai_classify ────────────────────────────────────────────────────────────

describe('ai_classify handler', () => {
  it('classifies into provided categories', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"category":"high_value","confidence":0.92,"reasoning":"Deal exceeds $40k"}' }],
      usage: { output_tokens: 20 },
    })

    const handler = (await import('../ai-classify')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'classify_deal',
      type: 'ai_classify',
      ai_categories: ['high_value', 'medium_value', 'low_value'],
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as unknown as never)

    expect(result.status).toBe('completed')
    expect(result.output?.category).toBe('high_value')
    expect(result.output?.confidence).toBe(0.92)
  })

  it('fails when categories has fewer than 2 items', async () => {
    const handler = (await import('../ai-classify')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'bad_classify',
      type: 'ai_classify',
      ai_categories: ['only_one'],
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as unknown as never)
    expect(result.status).toBe('failed')
    expect(result.error).toContain('at least 2')
  })
})

// ─── ai_summarize ───────────────────────────────────────────────────────────

describe('ai_summarize handler', () => {
  it('generates summary with events', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Client is active with a strong pipeline worth $50k.' }],
      usage: { output_tokens: 15 },
    })

    const handler = (await import('../ai-summarize')).default

    const eventsChain: Record<string, unknown> = {}
    const evSelf = () => eventsChain
    eventsChain.eq = vi.fn(evSelf)
    eventsChain.select = vi.fn(evSelf)
    eventsChain.order = vi.fn(evSelf)
    eventsChain.limit = vi.fn().mockResolvedValue({
      data: [{ type: 'block.updated', payload: { field: 'status' }, created_at: '2026-01-01' }],
      error: null,
    })
    eventsChain.single = vi.fn().mockResolvedValue({
      data: { id: 'block-1', name: 'Test', type: 'client', metadata: { status: 'active' } },
      error: null,
    })

    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(eventsChain),
      }),
    }

    const step = {
      name: 'summarize_client',
      type: 'ai_summarize',
      ai_include_events: true,
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as unknown as never)

    expect(result.status).toBe('completed')
    expect(result.output?.summary).toContain('pipeline')
    expect(result.output?.events_included).toBe(true)
  })
})

// ─── ai_risk_assessment ─────────────────────────────────────────────────────

describe('ai_risk_assessment handler', () => {
  it('returns risk assessment with scores', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          overall_risk_score: 7,
          risk_level: 'high',
          risks: [{ category: 'compliance', score: 8, description: 'Missing KYC docs', mitigation: 'Request KYC' }],
          summary: 'High compliance risk due to missing documentation.',
        }),
      }],
      usage: { output_tokens: 60 },
    })

    const handler = (await import('../ai-risk-assessment')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'assess_risk',
      type: 'ai_risk_assessment',
      ai_include_policies: true,
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as unknown as never)

    expect(result.status).toBe('completed')
    expect(result.output?.overall_risk_score).toBe(7)
    expect(result.output?.risk_level).toBe('high')
    expect(result.output?.risks).toHaveLength(1)
    expect(result.output?.policies_included).toBe(true)
  })

  it('clamps risk score to valid range', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          overall_risk_score: 15,
          risk_level: 'critical',
          risks: [],
          summary: 'Off the charts.',
        }),
      }],
      usage: { output_tokens: 20 },
    })

    const handler = (await import('../ai-risk-assessment')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'assess',
      type: 'ai_risk_assessment',
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as unknown as never)
    expect(result.output?.overall_risk_score).toBe(10) // clamped to max
  })
})
