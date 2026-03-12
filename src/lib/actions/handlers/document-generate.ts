/**
 * AI Document Generation Action — P2-S9-BE-05, enhanced P3-S6-AI-01
 *
 * Registered as `document.generate` in the action registry.
 * Generates a document from a template (variable interpolation + brand kit)
 * or AI-generates content from a prompt using Claude.
 *
 * P3-S6-AI-01: Context-aware generation — assembles connected blocks,
 * recent events, and reference template structure into the AI prompt.
 */

import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import type { ActionHandler, ActionResult } from '@/lib/actions/types'
import type { AuthContext } from '@/lib/auth/withAuth'
import { renderDocument } from '@/lib/documents/renderer'
import type { TemplateBlock, SourceBlock, BrandKit } from '@/lib/documents/renderer'
import { generatePdf } from '@/lib/documents/pdf'
import { storeDocument } from '@/lib/documents/storage'
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
    // AI-based generation with rich context
    const docContext = await assembleDocumentContext(
      supabase,
      ctx.orgId,
      payload.source_block_id,
      null
    )
    html = await generateWithAI(
      payload.prompt,
      sourceBlock,
      brandKit,
      ctx.orgId,
      docContext
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

  // Store document with versioning
  let documentId: string | null = null
  try {
    const doc = await storeDocument(supabase, {
      orgId: ctx.orgId,
      blockId: payload.source_block_id,
      title: documentTitle,
      format: pdfBuffer ? 'pdf' : 'html',
      htmlContent: html,
      pdfBuffer: pdfBuffer ?? undefined,
      templateId: payload.template_id,
      aiGenerated: !payload.template_id,
      generationMetadata: {
        prompt: payload.prompt ?? null,
        output_format: payload.output_format,
        html_length: html.length,
      },
      createdBy: ctx.userId,
    })
    documentId = doc.id
  } catch {
    // Non-blocking — document generation succeeds even if storage fails
    logger.warn('document-generate', 'document.storage_failed', {
      org_id: ctx.orgId,
      source_block_id: payload.source_block_id,
    })
  }

  logger.info('document-generate', 'document.generated', {
    org_id: ctx.orgId,
    action_id: actionId,
    template_id: payload.template_id ?? null,
    source_block_id: payload.source_block_id,
    ai_generated: !payload.template_id,
    html_length: html.length,
    document_id: documentId,
    context_aware: !payload.template_id,
  })

  return {
    actionId,
    eventId: event?.id ?? null,
    documentId,
    status: 'completed',
  }
}

/* ---------- Context Assembly for Document Generation ---------- */

interface DocumentContext {
  connectedBlocks: Array<{
    name: string
    type: string
    state: string
    metadata: Record<string, unknown>
  }>
  recentEvents: Array<{
    type: string
    occurred_at: string
    payload: Record<string, unknown>
  }>
  referenceStructure: string | null
}

/**
 * Assemble rich context for AI document generation:
 * - Connected blocks (via block_edges, 1 hop)
 * - Recent events for the source block
 * - Reference template structure if available
 */
async function assembleDocumentContext(
  supabase: SupabaseClient,
  orgId: string,
  blockId: string,
  templateMetadata?: Record<string, unknown> | null
): Promise<DocumentContext> {
  // Fetch connected blocks and recent events in parallel
  const [edgesResult, eventsResult] = await Promise.all([
    supabase
      .from('block_edges')
      .select('from_block_id, to_block_id')
      .eq('org_id', orgId)
      .or(`from_block_id.eq.${blockId},to_block_id.eq.${blockId}`)
      .limit(20),
    supabase
      .from('events')
      .select('type, occurred_at, payload')
      .eq('block_id', blockId)
      .eq('org_id', orgId)
      .order('occurred_at', { ascending: false })
      .limit(10),
  ])

  // Fetch connected block details
  let connectedBlocks: DocumentContext['connectedBlocks'] = []
  const edges = edgesResult.data as Array<{ from_block_id: string; to_block_id: string }> | null
  if (edges && edges.length > 0) {
    const neighbourIds = [
      ...new Set(
        edges
          .flatMap((e) => [e.from_block_id, e.to_block_id])
          .filter((id) => id !== blockId)
      ),
    ]
    if (neighbourIds.length > 0) {
      const { data: neighbours } = await supabase
        .from('blocks')
        .select('name, type, state, metadata')
        .in('id', neighbourIds)
        .eq('org_id', orgId)

      connectedBlocks = (neighbours ?? []).map((n) => ({
        name: n.name as string,
        type: n.type as string,
        state: n.state as string,
        metadata: (n.metadata ?? {}) as Record<string, unknown>,
      }))
    }
  }

  const recentEvents = ((eventsResult.data ?? []) as Array<{
    type: string
    occurred_at: string
    payload: Record<string, unknown>
  }>)

  // Extract reference template structure if available
  const referenceStructure = templateMetadata
    ? (templateMetadata.structure_description as string) ?? null
    : null

  return { connectedBlocks, recentEvents, referenceStructure }
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
  orgId: string,
  docContext: DocumentContext
): Promise<string> {
  const anthropic = new Anthropic()

  const systemPrompt = buildDocGenSystemPrompt(sourceBlock, brandKit, docContext)

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
    connected_blocks: docContext.connectedBlocks.length,
    events_in_context: docContext.recentEvents.length,
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
  brandKit: BrandKit | null,
  docContext: DocumentContext
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

  // Connected blocks context
  if (docContext.connectedBlocks.length > 0) {
    parts.push('')
    parts.push('## Connected Blocks')
    for (const block of docContext.connectedBlocks) {
      parts.push(`- ${block.name} (${block.type}, ${block.state})`)
      const metaKeys = Object.keys(block.metadata).filter((k) => !k.startsWith('x-'))
      if (metaKeys.length > 0) {
        const summary = metaKeys
          .slice(0, 8)
          .map((k) => `${k}: ${String(block.metadata[k]).slice(0, 80)}`)
          .join(', ')
        parts.push(`  Data: ${summary}`)
      }
    }
  }

  // Recent events context
  if (docContext.recentEvents.length > 0) {
    parts.push('')
    parts.push('## Recent Activity')
    for (const event of docContext.recentEvents.slice(0, 8)) {
      const payloadSummary = JSON.stringify(event.payload).slice(0, 120)
      parts.push(`- [${event.occurred_at}] ${event.type}: ${payloadSummary}`)
    }
  }

  // Reference template structure
  if (docContext.referenceStructure) {
    parts.push('')
    parts.push('## Reference Document Structure')
    parts.push('Match the style, structure, and tone of this reference document:')
    parts.push(docContext.referenceStructure.slice(0, 2000))
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
  parts.push('- Use the source block data and connected blocks naturally within the document')
  parts.push('- Incorporate relevant recent events and activity where appropriate')
  parts.push('- Never include placeholder text like [INSERT NAME HERE]')
  if (docContext.referenceStructure) {
    parts.push('- Follow the reference document structure closely')
  }

  return parts.join('\n')
}

export const documentGenerateHandler: ActionHandler<Payload> = { schema, execute }
