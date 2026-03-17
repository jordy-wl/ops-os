import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { StrategyContext } from '../strategy-generation'

// ─── Mock Anthropic SDK ─────────────────────────────────────────────────────

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate }
    },
  }
})

import { generateSwotAnalysis, generateValueProposition } from '../strategy-generation'

// ─── Test Data ──────────────────────────────────────────────────────────────

const MOCK_SWOT_RESPONSE = {
  strengths: [
    'Strong regulatory compliance track record',
    'Experienced team in capital markets',
    'Proprietary risk assessment technology',
    'Established client relationships',
  ],
  weaknesses: [
    'Limited geographic presence outside APAC',
    'High customer concentration in top 3 clients',
    'Legacy technology stack for reporting',
  ],
  opportunities: [
    'Growing demand for RegTech solutions in Southeast Asia',
    'Digital transformation initiatives from tier-2 banks',
    'Partnership opportunities with established consultancies',
    'New ESG reporting regulations creating demand',
  ],
  threats: [
    'Increasing competition from global RegTech providers',
    'Regulatory changes that could impact business model',
    'Economic downturn reducing client spending',
    'Talent shortage in compliance and technology',
  ],
}

const MOCK_VALUE_PROP_RESPONSE = {
  target_audience: 'Mid-tier financial institutions in APAC with 100-500 employees',
  unique_value: 'Automated compliance monitoring that reduces regulatory risk by 60%',
  competitive_advantage: 'Purpose-built for APAC regulatory frameworks with deep ASIC integration',
  proof_points: [
    '25+ financial institutions trust our platform',
    '99.7% uptime over the past 3 years',
    'Average 45% reduction in compliance costs',
    'SOC 2 Type II certified',
  ],
}

const BASE_CONTEXT: StrategyContext = {
  orgName: 'Thornfield Capital',
  blockName: 'APAC Operations',
  blockType: 'client',
  blockData: {
    industry: 'financial_services',
    jurisdiction: 'AU',
    status: 'active',
  },
  relatedBlocks: [
    { name: 'RegTech Platform', type: 'product' },
    { name: 'Compliance Advisory', type: 'service' },
    { name: 'Acme Bank', type: 'client' },
  ],
}

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockCreate.mockReset()
  process.env.ANTHROPIC_API_KEY = 'test-key-123'
})

describe('generateSwotAnalysis', () => {
  it('returns structured SWOT with 4 quadrants', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(MOCK_SWOT_RESPONSE) }],
    })

    const result = await generateSwotAnalysis(BASE_CONTEXT)

    expect(result.strengths).toHaveLength(4)
    expect(result.weaknesses).toHaveLength(3)
    expect(result.opportunities).toHaveLength(4)
    expect(result.threats).toHaveLength(4)
  })

  it('sends context to Claude with correct system prompt', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(MOCK_SWOT_RESPONSE) }],
    })

    await generateSwotAnalysis(BASE_CONTEXT)

    expect(mockCreate).toHaveBeenCalledOnce()
    const callArgs = mockCreate.mock.calls[0][0]
    expect(callArgs.system).toContain('SWOT analysis')
    expect(callArgs.messages[0].content).toContain('Thornfield Capital')
    expect(callArgs.messages[0].content).toContain('APAC Operations')
    expect(callArgs.max_tokens).toBe(1024)
  })

  it('throws on invalid response structure', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ invalid: true }) }],
    })

    await expect(generateSwotAnalysis(BASE_CONTEXT)).rejects.toThrow('Invalid SWOT response')
  })

  it('throws when API key is not set', async () => {
    delete process.env.ANTHROPIC_API_KEY

    await expect(generateSwotAnalysis(BASE_CONTEXT)).rejects.toThrow('ANTHROPIC_API_KEY')
  })

  it('strips PII-sensitive fields from prompt context', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(MOCK_SWOT_RESPONSE) }],
    })

    await generateSwotAnalysis({
      ...BASE_CONTEXT,
      blockData: {
        industry: 'financial_services',
        email: 'secret@example.com',
        phone: '+1234567890',
        status: 'active',
      },
    })

    const callArgs = mockCreate.mock.calls[0][0]
    expect(callArgs.messages[0].content).not.toContain('secret@example.com')
    expect(callArgs.messages[0].content).not.toContain('+1234567890')
    expect(callArgs.messages[0].content).toContain('financial_services')
  })

  it('handles minimal context (org name only)', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(MOCK_SWOT_RESPONSE) }],
    })

    const result = await generateSwotAnalysis({ orgName: 'Thornfield' })

    expect(result.strengths.length).toBeGreaterThan(0)
    expect(mockCreate).toHaveBeenCalledOnce()
  })
})

describe('generateValueProposition', () => {
  it('returns structured value proposition', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(MOCK_VALUE_PROP_RESPONSE) }],
    })

    const result = await generateValueProposition(BASE_CONTEXT)

    expect(result.target_audience).toContain('financial institutions')
    expect(result.unique_value).toContain('compliance monitoring')
    expect(result.competitive_advantage).toContain('APAC')
    expect(result.proof_points).toHaveLength(4)
  })

  it('sends products/services/solutions context to Claude', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(MOCK_VALUE_PROP_RESPONSE) }],
    })

    await generateValueProposition(BASE_CONTEXT)

    const callArgs = mockCreate.mock.calls[0][0]
    expect(callArgs.messages[0].content).toContain('RegTech Platform')
    expect(callArgs.messages[0].content).toContain('Compliance Advisory')
  })

  it('throws on invalid response structure', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ bad: 'data' }) }],
    })

    await expect(generateValueProposition(BASE_CONTEXT)).rejects.toThrow('Invalid value proposition')
  })

  it('handles empty related blocks', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(MOCK_VALUE_PROP_RESPONSE) }],
    })

    const result = await generateValueProposition({ orgName: 'Thornfield' })

    expect(result.target_audience).toBeTruthy()
    expect(mockCreate).toHaveBeenCalledOnce()
  })
})
