import Anthropic from '@anthropic-ai/sdk'
import { logger } from '@/lib/logger'
import type { StepHandler } from './types'

const MODEL = 'claude-sonnet-4-6'

/**
 * ai_risk_assessment handler — performs policy-aware risk scoring via Claude.
 *
 * Step config:
 * - ai_prompt: string (optional) — additional risk assessment instructions
 * - ai_risk_categories: string[] (optional) — risk categories to evaluate
 * - ai_context_block_id: UUID (defaults to source block)
 * - ai_include_policies: boolean (default true) — include org policy blocks in context
 */
const handler: StepHandler = async (step, meta, orgId, supabase) => {
  const now = new Date().toISOString()
  const stepAny = step as Record<string, unknown>

  const prompt = (stepAny.ai_prompt as string) ?? ''
  const riskCategories = (stepAny.ai_risk_categories as string[]) ?? ['operational', 'financial', 'compliance', 'reputational']
  const contextBlockId = (stepAny.ai_context_block_id as string) ?? meta.source_block_id
  const includePolicies = (stepAny.ai_include_policies as boolean) !== false

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

  // Optionally fetch org policy blocks for context
  let policyContext = ''
  if (includePolicies) {
    const { data: policies } = await supabase
      .from('blocks')
      .select('name, metadata')
      .eq('org_id', orgId)
      .eq('type', 'policy')
      .limit(5)

    if (policies && policies.length > 0) {
      policyContext = '\n--- Org Policies ---\n' + policies.map((p) =>
        `Policy: ${p.name}\n${JSON.stringify(sanitizeForAI(p.metadata ?? {}), null, 2)}`
      ).join('\n\n')
    }
  }

  const systemPrompt = [
    'You are a risk assessment AI for an operations management system.',
    'Evaluate the given block data against org policies and produce a structured risk assessment.',
    'Respond with valid JSON only: { "overall_risk_score": <1-10>, "risk_level": "low|medium|high|critical",',
    '"risks": [{ "category": "<category>", "score": <1-10>, "description": "<brief>", "mitigation": "<suggestion>" }],',
    '"summary": "<1-2 sentences>" }',
    'No markdown fences.',
  ].join('\n')

  const userMessage = [
    prompt ? `Assessment instructions: ${prompt}` : '',
    `Risk categories to evaluate: ${riskCategories.join(', ')}`,
    '',
    `Block: "${block.name}" (type: ${block.type})`,
    '--- Block Data ---',
    JSON.stringify(safeMetadata, null, 2),
    policyContext,
  ].filter(Boolean).join('\n')

  try {
    const anthropic = new Anthropic()
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const textContent = response.content.find((c) => c.type === 'text')
    const rawText = textContent?.text ?? ''

    let assessment: {
      overall_risk_score: number
      risk_level: string
      risks: Array<{ category: string; score: number; description: string; mitigation: string }>
      summary: string
    }

    try {
      assessment = JSON.parse(rawText)
    } catch {
      // Fallback: create a basic assessment from raw text
      assessment = {
        overall_risk_score: 5,
        risk_level: 'medium',
        risks: [{ category: 'general', score: 5, description: rawText.slice(0, 200), mitigation: 'Review required' }],
        summary: rawText.slice(0, 200),
      }
    }

    // Clamp risk score to valid range
    assessment.overall_risk_score = Math.max(1, Math.min(10, Math.round(assessment.overall_risk_score)))

    logger.info('step-engine', 'step.ai_risk_assessment_completed', {
      block_id: contextBlockId,
      risk_score: assessment.overall_risk_score,
      risk_level: assessment.risk_level,
      risk_count: assessment.risks?.length ?? 0,
    })

    return {
      step_name: step.name,
      step_type: step.type,
      status: 'completed',
      output: {
        ...assessment,
        block_id: contextBlockId,
        block_type: block.type,
        policies_included: includePolicies,
        tokens_used: response.usage?.output_tokens ?? 0,
      },
      executed_at: now,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI risk assessment failed'
    logger.error('step-engine', 'step.ai_risk_assessment_failed', { error: message.slice(0, 200) })
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
