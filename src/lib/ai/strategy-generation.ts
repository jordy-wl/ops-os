/**
 * AI Strategy Generation — generates SWOT analyses and value propositions
 * from block context using Claude.
 */

import Anthropic from '@anthropic-ai/sdk'
import { logger } from '@/lib/logger'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SwotResult {
  strengths: string[]
  weaknesses: string[]
  opportunities: string[]
  threats: string[]
}

export interface ValuePropResult {
  target_audience: string
  unique_value: string
  competitive_advantage: string
  proof_points: string[]
}

export interface StrategyContext {
  orgName?: string
  blockName?: string
  blockType?: string
  blockData?: Record<string, unknown>
  relatedBlocks?: Array<{
    name: string
    type: string
    data?: Record<string, unknown>
  }>
}

// ─── SWOT Generation ────────────────────────────────────────────────────────

const SWOT_SYSTEM_PROMPT = `You are a strategic business analyst. Generate a SWOT analysis based on the provided context.

Return ONLY valid JSON with this exact structure:
{
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "opportunities": ["...", "..."],
  "threats": ["...", "..."]
}

Rules:
- Each quadrant should have 4-7 items
- Each item should be a concise statement (1-2 sentences max)
- Be specific and actionable, not generic
- Consider the industry, market position, and operational context
- Do NOT include any text outside the JSON object`

export async function generateSwotAnalysis(
  context: StrategyContext
): Promise<SwotResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }

  const client = new Anthropic({ apiKey })

  const contextParts: string[] = []
  if (context.orgName) contextParts.push(`Organisation: ${context.orgName}`)
  if (context.blockName) contextParts.push(`Subject: ${context.blockName} (${context.blockType ?? 'entity'})`)
  if (context.blockData) {
    const safeData = sanitizeForPrompt(context.blockData)
    contextParts.push(`Data: ${JSON.stringify(safeData)}`)
  }
  if (context.relatedBlocks?.length) {
    contextParts.push(
      `Related entities:\n${context.relatedBlocks
        .map((b) => `- ${b.name} (${b.type})`)
        .join('\n')}`
    )
  }

  const userPrompt = contextParts.join('\n\n')

  logger.info('ai-strategy', 'swot.generation_started', {
    has_org: !!context.orgName,
    has_block: !!context.blockName,
    related_count: context.relatedBlocks?.length ?? 0,
  })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SWOT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')

  const parsed = JSON.parse(text) as SwotResult

  // Validate structure
  if (
    !Array.isArray(parsed.strengths) ||
    !Array.isArray(parsed.weaknesses) ||
    !Array.isArray(parsed.opportunities) ||
    !Array.isArray(parsed.threats)
  ) {
    throw new Error('Invalid SWOT response structure')
  }

  logger.info('ai-strategy', 'swot.generation_completed', {
    strengths_count: parsed.strengths.length,
    weaknesses_count: parsed.weaknesses.length,
    opportunities_count: parsed.opportunities.length,
    threats_count: parsed.threats.length,
  })

  return parsed
}

// ─── Value Proposition Generation ───────────────────────────────────────────

const VALUE_PROP_SYSTEM_PROMPT = `You are a product strategist. Generate a value proposition based on the provided context.

Return ONLY valid JSON with this exact structure:
{
  "target_audience": "Who this value proposition is for",
  "unique_value": "The unique value or benefit delivered",
  "competitive_advantage": "What differentiates this from competitors",
  "proof_points": ["Evidence point 1", "Evidence point 2", "Evidence point 3"]
}

Rules:
- target_audience should be specific (not just "businesses")
- unique_value should be a clear, compelling statement
- competitive_advantage should reference specific differentiators
- Include 3-5 proof points
- Be specific and actionable based on the context provided
- Do NOT include any text outside the JSON object`

export async function generateValueProposition(
  context: StrategyContext
): Promise<ValuePropResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }

  const client = new Anthropic({ apiKey })

  const contextParts: string[] = []
  if (context.orgName) contextParts.push(`Organisation: ${context.orgName}`)
  if (context.relatedBlocks?.length) {
    const products = context.relatedBlocks.filter((b) => b.type === 'product')
    const services = context.relatedBlocks.filter((b) => b.type === 'service')
    const solutions = context.relatedBlocks.filter((b) => b.type === 'solution')
    const clients = context.relatedBlocks.filter((b) => b.type === 'client')

    if (products.length) contextParts.push(`Products: ${products.map((p) => p.name).join(', ')}`)
    if (services.length) contextParts.push(`Services: ${services.map((s) => s.name).join(', ')}`)
    if (solutions.length) contextParts.push(`Solutions: ${solutions.map((s) => s.name).join(', ')}`)
    if (clients.length) contextParts.push(`Client segments served: ${clients.length} clients`)
  }
  if (context.blockData) {
    const safeData = sanitizeForPrompt(context.blockData)
    contextParts.push(`Additional context: ${JSON.stringify(safeData)}`)
  }

  const userPrompt = contextParts.join('\n\n')

  logger.info('ai-strategy', 'value_prop.generation_started', {
    has_org: !!context.orgName,
    related_count: context.relatedBlocks?.length ?? 0,
  })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: VALUE_PROP_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')

  const parsed = JSON.parse(text) as ValuePropResult

  // Validate structure
  if (
    typeof parsed.target_audience !== 'string' ||
    typeof parsed.unique_value !== 'string' ||
    typeof parsed.competitive_advantage !== 'string' ||
    !Array.isArray(parsed.proof_points)
  ) {
    throw new Error('Invalid value proposition response structure')
  }

  logger.info('ai-strategy', 'value_prop.generation_completed', {
    proof_points_count: parsed.proof_points.length,
  })

  return parsed
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Remove PII-sensitive fields before including in prompts. */
function sanitizeForPrompt(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['email', 'phone', 'address', 'ssn', 'tax_id', 'password', 'token', 'secret']
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) continue
    result[key] = value
  }
  return result
}
