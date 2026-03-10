import { logger } from '@/lib/logger'
import type { createServerClient } from '@/lib/supabase/server'
import type { StepResult } from '../step-engine'

/** Allowed template expression prefixes — whitelist for injection prevention */
const ALLOWED_EXPRESSION_PREFIXES = ['context.', 'block.'] as const

type UpdateBlockConfig = {
  /** Target block ID: literal UUID, '{{context.source_block_id}}', or '{{block.<relation_field>}}' */
  block_id: string
  /** Field-value pairs to merge into the target block's metadata */
  fields: Record<string, unknown>
}

type StepMeta = {
  template_id: string
  source_block_id: string
  applies_to_type: string
  current_step_index: number
}

/**
 * Resolve a template expression like `{{context.source_block_id}}` or `{{block.parent_client}}`
 * against the workflow context and source block.
 */
function resolveExpression(
  expr: string,
  meta: StepMeta,
  sourceBlock: Record<string, unknown> | null
): string | null {
  const match = expr.match(/^\{\{(\w+)\.(\w+)\}\}$/)
  if (!match) return null

  const [, namespace, key] = match

  // Validate prefix is allowed
  if (!ALLOWED_EXPRESSION_PREFIXES.some((p) => `${namespace}.` === p)) {
    return null
  }

  if (namespace === 'context') {
    const contextVars: Record<string, string> = {
      source_block_id: meta.source_block_id,
      template_id: meta.template_id,
      applies_to_type: meta.applies_to_type,
    }
    return contextVars[key] ?? null
  }

  if (namespace === 'block' && sourceBlock) {
    const metadata = (sourceBlock.metadata ?? {}) as Record<string, unknown>
    const val = metadata[key]
    return typeof val === 'string' ? val : null
  }

  return null
}

/**
 * Resolves the target block ID from the step config.
 * Supports:
 * - Literal UUID
 * - {{context.source_block_id}}
 * - {{block.<relation_field>}} (follows a relation field on the source block)
 */
async function resolveBlockId(
  config: UpdateBlockConfig,
  meta: StepMeta,
  orgId: string,
  supabase: ReturnType<typeof createServerClient>
): Promise<{ blockId: string | null; error?: string }> {
  const raw = config.block_id

  if (!raw) {
    return { blockId: null, error: 'Missing block_id in update_block config' }
  }

  // Check if it's a template expression
  if (raw.startsWith('{{') && raw.endsWith('}}')) {
    // Fetch source block for expression resolution
    const { data: sourceBlock } = await supabase
      .from('blocks')
      .select('id, name, type, metadata')
      .eq('id', meta.source_block_id)
      .eq('org_id', orgId)
      .single()

    const resolved = resolveExpression(
      raw,
      meta,
      sourceBlock as Record<string, unknown> | null
    )

    if (!resolved) {
      return { blockId: null, error: `Failed to resolve expression: ${raw}` }
    }

    return { blockId: resolved }
  }

  // Literal UUID
  return { blockId: raw }
}

/**
 * Execute an update_block step.
 * Resolves target block, validates fields, applies PATCH, emits event.
 */
export async function executeUpdateBlock(
  stepName: string,
  config: UpdateBlockConfig,
  meta: StepMeta,
  orgId: string,
  supabase: ReturnType<typeof createServerClient>
): Promise<StepResult> {
  const now = new Date().toISOString()
  const fail = (error: string): StepResult => ({
    step_name: stepName,
    step_type: 'update_block',
    status: 'failed',
    error,
    executed_at: now,
  })

  // 1. Validate config
  if (!config.fields || Object.keys(config.fields).length === 0) {
    return fail('Missing or empty fields in update_block config')
  }

  // 2. Resolve target block ID
  const { blockId, error: resolveError } = await resolveBlockId(
    config,
    meta,
    orgId,
    supabase
  )
  if (!blockId || resolveError) {
    return fail(resolveError ?? 'Could not resolve block_id')
  }

  // 3. Fetch target block (org-scoped)
  const { data: targetBlock, error: fetchError } = await supabase
    .from('blocks')
    .select('id, type, metadata, org_id')
    .eq('id', blockId)
    .eq('org_id', orgId)
    .single()

  if (fetchError || !targetBlock) {
    return fail(`Target block not found: ${blockId}`)
  }

  // 4. Validate fields against field_schema if available
  const { data: typeDef } = await supabase
    .from('block_type_definitions')
    .select('field_schema')
    .eq('org_id', orgId)
    .eq('type_name', targetBlock.type)
    .maybeSingle()

  if (typeDef?.field_schema) {
    const schema = typeDef.field_schema as { properties?: Record<string, unknown> }
    const schemaFields = schema.properties ? Object.keys(schema.properties) : []

    if (schemaFields.length > 0) {
      const invalidFields = Object.keys(config.fields).filter(
        (f) => !schemaFields.includes(f)
      )
      if (invalidFields.length > 0) {
        return fail(`Unknown fields for type '${targetBlock.type}': ${invalidFields.join(', ')}`)
      }
    }
  }

  // 5. Merge fields into metadata (shallow merge)
  const existingMetadata = (targetBlock.metadata ?? {}) as Record<string, unknown>
  const updatedMetadata = { ...existingMetadata, ...config.fields }

  const { error: updateError } = await supabase
    .from('blocks')
    .update({ metadata: updatedMetadata, updated_at: now })
    .eq('id', blockId)
    .eq('org_id', orgId)

  if (updateError) {
    logger.error('step-engine', 'step.update_block_failed', {
      block_id: blockId,
      error_code: updateError.code,
    })
    return fail(`Failed to update block: ${updateError.message}`)
  }

  // 6. Emit block.updated event
  await supabase.from('events').insert({
    org_id: orgId,
    block_id: blockId,
    type: 'block.updated',
    actor_type: 'workflow',
    payload: {
      updated_fields: Object.keys(config.fields),
      workflow_instance_id: meta.template_id,
      step_name: stepName,
    },
  })

  logger.info('step-engine', 'step.update_block_completed', {
    block_id: blockId,
    updated_fields: Object.keys(config.fields),
  })

  return {
    step_name: stepName,
    step_type: 'update_block',
    status: 'completed',
    output: {
      block_id: blockId,
      updated_fields: Object.keys(config.fields),
    },
    executed_at: now,
  }
}
