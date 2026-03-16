/**
 * DOCX Generator — creates .docx files from Word templates using docxtemplater.
 * Users upload .docx templates with {tag} placeholders (e.g. {client_name}).
 * Tags are filled from block metadata + brand kit data.
 */

import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import { logger } from '@/lib/logger'
import type { SourceBlock, BrandKit } from './renderer'

export interface DocxGenerateInput {
  /** Raw .docx template file as Buffer */
  templateBuffer: Buffer
  /** Source block for variable interpolation */
  source: SourceBlock
  /** Optional brand kit */
  brandKit?: BrandKit | null
  /** Extra variables to merge */
  extraVariables?: Record<string, string>
}

export interface DocxGenerateResult {
  /** Generated .docx as Buffer */
  buffer: Buffer
  /** Tags found in the template */
  foundTags: string[]
  /** Tags that were not resolved */
  missingTags: string[]
}

/**
 * Extract all {tag} placeholders from a .docx template without filling them.
 * Useful for UI preview of what variables a template expects.
 */
export function extractDocxTags(templateBuffer: Buffer): string[] {
  try {
    const zip = new PizZip(templateBuffer)
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{', end: '}' },
    })

    // getFullText() gives us the text content to scan for tags
    const text = doc.getFullText()
    const tagRegex = /\{([^{}]+)\}/g
    const tags = new Set<string>()
    let match
    while ((match = tagRegex.exec(text)) !== null) {
      tags.add(match[1].trim())
    }
    return [...tags]
  } catch (err) {
    logger.warn('docx-generator', 'tag_extraction_failed', {
      error: err instanceof Error ? err.message : 'Unknown error',
    })
    return []
  }
}

/**
 * Build a flat variable map from source block + brand kit for docxtemplater.
 * Maps {client_name} → block.metadata.client_name, {company_name} → brand.company_name, etc.
 */
function buildDocxVariables(
  source: SourceBlock,
  brandKit?: BrandKit | null,
  extra?: Record<string, string>
): Record<string, string> {
  const vars: Record<string, string> = {
    block_name: source.name,
    block_type: source.type,
    block_state: source.state,
  }

  if (source.created_at) vars.created_at = source.created_at
  if (source.updated_at) vars.updated_at = source.updated_at

  // Flatten metadata — {jurisdiction}, {email}, etc.
  if (source.metadata) {
    for (const [key, value] of Object.entries(source.metadata)) {
      if (value !== null && value !== undefined) {
        vars[key] = String(value)
      }
    }
  }

  // Brand variables
  if (brandKit) {
    vars.company_name = brandKit.company_name
    if (brandKit.tagline) vars.tagline = brandKit.tagline
    if (brandKit.primary_color) vars.primary_color = brandKit.primary_color
    if (brandKit.logo_url) vars.logo_url = brandKit.logo_url
  }

  // Extra overrides
  if (extra) {
    Object.assign(vars, extra)
  }

  // Add current date helpers
  const now = new Date()
  vars.current_date = now.toLocaleDateString('en-AU')
  vars.current_year = String(now.getFullYear())

  return vars
}

/**
 * Generate a filled .docx from a template buffer and source data.
 */
export function generateDocx(input: DocxGenerateInput): DocxGenerateResult {
  const zip = new PizZip(input.templateBuffer)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{', end: '}' },
  })

  const variables = buildDocxVariables(input.source, input.brandKit, input.extraVariables)

  // Get all tags in the template
  const text = doc.getFullText()
  const tagRegex = /\{([^{}]+)\}/g
  const foundTags: string[] = []
  const missingTags: string[] = []
  let match
  while ((match = tagRegex.exec(text)) !== null) {
    const tag = match[1].trim()
    foundTags.push(tag)
    if (!(tag in variables)) {
      missingTags.push(tag)
    }
  }

  // Fill template — missing tags become empty strings
  doc.render(variables)

  const buffer = Buffer.from(doc.getZip().generate({ type: 'nodebuffer' }))

  logger.info('docx-generator', 'docx.generated', {
    found_tags: foundTags.length,
    missing_tags: missingTags.length,
    output_size: buffer.length,
  })

  return { buffer, foundTags: [...new Set(foundTags)], missingTags: [...new Set(missingTags)] }
}
