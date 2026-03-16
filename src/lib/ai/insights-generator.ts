/**
 * AI Insights Generator — takes a DeltaResult plus block context and
 * generates human-readable insights via Claude.
 *
 * Output: four sections (whatsDone, whatsNext, whatsAtRisk, recommendations)
 * plus healthScore and metadata.
 *
 * Follows the same patterns as confidence-scoring.ts:
 * - Anthropic SDK with claude-sonnet-4-6
 * - Prompt loaded from file with inline fallback
 * - JSON extraction from response
 * - Graceful degradation on failure
 * - In-memory cache via insights-cache.ts
 */

import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'
import { join } from 'path'
import { logger } from '@/lib/logger'
import type { DeltaResult } from './delta-types'
import {
  buildCacheKey,
  getCachedInsights,
  setCachedInsights,
} from './insights-cache'

// ─── Types ──────────────────────────────────────────────────────────────────────

export type InsightsResult = {
  whatsDone: string[]
  whatsNext: string[]
  whatsAtRisk: string[]
  recommendations: string[]
  healthScore: number
  generatedAt: string
  fromCache: boolean
}

export type BlockContext = {
  blockId: string
  blockType: string
  blockName: string
  lastEventId: string
}

// ─── Raw AI Output Schema ───────────────────────────────────────────────────────

type RawInsightsOutput = {
  whatsDone?: unknown
  whatsNext?: unknown
  whatsAtRisk?: unknown
  recommendations?: unknown
}

// ─── Prompt Loading ─────────────────────────────────────────────────────────────

let systemPrompt: string | null = null

function getSystemPrompt(): string {
  if (!systemPrompt) {
    try {
      systemPrompt = readFileSync(
        join(process.cwd(), 'src/prompts/delta-insights.v1.md'),
        'utf-8'
      )
    } catch {
      systemPrompt =
        'Analyse the workflow delta and generate insights as JSON with keys: whatsDone, whatsNext, whatsAtRisk, recommendations. Each is an array of concise bullet strings.'
    }
  }
  return systemPrompt
}

// ─── Main Function ──────────────────────────────────────────────────────────────

/**
 * Generate human-readable insights from a delta analysis and block context.
 *
 * Returns cached result if available. On Claude failure, returns a plain-text
 * fallback derived directly from the delta data (no AI needed).
 */
export async function generateInsights(
  delta: DeltaResult,
  blockContext: BlockContext
): Promise<InsightsResult> {
  // Check cache first
  const cacheKey = buildCacheKey(blockContext.blockId, blockContext.lastEventId)
  const cached = getCachedInsights(cacheKey)
  if (cached) {
    logger.info('ai-insights', 'insights.cache_hit', {
      block_id: blockContext.blockId,
    })
    return cached
  }

  try {
    const client = new Anthropic()
    const userMessage = buildUserMessage(delta, blockContext)

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: getSystemPrompt(),
      messages: [{ role: 'user', content: userMessage }],
    })

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    const parsed = parseInsightsResponse(text)
    const result: InsightsResult = {
      ...parsed,
      healthScore: delta.healthScore.score,
      generatedAt: new Date().toISOString(),
      fromCache: false,
    }

    // Cache the successful result
    setCachedInsights(cacheKey, result)

    logger.info('ai-insights', 'insights.generated', {
      block_id: blockContext.blockId,
      health_score: result.healthScore,
      tokens_in: response.usage.input_tokens,
      tokens_out: response.usage.output_tokens,
      sections: {
        done: result.whatsDone.length,
        next: result.whatsNext.length,
        risk: result.whatsAtRisk.length,
        recs: result.recommendations.length,
      },
    })

    return result
  } catch (err) {
    logger.error('ai-insights', 'insights.generation_failed', {
      block_id: blockContext.blockId,
      error: err instanceof Error ? err.message : 'Unknown',
    })

    // Graceful degradation: build insights from delta data directly
    return buildFallbackInsights(delta, blockContext)
  }
}

// ─── User Message Builder ───────────────────────────────────────────────────────

function buildUserMessage(delta: DeltaResult, ctx: BlockContext): string {
  const parts: string[] = []

  // Block context (no PII — only type and generic name)
  parts.push(`## Block Context\n- Type: ${ctx.blockType}\n- Name: ${ctx.blockName}`)

  // Delta summary
  parts.push(
    `## Delta Summary\n` +
    `- Instance status: ${delta.status}\n` +
    `- Total steps: ${delta.totalSteps}\n` +
    `- Completed: ${delta.completedSteps.length}\n` +
    `- Remaining: ${delta.remainingSteps.length}\n` +
    `- Current step index: ${delta.currentStepIndex}`
  )

  // Health score
  parts.push(
    `## Health Score: ${delta.healthScore.score}/100\n` +
    `- Overdue penalty: ${delta.healthScore.overduePenalty}\n` +
    `- Skip penalty: ${delta.healthScore.skipPenalty}\n` +
    `- Variance penalty: ${delta.healthScore.variancePenalty}`
  )

  // Completed steps detail
  if (delta.completedSteps.length > 0) {
    const lines = delta.completedSteps.map(
      (s) =>
        `- [${s.status}] ${s.stepName} (${s.stepType})` +
        (s.varianceHours !== null
          ? ` — variance: ${s.varianceHours > 0 ? '+' : ''}${s.varianceHours}h`
          : '')
    )
    parts.push(`## Completed Steps\n${lines.join('\n')}`)
  }

  // Remaining steps detail
  if (delta.remainingSteps.length > 0) {
    const lines = delta.remainingSteps.map(
      (s) =>
        `- [${s.status}] ${s.stepName} (${s.stepType})` +
        ` — expected: ${s.expectedDurationHours}h` +
        (s.actualDurationHours !== null ? `, elapsed: ${s.actualDurationHours}h` : '')
    )
    parts.push(`## Remaining Steps\n${lines.join('\n')}`)
  }

  // Gap analysis
  const gaps: string[] = []
  if (delta.gapAnalysis.overdueSteps.length > 0) {
    for (const s of delta.gapAnalysis.overdueSteps) {
      gaps.push(`- OVERDUE: ${s.stepName} by ${s.overdueByHours}h`)
    }
  }
  if (delta.gapAnalysis.skippedSteps.length > 0) {
    for (const s of delta.gapAnalysis.skippedSteps) {
      gaps.push(`- SKIPPED: ${s.stepName}`)
    }
  }
  if (delta.gapAnalysis.outOfOrderSteps.length > 0) {
    for (const s of delta.gapAnalysis.outOfOrderSteps) {
      gaps.push(
        `- OUT OF ORDER: ${s.stepName} (expected position ${s.expectedOrder}, executed at ${s.actualOrder})`
      )
    }
  }
  if (gaps.length > 0) {
    parts.push(`## Gap Analysis\n${gaps.join('\n')}`)
  }

  return parts.join('\n\n')
}

