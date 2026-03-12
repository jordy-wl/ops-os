import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock Anthropic SDK ─────────────────────────────────────────────────────────

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}))

vi.mock('fs', () => ({
  readFileSync: vi.fn().mockReturnValue('Analyse the workflow delta. Return JSON.'),
}))

import {
  generateInsights,
  buildFallbackInsights,
  type InsightsResult,
  type BlockContext,
} from '../insights-generator'
import type { DeltaResult } from '../delta-types'
import {
  clearInsightsCache,
  getCachedInsights,
  buildCacheKey,
  setCachedInsights,
  invalidateBlockInsights,
  getInsightsCacheSize,
} from '../insights-cache'

// ─── Helpers ────────────────────────────────────────────────────────────────────

function mockClaudeResponse(json: Record<string, unknown>) {
  mockCreate.mockResolvedValueOnce({
    content: [{ type: 'text', text: JSON.stringify(json) }],
    usage: { input_tokens: 200, output_tokens: 300 },
  })
}

const baseBlockContext: BlockContext = {
  blockId: 'block_001',
  blockType: 'client',
  blockName: 'Acme Corp Onboarding',
  lastEventId: 'evt_100',
}

function makeDelta(overrides?: Partial<DeltaResult>): DeltaResult {
  return {
    instanceId: 'inst_001',
    templateId: 'tmpl_001',
    currentStepIndex: 2,
    totalSteps: 5,
    status: 'running',
    completedSteps: [
      {
        stepIndex: 0,
        stepName: 'Initial Review',
        stepType: 'manual',
        status: 'completed',
        expectedDurationHours: 24,
        actualDurationHours: 20,
        varianceHours: -4,
        startedAt: '2026-03-10T00:00:00Z',
        completedAt: '2026-03-10T20:00:00Z',
      },
      {
        stepIndex: 1,
        stepName: 'Data Collection',
        stepType: 'manual',
        status: 'completed',
        expectedDurationHours: 48,
        actualDurationHours: 52,
        varianceHours: 4,
        startedAt: '2026-03-10T20:00:00Z',
        completedAt: '2026-03-12T00:00:00Z',
      },
    ],
    remainingSteps: [
      {
        stepIndex: 2,
        stepName: 'Compliance Check',
        stepType: 'manual',
        status: 'in_progress',
        expectedDurationHours: 24,
        actualDurationHours: 6,
        varianceHours: -18,
        startedAt: '2026-03-12T00:00:00Z',
        completedAt: null,
      },
      {
        stepIndex: 3,
        stepName: 'Manager Approval',
        stepType: 'approval',
        status: 'pending',
        expectedDurationHours: 8,
        actualDurationHours: null,
        varianceHours: null,
        startedAt: null,
        completedAt: null,
      },
      {
        stepIndex: 4,
        stepName: 'Final Setup',
        stepType: 'emit_event',
        status: 'pending',
        expectedDurationHours: 2,
        actualDurationHours: null,
        varianceHours: null,
        startedAt: null,
        completedAt: null,
      },
    ],
    timelineDeltas: [],
    gapAnalysis: {
      overdueSteps: [],
      skippedSteps: [],
      outOfOrderSteps: [],
    },
    healthScore: {
      score: 85,
      overduePenalty: 0,
      skipPenalty: 0,
      variancePenalty: 15,
    },
    calculatedAt: '2026-03-12T06:00:00Z',
    ...overrides,
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('generateInsights', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearInsightsCache()
  })

  it('returns all four insight sections from Claude response', async () => {
    mockClaudeResponse({
      whatsDone: [
        'Initial Review completed 4 hours ahead of schedule.',
        'Data Collection completed with a 4-hour delay.',
      ],
      whatsNext: [
        'Compliance Check is in progress, expected to complete within 18 hours.',
        'Manager Approval follows, estimated 8 hours.',
      ],
      whatsAtRisk: ['Data Collection took 4 hours longer than expected.'],
      recommendations: [
        'Investigate the Data Collection delay to prevent recurrence.',
        'Pre-notify the manager for the upcoming approval step.',
      ],
    })

    const result = await generateInsights(makeDelta(), baseBlockContext)

    expect(result.whatsDone).toHaveLength(2)
    expect(result.whatsNext).toHaveLength(2)
    expect(result.whatsAtRisk).toHaveLength(1)
    expect(result.recommendations).toHaveLength(2)
    expect(result.healthScore).toBe(85)
    expect(result.fromCache).toBe(false)
    expect(result.generatedAt).toBeTruthy()
  })

  it('returns cached result on second call with same block/event', async () => {
    mockClaudeResponse({
      whatsDone: ['Step A done.'],
      whatsNext: ['Step B next.'],
      whatsAtRisk: ['No risks.'],
      recommendations: ['Continue monitoring.'],
    })

    const first = await generateInsights(makeDelta(), baseBlockContext)
    const second = await generateInsights(makeDelta(), baseBlockContext)

    expect(first.fromCache).toBe(false)
    expect(second.fromCache).toBe(true)
    expect(second.whatsDone).toEqual(first.whatsDone)
    // Claude should only be called once
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  it('invalidates cache when lastEventId changes', async () => {
    mockClaudeResponse({
      whatsDone: ['First call.'],
      whatsNext: [],
      whatsAtRisk: [],
      recommendations: [],
    })
    mockClaudeResponse({
      whatsDone: ['Second call after new event.'],
      whatsNext: [],
      whatsAtRisk: [],
      recommendations: [],
    })

    const first = await generateInsights(makeDelta(), baseBlockContext)
    const second = await generateInsights(makeDelta(), {
      ...baseBlockContext,
      lastEventId: 'evt_101', // New event — different cache key
    })

    expect(first.whatsDone).toEqual(['First call.'])
    expect(second.whatsDone).toEqual(['Second call after new event.'])
    expect(mockCreate).toHaveBeenCalledTimes(2)
  })

  it('returns fallback insights when Claude API fails', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API rate limited'))

    const delta = makeDelta({
      gapAnalysis: {
        overdueSteps: [
          { stepIndex: 2, stepName: 'Compliance Check', overdueByHours: 12 },
        ],
        skippedSteps: [],
        outOfOrderSteps: [],
      },
      healthScore: {
        score: 45,
        overduePenalty: 30,
        skipPenalty: 0,
        variancePenalty: 25,
      },
    })

    const result = await generateInsights(delta, baseBlockContext)

    // Should return fallback with data from delta
    expect(result.whatsDone.length).toBeGreaterThan(0)
    expect(result.whatsNext.length).toBeGreaterThan(0)
    expect(result.whatsAtRisk.length).toBeGreaterThan(0)
    expect(result.recommendations.length).toBeGreaterThan(0)
    expect(result.healthScore).toBe(45)
    expect(result.fromCache).toBe(false)
  })

  it('returns fallback insights when Claude returns unparseable text', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'I cannot process this request.' }],
      usage: { input_tokens: 100, output_tokens: 20 },
    })

    const result = await generateInsights(makeDelta(), {
      ...baseBlockContext,
      lastEventId: 'evt_parse_fail',
    })

    // Parsed empty arrays from AI, but still gets health score
    expect(result.whatsDone).toEqual([])
    expect(result.healthScore).toBe(85)
    expect(result.fromCache).toBe(false)
  })

  it('handles JSON wrapped in markdown code blocks', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: '```json\n{"whatsDone": ["Step completed."], "whatsNext": ["Next step."], "whatsAtRisk": ["Risk item."], "recommendations": ["Do this."]}\n```',
        },
      ],
      usage: { input_tokens: 200, output_tokens: 150 },
    })

    const result = await generateInsights(makeDelta(), {
      ...baseBlockContext,
      lastEventId: 'evt_codeblock',
    })

    expect(result.whatsDone).toEqual(['Step completed.'])
    expect(result.whatsNext).toEqual(['Next step.'])
    expect(result.whatsAtRisk).toEqual(['Risk item.'])
    expect(result.recommendations).toEqual(['Do this.'])
  })

  it('limits each section to 5 items max', async () => {
    mockClaudeResponse({
      whatsDone: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
      whatsNext: ['1', '2', '3', '4', '5', '6'],
      whatsAtRisk: ['x', 'y', 'z', 'w', 'v', 'u', 't'],
      recommendations: ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'],
    })

    const result = await generateInsights(makeDelta(), {
      ...baseBlockContext,
      lastEventId: 'evt_limit',
    })

    expect(result.whatsDone).toHaveLength(5)
    expect(result.whatsNext).toHaveLength(5)
    expect(result.whatsAtRisk).toHaveLength(5)
    expect(result.recommendations).toHaveLength(5)
  })

  it('filters out non-string items from AI response arrays', async () => {
    mockClaudeResponse({
      whatsDone: ['valid', 42, null, 'also valid', '', undefined],
      whatsNext: ['next'],
      whatsAtRisk: [true, 'risk'],
      recommendations: ['rec'],
    })

    const result = await generateInsights(makeDelta(), {
      ...baseBlockContext,
      lastEventId: 'evt_filter',
    })

    expect(result.whatsDone).toEqual(['valid', 'also valid'])
    expect(result.whatsAtRisk).toEqual(['risk'])
  })

  it('sends block context and delta data in the user message', async () => {
    mockClaudeResponse({
      whatsDone: ['Done.'],
      whatsNext: ['Next.'],
      whatsAtRisk: ['Risk.'],
      recommendations: ['Rec.'],
    })

    await generateInsights(makeDelta(), {
      ...baseBlockContext,
      lastEventId: 'evt_message_check',
    })

    expect(mockCreate).toHaveBeenCalledTimes(1)
    const callArgs = mockCreate.mock.calls[0][0]
    const userContent = callArgs.messages[0].content

    expect(userContent).toContain('client')
    expect(userContent).toContain('Acme Corp Onboarding')
    expect(userContent).toContain('Initial Review')
    expect(userContent).toContain('Compliance Check')
    expect(userContent).toContain('85/100')
  })

  it('uses claude-sonnet-4-6 model', async () => {
    mockClaudeResponse({
      whatsDone: [],
      whatsNext: [],
      whatsAtRisk: [],
      recommendations: [],
    })

    await generateInsights(makeDelta(), {
      ...baseBlockContext,
      lastEventId: 'evt_model_check',
    })

    const callArgs = mockCreate.mock.calls[0][0]
    expect(callArgs.model).toBe('claude-sonnet-4-6')
  })
})

