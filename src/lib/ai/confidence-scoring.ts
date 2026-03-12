/**
 * Confidence Scoring — evaluates how confidently an AI agent can handle
 * a workflow task autonomously. The score feeds into the routing engine.
 *
 * Uses Claude to assess task context, not to execute the task.
 */

import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'
import { join } from 'path'
import { logger } from '@/lib/logger'

export interface TaskContext {
  stepInstructions: string
  inputData: Record<string, unknown>
  expectedOutputSchema?: Record<string, unknown>
  stepType: string
  blockType?: string
}

export interface ConfidenceFactors {
  instructionClarity: number
  dataCompleteness: number
  patternMatch: number
  complexityEstimate: number
}

export interface ConfidenceResult {
  score: number
  reasoning: string
  factors: ConfidenceFactors
}

// ─── In-memory cache (TTL: 1 hour) ─────────────────────────────────────────────

interface CacheEntry {
  result: ConfidenceResult
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

function getCacheKey(ctx: TaskContext): string {
  const raw = JSON.stringify({
    instructions: ctx.stepInstructions,
    input: ctx.inputData,
    type: ctx.stepType,
  })
  // Simple string hash
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0
  }
  return `conf_${hash}`
}

function getCached(key: string): ConfidenceResult | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.result
}

function setCache(key: string, result: ConfidenceResult): void {
  cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS })
}

// ─── Default fallback (safe: routes to human) ──────────────────────────────────

const DEFAULT_RESULT: ConfidenceResult = {
  score: 0,
  reasoning: 'Confidence evaluation unavailable — defaulting to human routing',
  factors: {
    instructionClarity: 0,
    dataCompleteness: 0,
    patternMatch: 0,
    complexityEstimate: 0,
  },
}

// ─── Prompt loading ─────────────────────────────────────────────────────────────

let systemPrompt: string | null = null

function getSystemPrompt(): string {
  if (!systemPrompt) {
    try {
      systemPrompt = readFileSync(
        join(process.cwd(), 'src/prompts/confidence-evaluation.v1.md'),
        'utf-8'
      )
    } catch {
      systemPrompt = 'Evaluate the confidence that an AI agent can complete this task. Return JSON with score (0-1), reasoning, and factors (instructionClarity, dataCompleteness, patternMatch, complexityEstimate).'
    }
  }
  return systemPrompt
}

// ─── Main function ──────────────────────────────────────────────────────────────

/**
 * Evaluate confidence that an AI agent can handle a task autonomously.
 *
 * Returns a score 0.0-1.0 and breakdown factors. On failure, returns 0.0
 * (safe fallback: routes to human).
 */
export async function evaluateConfidence(ctx: TaskContext): Promise<ConfidenceResult> {
  // Check cache first
  const cacheKey = getCacheKey(ctx)
  const cached = getCached(cacheKey)
  if (cached) return cached

  try {
    const client = new Anthropic()

    const userMessage = buildUserMessage(ctx)

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: getSystemPrompt(),
      messages: [{ role: 'user', content: userMessage }],
    })

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    const result = parseConfidenceResponse(text)

    // Cache successful result
    setCache(cacheKey, result)

    logger.info('ai-confidence', 'confidence.evaluated', {
      score: result.score,
      step_type: ctx.stepType,
      tokens_in: response.usage.input_tokens,
      tokens_out: response.usage.output_tokens,
    })

    return result
  } catch (err) {
    logger.error('ai-confidence', 'confidence.evaluation_failed', {
      error: err instanceof Error ? err.message : 'Unknown',
      step_type: ctx.stepType,
    })
    return DEFAULT_RESULT
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function buildUserMessage(ctx: TaskContext): string {
  const parts: string[] = [
    `## Task Type: ${ctx.stepType}`,
  ]

  if (ctx.blockType) {
    parts.push(`## Block Type: ${ctx.blockType}`)
  }

  parts.push(`## Step Instructions\n${ctx.stepInstructions || '(no instructions provided)'}`)

  parts.push(`## Input Data\n\`\`\`json\n${JSON.stringify(ctx.inputData, null, 2)}\n\`\`\``)

  if (ctx.expectedOutputSchema) {
    parts.push(`## Expected Output Schema\n\`\`\`json\n${JSON.stringify(ctx.expectedOutputSchema, null, 2)}\n\`\`\``)
  }

  return parts.join('\n\n')
}

function parseConfidenceResponse(text: string): ConfidenceResult {
  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return DEFAULT_RESULT

  try {
    const parsed = JSON.parse(jsonMatch[0])

    const factors: ConfidenceFactors = {
      instructionClarity: clampScore(parsed.factors?.instructionClarity ?? 0),
      dataCompleteness: clampScore(parsed.factors?.dataCompleteness ?? 0),
      patternMatch: clampScore(parsed.factors?.patternMatch ?? 0),
      complexityEstimate: clampScore(parsed.factors?.complexityEstimate ?? 0),
    }

    return {
      score: clampScore(parsed.score ?? 0),
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : 'No reasoning provided',
      factors,
    }
  } catch {
    return DEFAULT_RESULT
  }
}

function clampScore(value: unknown): number {
  const num = typeof value === 'number' ? value : 0
  return Math.round(Math.min(1, Math.max(0, num)) * 100) / 100
}
