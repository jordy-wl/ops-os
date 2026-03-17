import Anthropic from '@anthropic-ai/sdk'
import { logger } from '@/lib/logger'
import type { StepHandler } from './types'

const MODEL = 'claude-sonnet-4-6'

/**
 * ai_summarize handler — summarizes block data + recent events via Claude.
 *
 * Step config:
 * - ai_prompt: string (optional) — additional summary instructions
 * - ai_max_tokens: number (default 512, max 2048)
 * - ai_context_block_id: UUID (defaults to source block)
 * - ai_include_events: boolean (default true) — include recent events in context
 */
const handler: StepHandler = async (step, meta, orgId, supabase) => {
  const now = new Date().toISOString()
  const stepAny = step as Record<string, unknown>

  const prompt = (stepAny.ai_prompt as string) ?? 'Provide a concise executive summary.'
  const maxTokens = Math.min((stepAny.ai_max_tokens as number) ?? 512, 2048)
  const contextBlockId = (stepAny.ai_context_block_id as string) ?? meta.source_block_id
  const includeEvents = (stepAny.ai_include_events as boolean) !== false

  // Fetch block
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

  // Optionally fetch recent events
  let eventSummary = ''
  if (includeEvents) {
    const { data: events } = await supabase
      .from('events')
      .select('type, payload, created_at')
      .eq('block_id', contextBlockId)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (events && events.length > 0) {
      eventSummary = '\n--- Recent Events ---\n' + events.map((e) =>
        `[${e.created_at}] ${e.type}: ${JSON.stringify(e.payload ?? {}).slice(0, 200)}`
      ).join('\n')
    }
  }

  const systemPrompt = [
    'You are a business summarization AI for an operations management system.',
    'Produce a clear, structured summary. Use bullet points where appropriate.',
    'Focus on actionable insights and key facts.',
  ].join('\n')

  const userMessage = [
    prompt,
    '',
    `Block: "${block.name}" (type: ${block.type})`,
    '--- Block Data ---',
    JSON.stringify(safeMetadata, null, 2),
    eventSummary,
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
    const summary = textContent?.text ?? ''

    logger.info('step-engine', 'step.ai_summarize_completed', {
      block_id: contextBlockId,
      summary_length: summary.length,
      tokens_used: response.usage?.output_tokens ?? 0,
    })

    return {
      step_name: step.name,
      step_type: step.type,
      status: 'completed',
      output: {
        summary,
        block_id: contextBlockId,
        block_type: block.type,
        events_included: includeEvents,
        tokens_used: response.usage?.output_tokens ?? 0,
      },
      executed_at: now,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI summarization failed'
    logger.error('step-engine', 'step.ai_summarize_failed', { error: message.slice(0, 200) })
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
