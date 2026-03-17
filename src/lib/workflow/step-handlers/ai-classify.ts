import Anthropic from '@anthropic-ai/sdk'
import { logger } from '@/lib/logger'
import type { StepHandler } from './types'

const MODEL = 'claude-sonnet-4-6'

/**
 * ai_classify handler — classifies a block into categories using Claude.
 *
 * Step config:
 * - ai_categories: string[] (required) — possible categories
 * - ai_prompt: string (optional) — additional classification instructions
 * - ai_context_block_id: UUID (defaults to source block)
 */
const handler: StepHandler = async (step, meta, orgId, supabase) => {
  const now = new Date().toISOString()
  const stepAny = step as Record<string, unknown>

  const categories = stepAny.ai_categories as string[] | undefined
  const prompt = (stepAny.ai_prompt as string) ?? ''
  const contextBlockId = (stepAny.ai_context_block_id as string) ?? meta.source_block_id

  if (!categories || !Array.isArray(categories) || categories.length < 2) {
    return { step_name: step.name, step_type: step.type, status: 'failed', error: 'ai_categories must be an array with at least 2 items', executed_at: now }
  }

  // Fetch block context
  const { data: block } = await supabase
    .from('blocks')
    .select('id, name, type, metadata')
    .eq('id', contextBlockId)
    .eq('org_id', orgId)
    .single()

  if (!block) {
    return { step_name: step.name, step_type: step.type, status: 'failed', error: `Block ${contextBlockId} not found`, executed_at: now }
  }

  const safeMetadata = sanitizeForAI(block.metadata ?? {})

  const systemPrompt = [
    'You are a classification AI. Classify the given data into exactly one of the provided categories.',
    'Respond with valid JSON only: { "category": "<chosen>", "confidence": <0.0-1.0>, "reasoning": "<brief>" }',
    'No markdown fences.',
  ].join('\n')

  const userMessage = [
    `Categories: ${categories.join(', ')}`,
    prompt ? `Instructions: ${prompt}` : '',
    '',
    `Block: "${block.name}" (type: ${block.type})`,
    JSON.stringify(safeMetadata, null, 2),
  ].filter(Boolean).join('\n')

  try {
    const anthropic = new Anthropic()
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 256,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const textContent = response.content.find((c) => c.type === 'text')
    const rawText = textContent?.text ?? ''

    let result: { category: string; confidence: number; reasoning: string }
    try {
      result = JSON.parse(rawText)
    } catch {
      // Fallback: try to extract category from text
      const match = categories.find((c) => rawText.toLowerCase().includes(c.toLowerCase()))
      result = { category: match ?? 'unknown', confidence: match ? 0.5 : 0, reasoning: rawText.slice(0, 200) }
    }

    // Validate category is in the allowed list
    if (!categories.includes(result.category)) {
      const closest = categories.find((c) => c.toLowerCase() === result.category?.toLowerCase())
      if (closest) result.category = closest
    }

    logger.info('step-engine', 'step.ai_classify_completed', {
      block_id: contextBlockId,
      category: result.category,
      confidence: result.confidence,
    })

    return {
      step_name: step.name,
      step_type: step.type,
      status: 'completed',
      output: {
        category: result.category,
        confidence: result.confidence,
        reasoning: result.reasoning,
        block_id: contextBlockId,
        tokens_used: response.usage?.output_tokens ?? 0,
      },
      executed_at: now,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI classification failed'
    logger.error('step-engine', 'step.ai_classify_failed', { error: message.slice(0, 200) })
    return { step_name: step.name, step_type: step.type, status: 'failed', error: message, executed_at: now }
  }
}

function sanitizeForAI(metadata: Record<string, unknown>): Record<string, unknown> {
  const piiFields = ['email', 'phone', 'address', 'ssn', 'tax_id', 'bank_account', 'credit_card']
  const cleaned: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (piiFields.some((f) => key.toLowerCase().includes(f))) {
      cleaned[key] = '[REDACTED]'
    } else {
      cleaned[key] = value
    }
  }
  return cleaned
}

export default handler
