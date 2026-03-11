import type Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
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
      'Create a new block (operational entity) in the system. Returns the created block ID.',
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
          description: 'Optional metadata fields for the block',
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
  const readOnlyTools = new Set(['search_blocks'])
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

  if (!name || !type) {
    return { success: false, error: 'name and type are required' }
  }

  const { data, error } = await supabase
    .from('blocks')
    .insert({ name, type, org_id: orgId, metadata, state: 'active' })
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
    payload: { name, block_type: type },
  })

  return { success: true, data: { block_id: data.id, name: data.name, type: data.type } }
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
