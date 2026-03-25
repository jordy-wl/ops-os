import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock Anthropic SDK ─────────────────────────────────────────────────────────

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}))

vi.mock('fs', () => ({
  readFileSync: vi.fn().mockReturnValue('Evaluate confidence. Return JSON.'),
}))

import { evaluateConfidence, type TaskContext } from '../confidence-scoring'

// ─── Helpers ────────────────────────────────────────────────────────────────────

function mockClaudeResponse(json: Record<string, unknown>) {
  mockCreate.mockResolvedValueOnce({
    content: [{ type: 'text', text: JSON.stringify(json) }],
    usage: { input_tokens: 100, output_tokens: 50 },
  })
}

const baseContext: TaskContext = {
  stepInstructions: 'Update the client status to active',
  inputData: { client_id: 'abc', status: 'pending' },
  stepType: 'update_block',
  blockType: 'client',
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('evaluateConfidence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns parsed confidence result from Claude', async () => {
    mockClaudeResponse({
      score: 0.85,
      reasoning: 'Clear instructions with complete data',
      factors: {
        instructionClarity: 0.9,
        dataCompleteness: 0.8,
        patternMatch: 0.85,
        complexityEstimate: 0.9,
      },
    })

    const result = await evaluateConfidence(baseContext)

    expect(result.score).toBe(0.85)
    expect(result.reasoning).toBe('Clear instructions with complete data')
    expect(result.factors.instructionClarity).toBe(0.9)
    expect(result.factors.dataCompleteness).toBe(0.8)
  })

  it('clamps scores to 0-1 range', async () => {
    mockClaudeResponse({
      score: 1.5,
      reasoning: 'Over-confident',
      factors: {
        instructionClarity: -0.2,
        dataCompleteness: 2.0,
        patternMatch: 0.5,
        complexityEstimate: 0.5,
      },
    })

    const result = await evaluateConfidence({
      ...baseContext,
      stepInstructions: 'unique clamp test',
    })

    expect(result.score).toBe(1.0)
    expect(result.factors.instructionClarity).toBe(0)
    expect(result.factors.dataCompleteness).toBe(1.0)
  })

  it('returns default 0 result on API failure', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API rate limited'))

    const result = await evaluateConfidence({
      ...baseContext,
      stepInstructions: 'unique failure test',
    })

    expect(result.score).toBe(0)
    expect(result.reasoning).toContain('unavailable')
    expect(result.factors.instructionClarity).toBe(0)
  })

  it('returns default 0 result on unparseable response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'I cannot evaluate this task.' }],
      usage: { input_tokens: 100, output_tokens: 20 },
    })

    const result = await evaluateConfidence({
      ...baseContext,
      stepInstructions: 'unique parse fail test',
    })

    expect(result.score).toBe(0)
  })

  it('handles JSON in markdown code blocks', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: '```json\n{"score": 0.75, "reasoning": "Wrapped in code block", "factors": {"instructionClarity": 0.8, "dataCompleteness": 0.7, "patternMatch": 0.7, "complexityEstimate": 0.8}}\n```',
      }],
      usage: { input_tokens: 100, output_tokens: 50 },
    })

    const result = await evaluateConfidence({
      ...baseContext,
      stepInstructions: 'unique codeblock test',
    })

    expect(result.score).toBe(0.75)
    expect(result.reasoning).toBe('Wrapped in code block')
  })

  it('returns cached result on second call with same context', async () => {
    const ctx: TaskContext = {
      stepInstructions: 'Exactly the same instructions for caching',
      inputData: { key: 'cache-test' },
      stepType: 'emit_event',
    }

    mockClaudeResponse({
      score: 0.6,
      reasoning: 'Cached result',
      factors: {
        instructionClarity: 0.6,
        dataCompleteness: 0.6,
        patternMatch: 0.6,
        complexityEstimate: 0.6,
      },
    })

    const first = await evaluateConfidence(ctx)
    const second = await evaluateConfidence(ctx)

    expect(first.score).toBe(0.6)
    expect(second.score).toBe(0.6)
    // Should only call Claude once (second was cached)
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  it('handles missing factors gracefully', async () => {
    mockClaudeResponse({
      score: 0.5,
      reasoning: 'Partial factors',
      factors: {
        instructionClarity: 0.7,
      },
    })

    const result = await evaluateConfidence({
      ...baseContext,
      stepInstructions: 'unique partial factors test',
    })

    expect(result.score).toBe(0.5)
    expect(result.factors.instructionClarity).toBe(0.7)
    expect(result.factors.dataCompleteness).toBe(0)
    expect(result.factors.patternMatch).toBe(0)
    expect(result.factors.complexityEstimate).toBe(0)
  })

  it('includes expected output schema in the message when provided', async () => {
    mockClaudeResponse({
      score: 0.9,
      reasoning: 'Schema provided',
      factors: {
        instructionClarity: 0.9,
        dataCompleteness: 0.9,
        patternMatch: 0.9,
        complexityEstimate: 0.9,
      },
    })

    const ctx: TaskContext = {
      stepInstructions: 'Generate a report with output schema',
      inputData: { block_id: 'test' },
      stepType: 'generate_document',
      expectedOutputSchema: { type: 'object', properties: { report: { type: 'string' } } },
    }

    await evaluateConfidence(ctx)

    expect(mockCreate).toHaveBeenCalledTimes(1)
    const callArgs = mockCreate.mock.calls[0][0]
    expect(callArgs.messages[0].content).toContain('Expected Output Schema')
  })
})