describe('buildFallbackInsights', () => {
  it('builds insights from delta data when all is healthy', () => {
    const delta = makeDelta()
    const result = buildFallbackInsights(delta, baseBlockContext)

    expect(result.whatsDone.length).toBeGreaterThan(0)
    expect(result.whatsNext.length).toBeGreaterThan(0)
    expect(result.whatsAtRisk).toEqual(['No current risks identified.'])
    expect(result.recommendations).toEqual(['Workflow is on track. Continue monitoring.'])
    expect(result.healthScore).toBe(85)
    expect(result.fromCache).toBe(false)
  })

  it('includes overdue steps in risk section', () => {
    const delta = makeDelta({
      gapAnalysis: {
        overdueSteps: [
          { stepIndex: 2, stepName: 'Compliance Check', overdueByHours: 12 },
        ],
        skippedSteps: [],
        outOfOrderSteps: [],
      },
    })

    const result = buildFallbackInsights(delta, baseBlockContext)

    expect(result.whatsAtRisk).toContainEqual(
      expect.stringContaining('Compliance Check')
    )
    expect(result.whatsAtRisk).toContainEqual(
      expect.stringContaining('12 hours')
    )
  })

  it('includes skipped steps in risk and recommendations', () => {
    const delta = makeDelta({
      gapAnalysis: {
        overdueSteps: [],
        skippedSteps: [{ stepIndex: 1, stepName: 'Data Collection' }],
        outOfOrderSteps: [],
      },
    })

    const result = buildFallbackInsights(delta, baseBlockContext)

    expect(result.whatsAtRisk).toContainEqual(
      expect.stringContaining('Data Collection')
    )
    expect(result.recommendations).toContainEqual(
      expect.stringContaining('skipped')
    )
  })

  it('flags critical health in recommendations when score is below 50', () => {
    const delta = makeDelta({
      healthScore: {
        score: 30,
        overduePenalty: 40,
        skipPenalty: 15,
        variancePenalty: 15,
      },
    })

    const result = buildFallbackInsights(delta, baseBlockContext)

    expect(result.recommendations).toContainEqual(
      expect.stringContaining('critically low')
    )
    expect(result.recommendations).toContainEqual(
      expect.stringContaining('30/100')
    )
  })

  it('flags degraded health when score is between 50-80', () => {
    const delta = makeDelta({
      healthScore: {
        score: 65,
        overduePenalty: 20,
        skipPenalty: 0,
        variancePenalty: 15,
      },
    })

    const result = buildFallbackInsights(delta, baseBlockContext)

    expect(result.recommendations).toContainEqual(
      expect.stringContaining('degraded')
    )
    expect(result.recommendations).toContainEqual(
      expect.stringContaining('65/100')
    )
  })

  it('returns "No steps completed yet" when no completed steps', () => {
    const delta = makeDelta({
      completedSteps: [],
    })

    const result = buildFallbackInsights(delta, baseBlockContext)

    expect(result.whatsDone).toEqual(['No steps completed yet.'])
  })

  it('returns "All steps completed" when no remaining steps', () => {
    const delta = makeDelta({
      remainingSteps: [],
    })

    const result = buildFallbackInsights(delta, baseBlockContext)

    expect(result.whatsNext).toEqual(['All steps completed.'])
  })
})

