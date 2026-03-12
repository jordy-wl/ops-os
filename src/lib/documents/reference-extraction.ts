/**
 * Reference Template Extraction — P3-S6-BE-01
 *
 * Extracts structure and layout description from uploaded reference documents
 * using Claude AI. Supports PDF (text extraction), HTML, and plain text.
 */

import Anthropic from '@anthropic-ai/sdk'
import { logger } from '@/lib/logger'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 2048

export interface ExtractionResult {
  structureDescription: string
  detectedVariables: Array<{ name: string; type: string; description: string }>
  suggestedCategory: string
}

/**
 * Extract structure description from document content.
 * For PDF files, the caller should extract text first.
 * For HTML files, the raw HTML is analyzed.
 */
export async function extractTemplateStructure(
  content: string,
  fileName: string,
  mimeType: string
): Promise<ExtractionResult> {
  const anthropic = new Anthropic()

  const systemPrompt = `You are a document structure analyzer for a business operating system.
Analyze the provided document and extract:
1. A concise description of the document's structure and layout (sections, headings, tables, formatting patterns)
2. Variables or placeholder fields that should be filled in dynamically (e.g., client name, date, amounts)
3. A suggested category for this template

Respond in JSON format only:
{
  "structure_description": "A 2-3 sentence description of the document structure, sections, and formatting",
  "detected_variables": [
    { "name": "variable_name", "type": "string|number|date|currency", "description": "what this field represents" }
  ],
  "suggested_category": "contract|proposal|nda|report|letter|invoice|other"
}

Rules:
- Be concise in the structure description
- Only include variables that are clearly placeholder-like (names, dates, amounts, company names)
- Variable names should be snake_case
- Choose the most specific category that fits`

  const userMessage = `Analyze this document (${fileName}, type: ${mimeType}):\n\n${content.slice(0, 15000)}`

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const textContent = response.content.find((c) => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('AI returned no text content')
    }

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = textContent.text.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const parsed = JSON.parse(jsonStr)

    logger.info('reference-extraction', 'structure.extracted', {
      file_name: fileName,
      variables_count: parsed.detected_variables?.length ?? 0,
      category: parsed.suggested_category,
      tokens_used: response.usage.output_tokens,
    })

    return {
      structureDescription: parsed.structure_description ?? '',
      detectedVariables: (parsed.detected_variables ?? []).map(
        (v: { name: string; type: string; description: string }) => ({
          name: v.name,
          type: v.type ?? 'string',
          description: v.description ?? '',
        })
      ),
      suggestedCategory: parsed.suggested_category ?? 'other',
    }
  } catch (err) {
    logger.error('reference-extraction', 'extraction.failed', {
      file_name: fileName,
      error: err instanceof Error ? err.message : 'unknown',
    })

    // Return sensible defaults on failure
    return {
      structureDescription: `Uploaded reference document: ${fileName}`,
      detectedVariables: [],
      suggestedCategory: 'other',
    }
  }
}

/**
 * Extract text content from HTML for analysis.
 */
export function extractTextFromHtml(html: string): string {
  let text = html.replace(/<style[\s\S]*?<\/style>/gi, '')
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<\/?(h[1-6]|p|div|br|li|tr)[^>]*>/gi, '\n')
  text = text.replace(/<[^>]+>/g, '')
  text = text.replace(/&amp;/g, '&')
  text = text.replace(/&lt;/g, '<')
  text = text.replace(/&gt;/g, '>')
  text = text.replace(/&quot;/g, '"')
  text = text.replace(/&#x27;/g, "'")
  text = text.replace(/&nbsp;/g, ' ')
  text = text.replace(/[ \t]+/g, ' ')
  text = text.replace(/\n{3,}/g, '\n\n')
  return text.trim()
}
