import type Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { checkForDuplicates } from '@/lib/ai/research-tools'
import { validateFieldsAgainstSchema, getBlockTypeSchemas } from '@/lib/ai/entity-creation'
import type { UserRole } from '@/lib/auth/withAuth'

// ─── Tool Definitions ────────────────────────────────────────────────────────

export const CHAT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_blocks',
    description:
      'Search for blocks by name or type. Returns matching blocks with their ID, name, type, and state.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Text to search for in block names (case-insensitive partial match)',
        },
        type: {
          type: 'string',
          description: 'Optional block type filter (e.g. client, deal, project)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_block',
    description:
      'Create a new block (operational entity). Validates metadata fields against the block type schema and checks for duplicates before creation. Returns the created block or duplicate warnings.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Name of the block to create' },
        type: {
          type: 'string',
          description: 'Block type (e.g. client, deal, project, task)',
        },
        metadata: {
          type: 'object',
          description:
            'Optional metadata fields — validated against the block type field schema. Invalid or unknown fields are stripped with warnings.',
        },
        skip_duplicate_check: {
          type: 'boolean',
          description:
            'Set to true to skip duplicate detection (e.g. after user confirmed creation despite duplicates)',
        },
      },
      required: ['name', 'type'],
    },
  },
  {
    name: 'update_block',
    description:
      'Update metadata fields on an existing block. Merges with existing metadata.',
    input_schema: {
      type: 'object' as const,
      properties: {
        block_id: { type: 'string', description: 'UUID of the block to update' },
        fields: {
          type: 'object',
          description: 'Key-value pairs to merge into the block metadata',
        },
      },
      required: ['block_id', 'fields'],
    },
  },
  {
    name: 'trigger_workflow',
    description:
      'Trigger a workflow template on a specific block. Creates a workflow instance.',
    input_schema: {
      type: 'object' as const,
      properties: {
        template_id: {
          type: 'string',
          description: 'UUID of the workflow template to trigger',
        },
        block_id: {
          type: 'string',
          description: 'UUID of the block to run the workflow on',
        },
      },
      required: ['template_id', 'block_id'],
    },
  },
  {
    name: 'list_block_types',
    description:
      'List all available block types with their field schemas. Use this to understand what types of blocks can be created and what fields each type supports.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
]

// ─── Tool Execution ──────────────────────────────────────────────────────────

const MAX_SEARCH_RESULTS = 10

export type ToolResult = {
  success: boolean
  data?: unknown
  error?: string
}

/**
 * Executes a chat tool call with RBAC enforcement.
 * Only ops-admin can execute mutating tools (create, update, trigger).
 * search_blocks is available to all roles.
 */
export async function executeChatTool(
  toolName: string,
  input: Record<string, unknown>,
  orgId: string,
  role: UserRole
): Promise<ToolResult> {
  // RBAC: only ops-admin can mutate
  const readOnlyTools = new Set(['search_blocks', 'list_block_types'])
  if (!readOnlyTools.has(toolName) && role !== 'ops-admin') {
    return {
      success: false,
      error: `Permission denied: ${toolName} requires ops-admin role (current: ${role})`,
    }
  }

  const supabase = createServerClient()

  try {
    switch (toolName) {
      case 'search_blocks':
        return await executeSearchBlocks(supabase, orgId, input)
      case 'create_block':
        return await executeCreateBlock(supabase, orgId, input)
      case 'update_block':
        return await executeUpdateBlock(supabase, orgId, input)
      case 'trigger_workflow':
        return await executeTriggerWorkflow(supabase, orgId, input)
      case 'list_block_types':
        return await executeListBlockTypes(orgId)
      default:
        return { success: false, error: `Unknown tool: ${toolName}` }
    }
  } catch (err) {
    logger.error('chat-tools', 'tool.execution_failed', {
      tool: toolName,
      org_id: orgId,
      error: (err as Error).message?.slice(0, 100),
    })
    return { success: false, error: `Tool execution failed: ${(err as Error).message}` }
  }
}

// ─── Tool Implementations ────────────────────────────────────────────────────

async function executeSearchBlocks(
  supabase: ReturnType<typeof createServerClient>,
  orgId: string,
  input: Record<string, unknown>
): Promise<ToolResult> {
  const query = String(input.query ?? '')
  const type = input.type ? String(input.type) : undefined

  let q = supabase
    .from('blocks')
    .select('id, name, type, state, created_at')
    .eq('org_id', orgId)
    .ilike('name', `%${query}%`)
    .eq('state', 'active')
    .order('name')
    .limit(MAX_SEARCH_RESULTS)

  if (type) {
    q = q.eq('type', type)
  }

  const { data, error } = await q

  if (error) return { success: false, error: error.message }
  return { success: true, data: { blocks: data ?? [], count: (data ?? []).length } }
}