describe('insights cache', () => {
  beforeEach(() => {
    clearInsightsCache()
  })

  it('builds correct cache key from blockId and lastEventId', () => {
    const key = buildCacheKey('block_001', 'evt_100')
    expect(key).toBe('block_001_evt_100')
  })

  it('returns null for cache miss', () => {
    const result = getCachedInsights('nonexistent_key')
    expect(result).toBeNull()
  })

  it('stores and retrieves cached insights', () => {
    const key = buildCacheKey('block_001', 'evt_100')
    const insights: InsightsResult = {
      whatsDone: ['Done.'],
      whatsNext: ['Next.'],
      whatsAtRisk: ['Risk.'],
      recommendations: ['Rec.'],
      healthScore: 90,
      generatedAt: '2026-03-12T00:00:00Z',
      fromCache: false,
    }

    setCachedInsights(key, insights)
    const cached = getCachedInsights(key)

    expect(cached).not.toBeNull()
    expect(cached!.whatsDone).toEqual(['Done.'])
    expect(cached!.fromCache).toBe(true) // fromCache is set on retrieval
  })

  it('invalidates all insights for a block', () => {
    setCachedInsights('block_001_evt_100', {
      whatsDone: [],
      whatsNext: [],
      whatsAtRisk: [],
      recommendations: [],
      healthScore: 90,
      generatedAt: '2026-03-12T00:00:00Z',
      fromCache: false,
    })
    setCachedInsights('block_001_evt_101', {
      whatsDone: [],
      whatsNext: [],
      whatsAtRisk: [],
      recommendations: [],
      healthScore: 80,
      generatedAt: '2026-03-12T01:00:00Z',
      fromCache: false,
    })
    setCachedInsights('block_002_evt_200', {
      whatsDone: [],
      whatsNext: [],
      whatsAtRisk: [],
      recommendations: [],
      healthScore: 95,
      generatedAt: '2026-03-12T02:00:00Z',
      fromCache: false,
    })

    const removed = invalidateBlockInsights('block_001')

    expect(removed).toBe(2)
    expect(getCachedInsights('block_001_evt_100')).toBeNull()
    expect(getCachedInsights('block_001_evt_101')).toBeNull()
    expect(getCachedInsights('block_002_evt_200')).not.toBeNull()
  })

  it('clears entire cache', () => {
    setCachedInsights('a_b', {
      whatsDone: [],
      whatsNext: [],
      whatsAtRisk: [],
      recommendations: [],
      healthScore: 100,
      generatedAt: '2026-03-12T00:00:00Z',
      fromCache: false,
    })

    expect(getInsightsCacheSize()).toBe(1)
    clearInsightsCache()
    expect(getInsightsCacheSize()).toBe(0)
  })
})
