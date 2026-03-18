import type Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { checkForDuplicates } from '@/lib/ai/research-tools'
import { embedBlock } from '@/lib/embeddings'
import { validateFieldsAgainstSchema, getBlockTypeSchemas } from '@/lib/ai/entity-creation'
import { suggestFields, type SuggestionContext } from '@/lib/ai/field-suggestion'
import { FIELD_TYPE_DEFINITIONS, isValidFieldType, getFieldGroups } from '@/lib/block-types/field-types'
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
  {
    name: 'suggest_fields',
    description:
      'Use AI to suggest fields for a block type based on a natural language description. Returns suggested fields with types, groups, and relationships to other block types. Requires manage_settings permission.',
    input_schema: {
      type: 'object' as const,
      properties: {
        description: {
          type: 'string',
          description: 'Natural language description of what fields are needed (e.g. "financial services client with compliance tracking")',
        },
        block_type: {
          type: 'string',
          description: 'The block type slug to suggest fields for (e.g. "client", "deal")',
        },
      },
      required: ['description', 'block_type'],
    },
  },
  {
    name: 'configure_block_type',
    description:
      'Add, remove, or modify fields on an existing block type. Can also manage field groups. Requires manage_settings permission.',
    input_schema: {
      type: 'object' as const,
      properties: {
        block_type: {
          type: 'string',
          description: 'The block type slug to configure',
        },
        add_fields: {
          type: 'array',
          description: 'Fields to add. Each needs: name (snake_case), type (text/number/email/etc), label, group (optional)',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string' },
              label: { type: 'string' },
              description: { type: 'string' },
              required: { type: 'boolean' },
              group: { type: 'string' },
            },
            required: ['name', 'type', 'label'],
          },
        },
        remove_fields: {
          type: 'array',
          description: 'Field names to remove',
          items: { type: 'string' },
        },
        add_groups: {
          type: 'array',
          description: 'Field groups to add',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              label: { type: 'string' },
              order: { type: 'number' },
            },
            required: ['id', 'label'],
          },
        },
      },
      required: ['block_type'],
    },
  },
  {
    name: 'create_block_type',
    description:
      'Create a new custom block type with an initial field schema and groups. Requires manage_settings permission.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type_slug: {
          type: 'string',
          description: 'Unique slug for the new type (snake_case, e.g. "vendor")',
        },
        label: {
          type: 'string',
          description: 'Display label (e.g. "Vendor")',
        },
        description: {
          type: 'string',
          description: 'Brief description of this block type',
        },
        icon: {
          type: 'string',
          description: 'Lucide icon name (e.g. "building", "users")',
        },
        fields: {
          type: 'array',
          description: 'Initial fields for the type',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string' },
              label: { type: 'string' },
              description: { type: 'string' },
              required: { type: 'boolean' },
              group: { type: 'string' },
            },
            required: ['name', 'type', 'label'],
          },
        },
        groups: {
          type: 'array',
          description: 'Field groups for the type',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              label: { type: 'string' },
              order: { type: 'number' },
            },
            required: ['id', 'label'],
          },
        },
      },
      required: ['type_slug', 'label'],
    },
  },
  {
    name: 'create_relationship',
    description:
      'Add a relation field to a block type that links to another block type. Requires manage_settings permission.',
    input_schema: {
      type: 'object' as const,
      properties: {
        source_type: {
          type: 'string',
          description: 'The block type to add the relation field to (e.g. "client")',
        },
        field_name: {
          type: 'string',
          description: 'Name for the relation field (snake_case, e.g. "primary_contact")',
        },
        field_label: {
          type: 'string',
          description: 'Display label (e.g. "Primary Contact")',
        },
        target_type: {
          type: 'string',
          description: 'The target block type slug (e.g. "contact")',
        },
        group: {
          type: 'string',
          description: 'Field group to assign the relation to (optional)',
        },
      },
      required: ['source_type', 'field_name', 'field_label', 'target_type'],
    },
  },
  {
    name: 'reassign_step',
    description:
      'Reassign a workflow step to a different team member. Updates the task_queue_item for the step and records an event. Requires execute_workflows permission (ops-admin).',
    input_schema: {
      type: 'object' as const,
      properties: {
        instance_id: {
          type: 'string',
          description: 'Workflow instance block ID',
        },
        step_name: {
          type: 'string',
          description: 'Name of the step to reassign',
        },
        assignee_id: {
          type: 'string',
          description: 'User ID of the new assignee',
        },
      },
      required: ['instance_id', 'step_name', 'assignee_id'],
    },
  },
  {
    name: 'extend_deadline',
    description:
      'Extend the expected completion time for a workflow step. Records an event noting the extension and updates the workflow instance metadata. Requires execute_workflows permission (ops-admin).',
    input_schema: {
      type: 'object' as const,
      properties: {
        instance_id: {
          type: 'string',
          description: 'Workflow instance block ID',
        },
        step_name: {
          type: 'string',
          description: 'Name of the step to extend',
        },
        extend_hours: {
          type: 'number',
          description: 'Number of hours to extend the deadline by',
        },
      },
      required: ['instance_id', 'step_name', 'extend_hours'],
    },
  },
  {
    name: 'calculate_delta',
    description:
      'Calculate the health delta for a workflow instance — compares the template design (expected steps) against the actual execution state (completed steps, events, timing). Returns a DeltaResult with health score, gap analysis (overdue/skipped/out-of-order steps), timeline deltas, and actionable insights. Use this when a user asks about workflow health, progress, or issues.',
    input_schema: {
      type: 'object' as const,
      properties: {
        instance_id: {
          type: 'string',
          description: 'Workflow instance block ID to analyze',
        },
      },
      required: ['instance_id'],
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
  // RBAC: read-only tools available to all, mutation tools require ops-admin,
  // block config tools require ops-admin (manage_settings)
  const readOnlyTools = new Set(['search_blocks', 'list_block_types', 'calculate_delta'])
  const configTools = new Set(['suggest_fields', 'configure_block_type', 'create_block_type', 'create_relationship'])
  const workflowTools = new Set(['reassign_step', 'extend_deadline'])
  if (!readOnlyTools.has(toolName) && role !== 'ops-admin') {
    const required = configTools.has(toolName)
      ? 'manage_settings (ops-admin)'
      : workflowTools.has(toolName)
        ? 'execute_workflows (ops-admin)'
        : 'ops-admin'
    return {
      success: false,
      error: `Permission denied: ${toolName} requires ${required} role (current: ${role})`,
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
      case 'suggest_fields':
        return await executeSuggestFields(supabase, orgId, input)
      case 'configure_block_type':
        return await executeConfigureBlockType(supabase, orgId, input)
      case 'create_block_type':
        return await executeCreateBlockType(supabase, orgId, input)
      case 'create_relationship':
        return await executeCreateRelationship(supabase, orgId, input)
      case 'reassign_step':
        return await executeReassignStep(supabase, orgId, input)
      case 'extend_deadline':
        return await executeExtendDeadline(supabase, orgId, input)
      case 'calculate_delta':
        return await executeCalculateDelta(supabase, orgId, input)
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

  // Fire-and-forget: embed the new block for semantic search
  embedBlock(
    { id: data.id, org_id: orgId, type, name, metadata: validatedMetadata as Record<string, unknown> },
    supabase
  ).catch(() => {})

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

  // Fire-and-forget: re-embed the updated block
  // Fetch the full block for embedding content
  const { data: updatedBlock } = await supabase
    .from('blocks')
    .select('id, org_id, type, name, metadata')
    .eq('id', blockId)
    .single()

  if (updatedBlock) {
    embedBlock(
      {
        id: updatedBlock.id,
        org_id: updatedBlock.org_id as string,
        type: updatedBlock.type as string,
        name: updatedBlock.name as string,
        metadata: (updatedBlock.metadata ?? {}) as Record<string, unknown>,
      },
      supabase
    ).catch(() => {})
  }

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
    const fieldSchema = s.field_schema as Record<string, unknown>
    const properties = fieldSchema.properties as
      | Record<string, Record<string, unknown>>
      | undefined
    const fields = properties
      ? Object.entries(properties).map(([key, prop]) => ({
          name: key,
          type: prop['x-field-type'] ?? prop.type,
          required: ((fieldSchema.required as string[]) ?? []).includes(key),
          system: prop['x-is-system'] === true,
          group: prop['x-field-group'] as string | undefined,
        }))
      : []
    const groups = getFieldGroups(fieldSchema)

    return { type: s.type, label: s.label, fields, groups }
  })

  return { success: true, data: { block_types: blockTypes } }
}

// ─── Block Configuration Tools ──────────────────────────────────────────────

async function executeSuggestFields(
  supabase: ReturnType<typeof createServerClient>,
  orgId: string,
  input: Record<string, unknown>
): Promise<ToolResult> {
  const description = String(input.description ?? '')
  const blockType = String(input.block_type ?? '')

  if (!description || !blockType) {
    return { success: false, error: 'description and block_type are required' }
  }

  // Fetch block type definition
  const { data: typeDef } = await supabase
    .from('block_type_definitions')
    .select('type, label, field_schema')
    .eq('org_id', orgId)
    .eq('type', blockType)
    .single()

  if (!typeDef) {
    return { success: false, error: `Block type "${blockType}" not found` }
  }

  const fieldSchema = (typeDef.field_schema ?? {}) as Record<string, unknown>
  const properties = (fieldSchema.properties ?? {}) as Record<string, Record<string, unknown>>
  const groups = getFieldGroups(fieldSchema)

  // Fetch all block types for relationship context
  const { data: allTypes } = await supabase
    .from('block_type_definitions')
    .select('type, label')
    .eq('org_id', orgId)

  const ctx: SuggestionContext = {
    description,
    blockType: {
      name: typeDef.label,
      slug: typeDef.type,
      existingFields: Object.entries(properties).map(([name, prop]) => ({
        name,
        type: (prop['x-field-type'] as string) ?? (prop.type as string) ?? 'text',
        group: prop['x-field-group'] as string | undefined,
      })),
      existingGroups: groups.map((g) => ({ id: g.id, label: g.label })),
    },
    availableBlockTypes: (allTypes ?? [])
      .filter((t) => t.type !== blockType)
      .map((t) => ({ name: t.label, slug: t.type })),
  }

  const result = await suggestFields(ctx)

  return { success: true, data: result }
}

async function executeConfigureBlockType(
  supabase: ReturnType<typeof createServerClient>,
  orgId: string,
  input: Record<string, unknown>
): Promise<ToolResult> {
  const blockType = String(input.block_type ?? '')
  if (!blockType) return { success: false, error: 'block_type is required' }

  // Fetch current schema
  const { data: typeDef, error: fetchErr } = await supabase
    .from('block_type_definitions')
    .select('id, field_schema')
    .eq('org_id', orgId)
    .eq('type', blockType)
    .single()

  if (fetchErr || !typeDef) {
    return { success: false, error: `Block type "${blockType}" not found` }
  }

  const schema = { ...(typeDef.field_schema as Record<string, unknown>) }
  const properties = { ...((schema.properties ?? {}) as Record<string, Record<string, unknown>>) }
  const required = [...((schema.required ?? []) as string[])]
  const xGroups = [...((schema['x-field-groups'] ?? []) as Array<{ id: string; label: string; order: number }>)]

  const changes: string[] = []

  // Add groups
  const addGroups = (input.add_groups ?? []) as Array<{ id: string; label: string; order?: number }>
  for (const g of addGroups) {
    if (!g.id || !g.label) continue
    if (!xGroups.some((existing) => existing.id === g.id)) {
      xGroups.push({ id: g.id, label: g.label, order: g.order ?? xGroups.length + 1 })
      changes.push(`Added group "${g.label}"`)
    }
  }

  // Add fields
  const addFields = (input.add_fields ?? []) as Array<{
    name: string; type: string; label: string; description?: string; required?: boolean; group?: string
  }>
  let displayOrder = Object.keys(properties).length + 1

  for (const field of addFields) {
    if (!field.name || !field.type || !field.label) continue
    if (!isValidFieldType(field.type)) {
      changes.push(`Skipped "${field.name}" — invalid type "${field.type}"`)
      continue
    }
    if (properties[field.name]) {
      changes.push(`Skipped "${field.name}" — already exists`)
      continue
    }

    const def = FIELD_TYPE_DEFINITIONS[field.type as keyof typeof FIELD_TYPE_DEFINITIONS]
    properties[field.name] = {
      ...def.defaultSchema,
      description: field.description ?? field.label,
      'x-display-order': displayOrder++,
      ...(field.group ? { 'x-field-group': field.group } : {}),
    }

    if (field.required) {
      required.push(field.name)
    }

    changes.push(`Added field "${field.name}" (${field.type})`)
  }

  // Remove fields
  const removeFields = (input.remove_fields ?? []) as string[]
  for (const name of removeFields) {
    if (properties[name]) {
      // Don't remove system fields
      if (properties[name]['x-is-system']) {
        changes.push(`Cannot remove system field "${name}"`)
        continue
      }
      delete properties[name]
      const reqIdx = required.indexOf(name)
      if (reqIdx >= 0) required.splice(reqIdx, 1)
      changes.push(`Removed field "${name}"`)
    }
  }

  // Update schema
  schema.properties = properties
  schema.required = required
  schema['x-field-groups'] = xGroups

  const { error: updateErr } = await supabase
    .from('block_type_definitions')
    .update({ field_schema: schema })
    .eq('id', typeDef.id)
    .eq('org_id', orgId)

  if (updateErr) return { success: false, error: updateErr.message }

  return {
    success: true,
    data: {
      block_type: blockType,
      changes,
      field_count: Object.keys(properties).length,
      group_count: xGroups.length,
    },
  }
}

async function executeCreateBlockType(
  supabase: ReturnType<typeof createServerClient>,
  orgId: string,
  input: Record<string, unknown>
): Promise<ToolResult> {
  const typeSlug = String(input.type_slug ?? '').toLowerCase().replace(/[^a-z0-9_]/g, '_')
  const label = String(input.label ?? '')
  const description = String(input.description ?? '')
  const icon = String(input.icon ?? 'box')

  if (!typeSlug || !label) {
    return { success: false, error: 'type_slug and label are required' }
  }

  // Check if type already exists
  const { data: existing } = await supabase
    .from('block_type_definitions')
    .select('id')
    .eq('org_id', orgId)
    .eq('type', typeSlug)
    .single()

  if (existing) {
    return { success: false, error: `Block type "${typeSlug}" already exists` }
  }

  // Build field schema
  const properties: Record<string, Record<string, unknown>> = {}
  const required: string[] = []
  const groups: Array<{ id: string; label: string; order: number }> = []

  const inputFields = (input.fields ?? []) as Array<{
    name: string; type: string; label: string; description?: string; required?: boolean; group?: string
  }>
  const inputGroups = (input.groups ?? []) as Array<{ id: string; label: string; order?: number }>

  for (const g of inputGroups) {
    if (g.id && g.label) {
      groups.push({ id: g.id, label: g.label, order: g.order ?? groups.length + 1 })
    }
  }

  let displayOrder = 1
  for (const field of inputFields) {
    if (!field.name || !field.type || !field.label) continue
    if (!isValidFieldType(field.type)) continue

    const def = FIELD_TYPE_DEFINITIONS[field.type as keyof typeof FIELD_TYPE_DEFINITIONS]
    properties[field.name] = {
      ...def.defaultSchema,
      description: field.description ?? field.label,
      'x-display-order': displayOrder++,
      ...(field.group ? { 'x-field-group': field.group } : {}),
    }

    if (field.required) required.push(field.name)
  }

  const fieldSchema = {
    type: 'object',
    properties,
    required,
    ...(groups.length > 0 ? { 'x-field-groups': groups } : {}),
  }

  const { data, error } = await supabase
    .from('block_type_definitions')
    .insert({
      org_id: orgId,
      type: typeSlug,
      label,
      description,
      icon,
      field_schema: fieldSchema,
      is_system: false,
    })
    .select('id, type, label')
    .single()

  if (error) return { success: false, error: error.message }

  return {
    success: true,
    data: {
      id: data.id,
      type: data.type,
      label: data.label,
      field_count: Object.keys(properties).length,
      group_count: groups.length,
    },
  }
}

async function executeCreateRelationship(
  supabase: ReturnType<typeof createServerClient>,
  orgId: string,
  input: Record<string, unknown>
): Promise<ToolResult> {
  const sourceType = String(input.source_type ?? '')
  const fieldName = String(input.field_name ?? '').toLowerCase().replace(/[^a-z0-9_]/g, '_')
  const fieldLabel = String(input.field_label ?? '')
  const targetType = String(input.target_type ?? '')
  const group = input.group ? String(input.group) : undefined

  if (!sourceType || !fieldName || !fieldLabel || !targetType) {
    return { success: false, error: 'source_type, field_name, field_label, and target_type are required' }
  }

  // Verify both types exist
  const { data: sourceDef, error: srcErr } = await supabase
    .from('block_type_definitions')
    .select('id, field_schema')
    .eq('org_id', orgId)
    .eq('type', sourceType)
    .single()

  if (srcErr || !sourceDef) {
    return { success: false, error: `Source block type "${sourceType}" not found` }
  }

  const { data: targetDef } = await supabase
    .from('block_type_definitions')
    .select('id')
    .eq('org_id', orgId)
    .eq('type', targetType)
    .single()

  if (!targetDef) {
    return { success: false, error: `Target block type "${targetType}" not found` }
  }

  // Add relation field to source type schema
  const schema = { ...(sourceDef.field_schema as Record<string, unknown>) }
  const properties = { ...((schema.properties ?? {}) as Record<string, Record<string, unknown>>) }

  if (properties[fieldName]) {
    return { success: false, error: `Field "${fieldName}" already exists on "${sourceType}"` }
  }

  const displayOrder = Object.keys(properties).length + 1
  properties[fieldName] = {
    type: 'string',
    'x-field-type': 'relation',
    'x-relation-target': targetType,
    'x-display-order': displayOrder,
    description: fieldLabel,
    ...(group ? { 'x-field-group': group } : {}),
  }

  schema.properties = properties

  const { error: updateErr } = await supabase
    .from('block_type_definitions')
    .update({ field_schema: schema })
    .eq('id', sourceDef.id)
    .eq('org_id', orgId)

  if (updateErr) return { success: false, error: updateErr.message }

  return {
    success: true,
    data: {
      source_type: sourceType,
      field_name: fieldName,
      target_type: targetType,
      message: `Added relation "${fieldLabel}" from ${sourceType} → ${targetType}`,
    },
  }
}

// ─── Workflow Delta Tools ──────────────────────────────────────────────────

async function executeReassignStep(
  supabase: ReturnType<typeof createServerClient>,
  orgId: string,
  input: Record<string, unknown>
): Promise<ToolResult> {
  const instanceId = String(input.instance_id ?? '')
  const stepName = String(input.step_name ?? '')
  const assigneeId = String(input.assignee_id ?? '')

  if (!instanceId || !stepName || !assigneeId) {
    return { success: false, error: 'instance_id, step_name, and assignee_id are required' }
  }

  // Verify the workflow instance exists and belongs to this org
  const { data: instance, error: instanceErr } = await supabase
    .from('blocks')
    .select('id, name, metadata')
    .eq('id', instanceId)
    .eq('org_id', orgId)
    .eq('type', 'workflow_instance')
    .single()

  if (instanceErr || !instance) {
    return { success: false, error: 'Workflow instance not found' }
  }

  // Update the task_queue_item for this step (if one exists)
  const { data: taskItem, error: taskErr } = await supabase
    .from('task_queue_items')
    .select('id, assigned_to')
    .eq('org_id', orgId)
    .eq('block_id', instanceId)
    .eq('step_name', stepName)
    .single()

  if (taskErr || !taskItem) {
    // No task_queue_item — record the reassignment as metadata update + event
    const meta = (instance.metadata as Record<string, unknown>) ?? {}
    const reassignments = (meta.reassignments as Record<string, string>[]) ?? []
    reassignments.push({
      step_name: stepName,
      assignee_id: assigneeId,
      reassigned_at: new Date().toISOString(),
    })

    await supabase
      .from('blocks')
      .update({ metadata: { ...meta, reassignments } })
      .eq('id', instanceId)
      .eq('org_id', orgId)

    // Emit event
    await supabase.from('events').insert({
      org_id: orgId,
      block_id: instanceId,
      type: 'workflow.step.reassigned',
      actor_type: 'ai_chat',
      actor_id: 'system',
      payload: { step_name: stepName, new_assignee: assigneeId, source: 'delta_recommendation' },
    })

    return {
      success: true,
      data: {
        instance_id: instanceId,
        step_name: stepName,
        assignee_id: assigneeId,
        message: `Step "${stepName}" reassigned to ${assigneeId} (recorded in instance metadata)`,
      },
    }
  }

  // Update existing task_queue_item
  const previousAssignee = taskItem.assigned_to
  const { error: updateErr } = await supabase
    .from('task_queue_items')
    .update({ assigned_to: assigneeId })
    .eq('id', taskItem.id)
    .eq('org_id', orgId)

  if (updateErr) return { success: false, error: updateErr.message }

  // Emit event
  await supabase.from('events').insert({
    org_id: orgId,
    block_id: instanceId,
    type: 'workflow.step.reassigned',
    actor_type: 'ai_chat',
    actor_id: 'system',
    payload: {
      step_name: stepName,
      previous_assignee: previousAssignee,
      new_assignee: assigneeId,
      task_queue_item_id: taskItem.id,
      source: 'delta_recommendation',
    },
  })

  return {
    success: true,
    data: {
      instance_id: instanceId,
      step_name: stepName,
      previous_assignee: previousAssignee,
      new_assignee: assigneeId,
      message: `Step "${stepName}" reassigned from ${previousAssignee ?? 'unassigned'} to ${assigneeId}`,
    },
  }
}

async function executeExtendDeadline(
  supabase: ReturnType<typeof createServerClient>,
  orgId: string,
  input: Record<string, unknown>
): Promise<ToolResult> {
  const instanceId = String(input.instance_id ?? '')
  const stepName = String(input.step_name ?? '')
  const extendHours = Number(input.extend_hours ?? 0)

  if (!instanceId || !stepName) {
    return { success: false, error: 'instance_id and step_name are required' }
  }

  if (extendHours <= 0 || extendHours > 720) {
    return { success: false, error: 'extend_hours must be between 1 and 720 (30 days)' }
  }

  // Verify the workflow instance exists and belongs to this org
  const { data: instance, error: instanceErr } = await supabase
    .from('blocks')
    .select('id, name, metadata')
    .eq('id', instanceId)
    .eq('org_id', orgId)
    .eq('type', 'workflow_instance')
    .single()

  if (instanceErr || !instance) {
    return { success: false, error: 'Workflow instance not found' }
  }

  // Record the deadline extension in instance metadata
  const meta = (instance.metadata as Record<string, unknown>) ?? {}
  const extensions = (meta.deadline_extensions as Record<string, unknown>[]) ?? []
  extensions.push({
    step_name: stepName,
    extend_hours: extendHours,
    extended_at: new Date().toISOString(),
  })

  const { error: updateErr } = await supabase
    .from('blocks')
    .update({ metadata: { ...meta, deadline_extensions: extensions } })
    .eq('id', instanceId)
    .eq('org_id', orgId)

  if (updateErr) return { success: false, error: updateErr.message }

  // Emit event
  await supabase.from('events').insert({
    org_id: orgId,
    block_id: instanceId,
    type: 'workflow.step.deadline_extended',
    actor_type: 'ai_chat',
    actor_id: 'system',
    payload: {
      step_name: stepName,
      extend_hours: extendHours,
      source: 'delta_recommendation',
    },
  })

  return {
    success: true,
    data: {
      instance_id: instanceId,
      step_name: stepName,
      extend_hours: extendHours,
      message: `Deadline for step "${stepName}" extended by ${extendHours} hours`,
    },
  }
}

// ─── Calculate Delta ─────────────────────────────────────────────────────────

async function executeCalculateDelta(
  supabase: ReturnType<typeof createServerClient>,
  orgId: string,
  input: Record<string, unknown>
): Promise<ToolResult> {
  const instanceId = String(input.instance_id ?? '')
  if (!instanceId) return { success: false, error: 'instance_id is required' }

  // Fetch the workflow instance block
  const { data: instance } = await supabase
    .from('blocks')
    .select('id, name, type, metadata')
    .eq('id', instanceId)
    .eq('org_id', orgId)
    .eq('type', 'workflow_instance')
    .single()

  if (!instance) return { success: false, error: 'Workflow instance not found' }

  const meta = instance.metadata as Record<string, unknown>
  const templateId = meta.template_id as string | undefined

  if (!templateId) return { success: false, error: 'Instance has no template_id' }

  // Fetch the template for step definitions
  const { data: template } = await supabase
    .from('blocks')
    .select('metadata')
    .eq('id', templateId)
    .eq('org_id', orgId)
    .single()

  if (!template) return { success: false, error: 'Workflow template not found' }

  const templateMeta = template.metadata as Record<string, unknown>
  const steps = (templateMeta.steps as Array<Record<string, unknown>>) ?? []

  // Fetch recent events for this instance
  const { data: events } = await supabase
    .from('events')
    .select('id, type, payload, created_at')
    .eq('block_id', instanceId)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(50)

  // Import and run the delta engine
  const { calculateDelta } = await import('@/lib/ai/delta-engine')
  type DeltaStatus = 'pending' | 'running' | 'done' | 'failed'
  const validStatuses = new Set<DeltaStatus>(['pending', 'running', 'done', 'failed'])
  const rawStatus = (meta.status as string) ?? 'pending'
  const status: DeltaStatus = validStatuses.has(rawStatus as DeltaStatus) ? (rawStatus as DeltaStatus) : 'pending'

  const rawResults = (meta.step_results as Array<Record<string, unknown>>) ?? []

  const deltaResult = calculateDelta(
    instanceId,
    {
      template_id: (meta.template_id as string) ?? '',
      source_block_id: (meta.source_block_id as string) ?? '',
      status,
      current_step_index: (meta.current_step_index as number) ?? 0,
      step_results: rawResults.map((r) => ({
        step_name: (r.step_name as string) ?? '',
        step_type: (r.step_type as string) ?? '',
        status: (r.status as 'completed' | 'failed' | 'waiting') ?? 'waiting',
        output: r.output as Record<string, unknown> | undefined,
        error: r.error as string | undefined,
        executed_at: (r.executed_at as string) ?? new Date().toISOString(),
      })),
      started_at: (meta.started_at as string) ?? new Date().toISOString(),
      completed_at: (meta.completed_at as string) ?? null,
    },
    steps.map((s) => ({
      name: (s.name as string) ?? 'unnamed',
      type: (s.type as string) ?? 'unknown',
      wait_seconds: s.wait_seconds as number | undefined,
    })),
    (events ?? []).map((e) => ({
      id: e.id,
      type: e.type,
      occurred_at: e.created_at,
      payload: (e.payload ?? {}) as Record<string, unknown>,
    }))
  )

  return {
    success: true,
    data: {
      instance_id: instanceId,
      instance_name: instance.name,
      ...deltaResult,
    },
  }
}
