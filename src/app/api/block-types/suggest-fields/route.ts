/**
 * Field Suggestion API — P3-S6-FE-04 (supporting endpoint)
 *
 * POST /api/block-types/suggest-fields
 *
 * Calls the AI field suggestion engine to suggest fields, groups, and
 * relationships for a block type based on a natural language description.
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'
import { suggestFields } from '@/lib/ai/field-suggestion'
import { getFieldGroups, inferFieldType } from '@/lib/block-types/field-types'

const SuggestSchema = z.object({
  description: z.string().min(5).max(500),
  block_type_slug: z.string().min(1).max(100),
})

export const POST = withAuth(
  requirePermission(['manage_blocks'], async (req: NextRequest, ctx) => {
    const body = await req.json().catch(() => null)
    if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

    const parsed = SuggestSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.issues)

    const supabase = createServerClient()

    // Fetch the target block type
    const { data: typeDef } = await supabase
      .from('block_type_definitions')
      .select('id, type_name, display_name, field_schema')
      .eq('org_id', ctx.orgId)
      .eq('type_name', parsed.data.block_type_slug)
      .single()

    // Build context for AI
    const fieldSchema = (typeDef?.field_schema ?? { type: 'object', properties: {} }) as Record<string, unknown>
    const properties = (fieldSchema.properties ?? {}) as Record<string, Record<string, unknown>>
    const groups = getFieldGroups(fieldSchema)

    const existingFields = Object.entries(properties).map(([name, prop]) => ({
      name,
      type: inferFieldType(prop),
      group: (prop['x-field-group'] as string) || undefined,
    }))

    // Fetch all block types for relationship suggestions
    const { data: allTypes } = await supabase
      .from('block_type_definitions')
      .select('type_name, display_name')
      .eq('org_id', ctx.orgId)

    const result = await suggestFields({
      description: parsed.data.description,
      blockType: {
        name: typeDef?.display_name ?? parsed.data.block_type_slug,
        slug: parsed.data.block_type_slug,
        existingFields,
        existingGroups: groups.filter((g) => g.id !== 'general'),
      },
      availableBlockTypes: (allTypes ?? [])
        .filter((t) => t.type_name !== parsed.data.block_type_slug)
        .map((t) => ({
          name: t.display_name as string,
          slug: t.type_name as string,
        })),
    })

    logger.info('api-block-types', 'field_suggestion_requested', {
      org_id: ctx.orgId,
      block_type: parsed.data.block_type_slug,
      suggested_count: result.suggested_fields.length,
    })

    return ok(result)
  })
)