async function executeCreateBlock(
  supabase: ReturnType<typeof createServerClient>,
  orgId: string,
  input: Record<string, unknown>
): Promise<ToolResult> {
  const name = String(input.name ?? '')
  const type = String(input.type ?? '')
  const metadata = (input.metadata as Record<string, unknown>) ?? {}
  const skipDuplicateCheck = input.skip_duplicate_check === true

  if (!name || !type) {
    return { success: false, error: 'name and type are required' }
  }

  // Step 1: Duplicate detection (unless explicitly skipped)
  if (!skipDuplicateCheck) {
    const duplicates = await checkForDuplicates(name, type, orgId)
    if (duplicates.hasDuplicates) {
      return {
        success: false,
        error: 'Potential duplicates found. Set skip_duplicate_check=true to create anyway.',
        data: {
          duplicates: duplicates.matches.map((m) => ({
            id: m.source_id,
            name: m.content,
            similarity: Math.round(m.similarity * 100) + '%',
          })),
        },
      }
    }
  }

  // Step 2: Validate metadata against block type field schema (if metadata provided)
  let validatedMetadata = metadata
  const warnings: string[] = []

  if (Object.keys(metadata).length > 0) {
    const { data: typeDef } = await supabase
      .from('block_type_definitions')
      .select('field_schema')
      .eq('org_id', orgId)
      .eq('type', type)
      .single()

    if (typeDef?.field_schema) {
      const schema = typeDef.field_schema as Record<string, unknown>
      const { validFields, errors } = validateFieldsAgainstSchema(metadata, schema)
      validatedMetadata = validFields
      if (errors.length > 0) {
        warnings.push(...errors)
      }
    }
  }

  // Step 3: Insert the block
  const { data, error } = await supabase
    .from('blocks')
    .insert({ name, type, org_id: orgId, metadata: validatedMetadata, state: 'active' })
    .select('id, name, type')
    .single()

  if (error) return { success: false, error: error.message }

  // Emit block.created event
  await supabase.from('events').insert({
    org_id: orgId,
    block_id: data.id,
    type: 'block.created',
    actor_type: 'ai_chat',
    actor_id: 'system',
    payload: { name, block_type: type, field_count: Object.keys(validatedMetadata).length },
  })

  return {
    success: true,
    data: {
      block_id: data.id,
      name: data.name,
      type: data.type,
      ...(warnings.length > 0 ? { warnings } : {}),
    },
  }
}

async function executeUpdateBlock(
  supabase: ReturnType<typeof createServerClient>,
  orgId: string,
  input: Record<string, unknown>
): Promise<ToolResult> {
  const blockId = String(input.block_id ?? '')
  const fields = (input.fields as Record<string, unknown>) ?? {}

  if (!blockId) return { success: false, error: 'block_id is required' }
  if (Object.keys(fields).length === 0) return { success: false, error: 'fields cannot be empty' }

  // Fetch current block
  const { data: block, error: fetchErr } = await supabase
    .from('blocks')
    .select('id, metadata')
    .eq('id', blockId)
    .eq('org_id', orgId)
    .single()

  if (fetchErr || !block) return { success: false, error: 'Block not found' }

  // Merge metadata
  const currentMeta = (block.metadata as Record<string, unknown>) ?? {}
  const newMeta = { ...currentMeta, ...fields }

  const { error: updateErr } = await supabase
    .from('blocks')
    .update({ metadata: newMeta })
    .eq('id', blockId)
    .eq('org_id', orgId)

  if (updateErr) return { success: false, error: updateErr.message }

  // Emit event
  await supabase.from('events').insert({
    org_id: orgId,
    block_id: blockId,
    type: 'block.updated',
    actor_type: 'ai_chat',
    actor_id: 'system',
    payload: { updated_fields: Object.keys(fields) },
  })

  return { success: true, data: { block_id: blockId, updated_fields: Object.keys(fields) } }
}

async function executeTriggerWorkflow(
  supabase: ReturnType<typeof createServerClient>,
  orgId: string,
  input: Record<string, unknown>
): Promise<ToolResult> {
  const templateId = String(input.template_id ?? '')
  const blockId = String(input.block_id ?? '')

  if (!templateId || !blockId) {
    return { success: false, error: 'template_id and block_id are required' }
  }

  // Verify template exists
  const { data: template, error: tmplErr } = await supabase
    .from('blocks')
    .select('id, name, metadata')
    .eq('id', templateId)
    .eq('org_id', orgId)
    .eq('type', 'workflow_template')
    .single()

  if (tmplErr || !template) return { success: false, error: 'Workflow template not found' }

  // Verify target block exists
  const { data: target, error: targetErr } = await supabase
    .from('blocks')
    .select('id, name')
    .eq('id', blockId)
    .eq('org_id', orgId)
    .single()

  if (targetErr || !target) return { success: false, error: 'Target block not found' }

  // Create workflow instance block
  const { data: instance, error: instanceErr } = await supabase
    .from('blocks')
    .insert({
      name: `${template.name} — ${target.name}`,
      type: 'workflow_instance',
      org_id: orgId,
      state: 'active',
      metadata: {
        template_id: templateId,
        source_block_id: blockId,
        status: 'pending',
        current_step_index: 0,
        ...(template.metadata as Record<string, unknown>),
      },
    })
    .select('id')
    .single()

  if (instanceErr || !instance) return { success: false, error: 'Failed to create workflow instance' }

  // Create workflow job
  await supabase.from('workflow_jobs').insert({
    org_id: orgId,
    workflow_type: 'template_execution',
    block_id: instance.id,
    status: 'pending',
    payload: { template_id: templateId, source_block_id: blockId },
  })

  return {
    success: true,
    data: { instance_id: instance.id, template_name: template.name, target_name: target.name },
  }
}

async function executeListBlockTypes(orgId: string): Promise<ToolResult> {
  const schemas = await getBlockTypeSchemas(orgId)

  if (schemas.length === 0) {
    return { success: true, data: { block_types: [], message: 'No custom block types configured' } }
  }

  const blockTypes = schemas.map((s) => {
    const properties = (s.field_schema as Record<string, unknown>).properties as
      | Record<string, Record<string, unknown>>
      | undefined
    const fields = properties
      ? Object.entries(properties).map(([key, prop]) => ({
          name: key,
          type: prop['x-field-type'] ?? prop.type,
          required: ((s.field_schema as Record<string, unknown>).required as string[] ?? []).includes(key),
          system: prop['x-is-system'] === true,
        }))
      : []

    return { type: s.type, label: s.label, fields }
  })

  return { success: true, data: { block_types: blockTypes } }
}
