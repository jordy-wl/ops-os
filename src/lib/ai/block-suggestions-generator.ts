/**
 * Block Suggestions Generator — produces actionable suggestions for any block type.
 *
 * Uses Claude to analyse block data, recent events, and connected blocks,
 * returning typed suggestions with priority levels.
 *
 * Graceful fallback: returns empty array on AI failure.
 * Cached via insights-cache infrastructure (same pattern, separate keys).
 */

import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import { logger } from '@/lib/logger'
import { sanitizePayload } from '@/lib/embeddings'
import {
  getCachedInsights,
  setCachedInsights,
} from '@/lib/ai/insights-cache'

// ─── Types ──────────────────────────────────────────────────────────────────

export type BlockSuggestion = {
  type: 'action' | 'insight' | 'risk' | 'next_step'
  title: string
  body: string
  actionType?: string | null
  priority: 'low' | 'medium' | 'high'
}

export type SuggestionsResult = {
  suggestions: BlockSuggestion[]
  generatedAt: string
  fromCache: boolean
}

type BlockContext = {
  blockId: string
  blockName: string
  blockType: string
  blockState: string
  metadata: Record<string, unknown>
  events: Array<{ type: string; occurred_at: string; payload: Record<string, unknown> }>
  neighbours: Array<{ name: string; type: string }>
  lastEventId: string
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 1024

// ─── Prompt Loading ─────────────────────────────────────────────────────────

let _promptTemplate: string | null = null

function loadPrompt(): string {
  if (!_promptTemplate) {
    try {
      _promptTemplate = fs.readFileSync(
        path.join(process.cwd(), 'src/prompts/block-suggestions.v1.md'),
        'utf-8'
      )
    } catch {
      _promptTemplate = 'Generate 2-4 actionable suggestions for the given block. Return a JSON array.'
    }
  }
  return _promptTemplate
}

// ─── Main Function ──────────────────────────────────────────────────────────

export async function generateBlockSuggestions(
  context: BlockContext
): Promise<SuggestionsResult> {
  // Check cache (reuse insights-cache with block-suggestion prefix)
  const cacheKey = `suggestions_${context.blockId}_${context.lastEventId}`
  const cached = getCachedInsights(cacheKey)
  if (cached) {
    return {
      suggestions: cached.recommendations as unknown as BlockSuggestion[],
      generatedAt: cached.generatedAt,
      fromCache: true,
    }
  }

  // Build context string
  const blockContext = buildContextString(context)
  const prompt = loadPrompt().replace('{blockContext}', blockContext)

  try {
    const anthropic = new Anthropic()
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: prompt,
      messages: [
        {
          role: 'user',
          content: `Generate suggestions for the ${context.blockType} block "${context.blockName}".`,
        },
      ],
    })

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    // Extract JSON from response (handle markdown code fences)
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      logger.warn('block-suggestions', 'suggestions.parse_failed', {
        block_id: context.blockId,
        raw_length: text.length,
      })
      return { suggestions: [], generatedAt: new Date().toISOString(), fromCache: false }
    }

    const suggestions: BlockSuggestion[] = JSON.parse(jsonMatch[0])

    // Validate and sanitize
    const validTypes = new Set(['action', 'insight', 'risk', 'next_step'])
    const validPriorities = new Set(['low', 'medium', 'high'])
    const validated = suggestions
      .filter(
        (s) =>
          validTypes.has(s.type) &&
          validPriorities.has(s.priority) &&
          typeof s.title === 'string' &&
          typeof s.body === 'string'
      )
      .slice(0, 4)

    // Cache the result (reuse insights cache structure)
    const result: SuggestionsResult = {
      suggestions: validated,
      generatedAt: new Date().toISOString(),
      fromCache: false,
    }

    setCachedInsights(cacheKey, {
      whatsDone: [],
      whatsNext: [],
      whatsAtRisk: [],
      recommendations: validated as unknown as string[],
      healthScore: 0,
      generatedAt: result.generatedAt,
      fromCache: false,
    })

    return result
  } catch (err) {
    logger.error('block-suggestions', 'suggestions.generation_failed', {
      block_id: context.blockId,
      error: (err as Error).message?.slice(0, 100),
    })
    return { suggestions: [], generatedAt: new Date().toISOString(), fromCache: false }
  }
}

// ─── Context Builder ────────────────────────────────────────────────────────

function buildContextString(context: BlockContext): string {
  const lines: string[] = []

  lines.push(`Block: "${context.blockName}" (type: ${context.blockType}, state: ${context.blockState})`)

  // Sanitize and include metadata summary
  const sanitized = sanitizePayload(context.metadata)
  const metaStr = JSON.stringify(sanitized).slice(0, 500)
  if (metaStr !== '{}') {
    lines.push(`Metadata: ${metaStr}`)
  }

  // Connected blocks
  if (context.neighbours.length > 0) {
    const connected = context.neighbours.map((n) => `"${n.name}" (${n.type})`).join(', ')
    lines.push(`Connected to: ${connected}`)
  } else {
    lines.push('Connected to: (none)')
  }

  // Recent events
  if (context.events.length > 0) {
    lines.push(`Recent events (${context.events.length}):`)
    for (const event of context.events.slice(0, 10)) {
      const payloadStr = JSON.stringify(sanitizePayload(event.payload)).slice(0, 100)
      lines.push(`  - [${event.occurred_at}] ${event.type}: ${payloadStr}`)
    }
  } else {
    lines.push('Recent events: none')
  }

  return lines.join('\n')
}
