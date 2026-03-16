/**
 * AI Field Suggestion Engine — suggests fields, groups, and relationships
 * for block type configuration based on natural language descriptions.
 *
 * Uses Claude to generate structured field suggestions that match the
 * existing field type system (12 types, x-field-group, x-display-order).
 */

import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'
import { join } from 'path'
import { logger } from '@/lib/logger'
import { FIELD_TYPES, type FieldType, isValidFieldType } from '@/lib/block-types/field-types'

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface SuggestionContext {
  /** Natural language description of what the user needs */
  description: string
  /** The block type being configured */
  blockType: {
    name: string
    slug: string
    existingFields: Array<{ name: string; type: string; group?: string }>
    existingGroups: Array<{ id: string; label: string }>
  }
  /** Other block types in the org (for relationship suggestions) */
  availableBlockTypes: Array<{ name: string; slug: string }>
}

export interface SuggestedField {
  name: string
  type: FieldType
  label: string
  description: string
  required: boolean
  group: string
}

export interface SuggestedGroup {
  id: string
  label: string
  order: number
}

export interface SuggestedRelationship {
  field_name: string
  target_block_type: string
  description: string
}

export interface FieldSuggestionResult {
  suggested_fields: SuggestedField[]
  suggested_groups: SuggestedGroup[]
  suggested_relationships: SuggestedRelationship[]
  reasoning: string
}

// ─── Prompt loading ─────────────────────────────────────────────────────────────

let systemPrompt: string | null = null

function getSystemPrompt(): string {
  if (!systemPrompt) {
    try {
      systemPrompt = readFileSync(
        join(process.cwd(), 'src/prompts/field-suggestion.v1.md'),
        'utf-8'
      )
    } catch {
      systemPrompt =
        'Suggest fields for a block type based on user description. Return JSON with suggested_fields (name, type, label, description, required, group), suggested_groups (id, label, order), suggested_relationships (field_name, target_block_type, description), and reasoning.'
    }
  }
  return systemPrompt
}

// ─── Default fallback ───────────────────────────────────────────────────────────

const DEFAULT_RESULT: FieldSuggestionResult = {
  suggested_fields: [],
  suggested_groups: [],
  suggested_relationships: [],
  reasoning: 'Field suggestion unavailable — please configure fields manually.',
}

// ─── Build user message ─────────────────────────────────────────────────────────

function buildUserMessage(ctx: SuggestionContext): string {
  const parts: string[] = []

  parts.push(`## User Request\n${ctx.description}`)

  parts.push(`\n## Block Type\nName: ${ctx.blockType.name}\nSlug: ${ctx.blockType.slug}`)

  if (ctx.blockType.existingFields.length > 0) {
    parts.push(`\n## Existing Fields`)
    for (const f of ctx.blockType.existingFields) {
      parts.push(`- ${f.name} (${f.type}${f.group ? `, group: ${f.group}` : ''})`)
    }
  }

  if (ctx.blockType.existingGroups.length > 0) {
    parts.push(`\n## Existing Groups`)
    for (const g of ctx.blockType.existingGroups) {
      parts.push(`- ${g.id}: "${g.label}"`)
    }
  }

  if (ctx.availableBlockTypes.length > 0) {
    parts.push(`\n## Available Block Types (for relationships)`)
    for (const bt of ctx.availableBlockTypes) {
      parts.push(`- ${bt.name} (${bt.slug})`)
    }
  }

  parts.push(`\n## Supported Field Types\n${FIELD_TYPES.join(', ')}`)

  return parts.join('\n')
}

// ─── Parse response ─────────────────────────────────────────────────────────────

function parseResponse(text: string): FieldSuggestionResult | null {
  // Strip markdown code fences if present
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/```\s*$/, '')
    .trim()

  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>

    const rawFields = parsed.suggested_fields
    const rawGroups = parsed.suggested_groups
    const rawRelationships = parsed.suggested_relationships
    const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : ''

    if (!Array.isArray(rawFields)) return null

    // Validate and filter fields
    const suggested_fields: SuggestedField[] = rawFields
      .filter((f: Record<string, unknown>) =>
        f &&
        typeof f.name === 'string' &&
        typeof f.type === 'string' &&
        isValidFieldType(f.type as string)
      )
      .map((f: Record<string, unknown>) => ({
        name: String(f.name).toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 50),
        type: f.type as FieldType,
        label: typeof f.label === 'string' ? f.label : String(f.name),
        description: typeof f.description === 'string' ? f.description : '',
        required: f.required === true,
        group: typeof f.group === 'string' ? f.group : 'general',
      }))

    // Validate groups
    const suggested_groups: SuggestedGroup[] = Array.isArray(rawGroups)
      ? rawGroups
          .filter((g: Record<string, unknown>) =>
            g && typeof g.id === 'string' && typeof g.label === 'string'
          )
          .map((g: Record<string, unknown>, i: number) => ({
            id: String(g.id).toLowerCase().replace(/[^a-z0-9_]/g, '_'),
            label: String(g.label),
            order: typeof g.order === 'number' ? g.order : i + 1,
          }))
      : []

    // Validate relationships
    const suggested_relationships: SuggestedRelationship[] = Array.isArray(rawRelationships)
      ? rawRelationships
          .filter((r: Record<string, unknown>) =>
            r && typeof r.field_name === 'string' && typeof r.target_block_type === 'string'
          )
          .map((r: Record<string, unknown>) => ({
            field_name: String(r.field_name).toLowerCase().replace(/[^a-z0-9_]/g, '_'),
            target_block_type: String(r.target_block_type),
            description: typeof r.description === 'string' ? r.description : '',
          }))
      : []

    return { suggested_fields, suggested_groups, suggested_relationships, reasoning }
  } catch {
    return null
  }
}

// ─── Main function ──────────────────────────────────────────────────────────────

/**
 * Suggest fields for a block type based on a natural language description.
 *
 * Returns suggested fields, groups, and relationships. On failure, returns
 * empty arrays (safe fallback: user configures manually).
 */
export async function suggestFields(
  ctx: SuggestionContext
): Promise<FieldSuggestionResult> {
  try {
    const client = new Anthropic()
    const userMessage = buildUserMessage(ctx)

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: getSystemPrompt(),
      messages: [{ role: 'user', content: userMessage }],
    })

    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => ('text' in block ? block.text : ''))
      .join('')

    const result = parseResponse(text)
    if (!result) {
      logger.warn('ai', 'field_suggestion_parse_failed')
      return DEFAULT_RESULT
    }

    logger.info('ai', 'field_suggestion_complete', {
      fieldsCount: result.suggested_fields.length,
      groupsCount: result.suggested_groups.length,
      relationshipsCount: result.suggested_relationships.length,
    })

    return result
  } catch (error) {
    logger.error('ai', 'field_suggestion_error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return DEFAULT_RESULT
  }
}
