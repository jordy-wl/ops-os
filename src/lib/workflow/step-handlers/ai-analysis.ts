import Anthropic from '@anthropic-ai/sdk'
import { logger } from '@/lib/logger'
import { resolveTemplateBlockId } from './resolve-block-ref'
import type { StepHandler } from './types'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 1024

/**
 * ai_analysis handler — runs structured AI analysis on block data via Claude.
 *
 * Step config:
 * - ai_prompt: string (required) — analysis instructions
 * - ai_output_format: 'json' | 'text' (default 'json')
 * - ai_max_tokens: number (default 1024, max 4096)
 * - ai_context_block_id: UUID of block to analyze (defaults to source block)
 */
const handler: StepHandler = async (step, meta, orgId, supabase) => {
  const now = new Date().toISOString()
  const stepAny = step as Record<string, unknown>

  const prompt = stepAny.ai_prompt as string | undefined
  const outputFormat = (stepAny.ai_output_format as string) ?? 'json'
  const maxTokens = Math.min((stepAny.ai_max_tokens as number) ?? MAX_TOKENS, 4096)

  if (!prompt) {
    return { step_name: step.name, step_type: step.type, status: 'failed', error: 'Missing ai_prompt', executed_at: now }
  }

  const blockIdResult = await resolveTemplateBlockId(stepAny.ai_context_block_id as string | undefined, meta, orgId, supabase)
  if (blockIdResult.error || !blockIdResult.blockId) {
    return { step_name: step.name, step_type: step.type, status: 'failed', error: blockIdResult.error ?? 'Could not resolve ai_context_block_id', executed_at: now }
  }
  const contextBlockId = blockIdResult.blockId

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

  // Sanitize metadata — strip PII fields before sending to Claude
  const safeMetadata = sanitizeForAI(block.metadata ?? {})

  const systemPrompt = [
    'You are a business analysis AI for an operations management system.',
    `Analyzing block: "${block.name}" (type: ${block.type})`,
    outputFormat === 'json'
      ? 'Respond with valid JSON only. No markdown fences.'
      : 'Respond with clear, structured text.',
  ].join('\n')

  const userMessage = [
    prompt,
    '',
    '--- Block Data ---',
    JSON.stringify(safeMetadata, null, 2),
  ].join('\n')

  try {
    const anthropic = new Anthropic()
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const textContent = response.content.find((c) => c.type === 'text')
    const rawText = textContent?.text ?? ''

    let analysis: unknown = rawText
    if (outputFormat === 'json') {
      try {
        analysis = JSON.parse(rawText)
      } catch {
        analysis = { raw_text: rawText, parse_error: true }
      }
    }

    logger.info('step-engine', 'step.ai_analysis_completed', {
      block_id: contextBlockId,
      tokens_used: response.usage?.output_tokens ?? 0,
    })

    return {
      step_name: step.name,
      step_type: step.type,
      status: 'completed',
      output: {
        analysis,
        block_id: contextBlockId,
        block_type: block.type,
        format: outputFormat,
        tokens_used: response.usage?.output_tokens ?? 0,
      },
      executed_at: now,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI analysis failed'
    logger.error('step-engine', 'step.ai_analysis_failed', { error: message.slice(0, 200) })
    return { step_name: step.name, step_type: step.type, status: 'failed', error: message, executed_at: now }
  }
}

/** Strip fields that might contain PII before sending to Claude */
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
