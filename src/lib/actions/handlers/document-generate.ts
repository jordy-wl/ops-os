/**
 * AI Document Generation Action — P2-S9-BE-05
 *
 * Registered as `document.generate` in the action registry.
 * Generates a document from a template (variable interpolation + brand kit)
 * or AI-generates content from a prompt using Claude.
 */

import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import type { ActionHandler, ActionResult } from '@/lib/actions/types'
import type { AuthContext } from '@/lib/auth/withAuth'
import { renderDocument } from '@/lib/documents/renderer'
import type { TemplateBlock, SourceBlock, BrandKit } from '@/lib/documents/renderer'
import { generatePdf } from '@/lib/documents/pdf'
import { logger } from '@/lib/logger'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 4096

const schema = z.object({
  template_id: z.string().uuid().optional(),
  source_block_id: z.string().uuid(),
  prompt: z.string().min(1).max(4000).optional(),
  output_format: z.enum(['html', 'pdf']).default('html'),
  generate_pdf: z.boolean().default(false),
})

type Payload = z.infer<typeof schema>

async function execute(
  payload: Payload,
  ctx: AuthContext,
  supabase: SupabaseClient
): Promise<ActionResult> {
  const actionId = crypto.randomUUID()

  // Fetch source block
  const { data: sourceBlock, error: sourceErr } = await supabase
    .from('blocks')
    .select('id, name, type, state, metadata, created_at, updated_at')
    .eq('id', payload.source_block_id)
    .eq('org_id', ctx.orgId)
    .single()

  if (sourceErr || !sourceBlock) {
    throw new Error(sourceErr?.message ?? 'Source block not found')
  }

  // Fetch brand kit (first one for the org)
  const { data: brandKitBlock } = await supabase
    .from('blocks')
    .select('id, name, metadata')
    .eq('org_id', ctx.orgId)
    .eq('type', 'brand_kit')
    .limit(1)
    .single()

  const brandKit: BrandKit | null = brandKitBlock?.metadata
    ? (brandKitBlock.metadata as unknown as BrandKit)
    : null

  let html: string
  let documentTitle: string

  if (payload.template_id) {
    // Template-based generation
    const { data: templateBlock, error: templateErr } = await supabase
      .from('blocks')
      .select('id, name, metadata')
      .eq('id', payload.template_id)
      .eq('org_id', ctx.orgId)
      .eq('type', 'document_template')
      .single()

    if (templateErr || !templateBlock) {
      throw new Error(templateErr?.message ?? 'Template not found')
    }

    const template: TemplateBlock = {
      id: templateBlock.id,
      name: templateBlock.name,
      metadata: templateBlock.metadata as TemplateBlock['metadata'],
    }

    const source: SourceBlock = {
      id: sourceBlock.id,
      name: sourceBlock.name,
      type: sourceBlock.type,
      state: sourceBlock.state,
      metadata: (sourceBlock.metadata ?? {}) as Record<string, unknown>,
      created_at: sourceBlock.created_at,
      updated_at: sourceBlock.updated_at,
    }

    const result = renderDocument(template, source, brandKit)
    html = result.html
    documentTitle = `${template.name} — ${sourceBlock.name}`

    if (result.missingVariables.length > 0) {
      logger.warn('document-generate', 'document.missing_variables', {
        org_id: ctx.orgId,
        template_id: payload.template_id,
        missing: result.missingVariables,
      })
    }
  } else if (payload.prompt) {
    // AI-based generation
    html = await generateWithAI(
      payload.prompt,
      sourceBlock,
      brandKit,
      ctx.orgId
    )
    documentTitle = `AI Document — ${sourceBlock.name}`
  } else {
    throw new Error('Either template_id or prompt must be provided')
  }

  // Generate PDF if requested
  let pdfBuffer: Buffer | null = null
  if (payload.generate_pdf || payload.output_format === 'pdf') {
    pdfBuffer = generatePdf(html, { title: documentTitle })
  }

  // Record event
  const { data: event } = await supabase
    .from('events')
    .insert({
      org_id: ctx.orgId,
      block_id: payload.source_block_id,
      type: 'document.generated',
      actor_id: ctx.userId,
      actor_type: 'human',
      payload: {
        template_id: payload.template_id ?? null,
        source_block_id: payload.source_block_id,
        output_format: payload.output_format,
        ai_generated: !payload.template_id,
        document_title: documentTitle,
        html_length: html.length,
        pdf_generated: !!pdfBuffer,
        via: 'action/document.generate',
      },
    })
    .select('id')
    .single()

  logger.info('document-generate', 'document.generated', {
    org_id: ctx.orgId,
    action_id: actionId,
    template_id: payload.template_id ?? null,
    source_block_id: payload.source_block_id,
    ai_generated: !payload.template_id,
    html_length: html.length,
  })

  return {
    actionId,
    eventId: event?.id ?? null,
    status: 'completed',
  }
}

/* ---------- AI Generation ---------- */

async function generateWithAI(
  prompt: string,
  sourceBlock: {
    id: string
    name: string
    type: string
    state: string
    metadata: Record<string, unknown> | null
  },
  brandKit: BrandKit | null,
  orgId: string
): Promise<string> {
  const anthropic = new Anthropic()

  const systemPrompt = buildDocGenSystemPrompt(sourceBlock, brandKit)

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  })

  const textContent = response.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('AI generation returned no text content')
  }

  logger.info('document-generate', 'ai.document_generated', {
    org_id: orgId,
    tokens_used: response.usage.output_tokens,
    block_id: sourceBlock.id,
  })

  // Wrap AI-generated content in branded HTML
  const template: TemplateBlock = {
    id: 'ai-generated',
    name: 'AI Generated Document',
    metadata: { template_content: textContent.text },
  }

  const source: SourceBlock = {
    id: sourceBlock.id,
    name: sourceBlock.name,
    type: sourceBlock.type,
    state: sourceBlock.state,
    metadata: (sourceBlock.metadata ?? {}) as Record<string, unknown>,
  }

  const result = renderDocument(template, source, brandKit)
  return result.html
}

function buildDocGenSystemPrompt(
  sourceBlock: {
    name: string
    type: string
    state: string
    metadata: Record<string, unknown> | null
  },
  brandKit: BrandKit | null
): string {
  const parts = [
    'You are a professional document generator for a business operating system.',
    'Generate well-structured, professional document content in Markdown format.',
    'Use proper headings, paragraphs, and formatting.',
    '',
    `## Source Block Context`,
    `- Name: ${sourceBlock.name}`,
    `- Type: ${sourceBlock.type}`,
    `- State: ${sourceBlock.state}`,
  ]

  if (sourceBlock.metadata && Object.keys(sourceBlock.metadata).length > 0) {
    parts.push(`- Metadata: ${JSON.stringify(sourceBlock.metadata, null, 2)}`)
  }

  if (brandKit) {
    parts.push('')
    parts.push('## Brand Context')
    parts.push(`- Company: ${brandKit.company_name}`)
    if (brandKit.tagline) parts.push(`- Tagline: ${brandKit.tagline}`)
    parts.push('Match the brand voice: professional and authoritative.')
  }

  parts.push('')
  parts.push('## Rules')
  parts.push('- Output ONLY the document content in Markdown')
  parts.push('- Do NOT include meta-commentary or explanations')
  parts.push('- Use the source block data naturally within the document')
  parts.push('- Never include placeholder text like [INSERT NAME HERE]')

  return parts.join('\n')
}

export const documentGenerateHandler: ActionHandler<Payload> = { schema, execute }