// ─── Response Parser ────────────────────────────────────────────────────────────

function parseInsightsResponse(
  text: string
): Pick<InsightsResult, 'whatsDone' | 'whatsNext' | 'whatsAtRisk' | 'recommendations'> {
  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return emptyInsightsSections()
  }

  try {
    const parsed: RawInsightsOutput = JSON.parse(jsonMatch[0])

    return {
      whatsDone: toStringArray(parsed.whatsDone),
      whatsNext: toStringArray(parsed.whatsNext),
      whatsAtRisk: toStringArray(parsed.whatsAtRisk),
      recommendations: toStringArray(parsed.recommendations),
    }
  } catch {
    return emptyInsightsSections()
  }
}

/**
 * Safely coerce an unknown value to string[].
 * Filters out non-string entries and limits to 5 items.
 */
function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string' && item.length > 0)
    .slice(0, 5)
}

function emptyInsightsSections(): Pick<
  InsightsResult,
  'whatsDone' | 'whatsNext' | 'whatsAtRisk' | 'recommendations'
> {
  return {
    whatsDone: [],
    whatsNext: [],
    whatsAtRisk: [],
    recommendations: [],
  }
}

// ─── Fallback Builder (no AI) ───────────────────────────────────────────────────

/**
 * Build insights directly from delta data when Claude is unavailable.
 * Returns factual statements derived from the delta analysis — no AI needed.
 */
export function buildFallbackInsights(
  delta: DeltaResult,
  blockContext: BlockContext
): InsightsResult {
  const whatsDone: string[] = []
  const whatsNext: string[] = []
  const whatsAtRisk: string[] = []
  const recommendations: string[] = []

  // What's done
  for (const step of delta.completedSteps.slice(0, 5)) {
    const timing =
      step.varianceHours !== null && step.varianceHours !== 0
        ? step.varianceHours > 0
          ? ` (${step.varianceHours}h over expected)`
          : ` (${Math.abs(step.varianceHours)}h ahead of schedule)`
        : ''
    whatsDone.push(`${step.stepName} ${step.status}${timing}.`)
  }
  if (whatsDone.length === 0) {
    whatsDone.push('No steps completed yet.')
  }

  // What's next
  for (const step of delta.remainingSteps.slice(0, 5)) {
    const elapsed =
      step.actualDurationHours !== null
        ? ` (${step.actualDurationHours}h elapsed of ${step.expectedDurationHours}h expected)`
        : ` (expected: ${step.expectedDurationHours}h)`
    whatsNext.push(`${step.stepName} [${step.status}]${elapsed}.`)
  }
  if (whatsNext.length === 0) {
    whatsNext.push('All steps completed.')
  }

  // What's at risk
  for (const s of delta.gapAnalysis.overdueSteps.slice(0, 3)) {
    whatsAtRisk.push(`${s.stepName} is overdue by ${s.overdueByHours} hours.`)
  }
  for (const s of delta.gapAnalysis.skippedSteps.slice(0, 2)) {
    whatsAtRisk.push(`${s.stepName} was skipped.`)
  }
  if (whatsAtRisk.length === 0) {
    whatsAtRisk.push('No current risks identified.')
  }

  // Recommendations
  if (delta.healthScore.score < 50) {
    recommendations.push(
      `Workflow health is critically low (${delta.healthScore.score}/100). Review overdue and skipped steps immediately.`
    )
  } else if (delta.healthScore.score < 80) {
    recommendations.push(
      `Workflow health is degraded (${delta.healthScore.score}/100). Address overdue steps to improve health.`
    )
  }
  if (delta.gapAnalysis.overdueSteps.length > 0) {
    const worst = delta.gapAnalysis.overdueSteps.reduce((a, b) =>
      a.overdueByHours > b.overdueByHours ? a : b
    )
    recommendations.push(
      `Prioritise resolving ${worst.stepName} — it is ${worst.overdueByHours} hours overdue.`
    )
  }
  if (delta.gapAnalysis.skippedSteps.length > 0) {
    recommendations.push(
      `Review skipped steps to determine if they should be completed or formally removed from the workflow.`
    )
  }
  if (recommendations.length === 0) {
    recommendations.push('Workflow is on track. Continue monitoring.')
  }

  return {
    whatsDone,
    whatsNext,
    whatsAtRisk,
    recommendations,
    healthScore: delta.healthScore.score,
    generatedAt: new Date().toISOString(),
    fromCache: false,
  }
}
