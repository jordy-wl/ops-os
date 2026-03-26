/**
 * Action Preview Helpers
 *
 * Used by the chat execute mode to emit proposed actions as SSE events
 * instead of auto-executing tool calls. The frontend renders these as
 * an approval UI; the user approves/rejects via /api/ai/chat/execute-actions.
 */

import { randomUUID } from 'crypto'

// ─── Types ──────────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high'

export interface ActionPreview {
  /** Unique identifier for this proposed action */
  id: string
  /** The tool name Claude requested */
  toolName: string
  /** The input parameters Claude provided */
  input: Record<string, unknown>
  /** Human-readable description of what this action will do */
  description: string
  /** Risk assessment: low (read-only), medium (creates data), high (modifies/deletes data) */
  riskLevel: RiskLevel
}

// ─── Read-only tool names (no side effects) ─────────────────────────────────

const READ_ONLY_TOOLS = new Set([
  'search_blocks',
  'list_block_types',
  'suggest_fields',
  'calculate_delta',
])

// ─── Mutation tool names that modify or delete existing data ────────────────

const HIGH_RISK_TOOLS = new Set([
  'update_block',
])

// ─── Description Generators ─────────────────────────────────────────────────

/**
 * Generate a human-readable description of a tool call.
 * Descriptions are non-technical and suitable for display in an approval UI.
 */
export function describeToolCall(
  toolName: string,
  input: Record<string, unknown>
): string {
  switch (toolName) {
    case 'create_block': {
      const name = typeof input.name === 'string' ? input.name : 'unnamed'
      const type = typeof input.type === 'string' ? input.type : 'block'
      return `Create a new ${type} block named '${name}'`
    }
    case 'update_block': {
      const blockId = typeof input.block_id === 'string'
        ? input.block_id.slice(0, 8)
        : 'unknown'
      const fields = input.metadata && typeof input.metadata === 'object'
        ? Object.keys(input.metadata as Record<string, unknown>).join(', ')
        : 'fields'
      return `Update ${fields} on block ${blockId}...`
    }
    case 'search_blocks': {
      const query = typeof input.query === 'string' ? input.query : ''
      return `Search for blocks matching '${query}'`
    }
    case 'trigger_workflow': {
      const templateId = typeof input.template_id === 'string'
        ? input.template_id.slice(0, 8)
        : 'unknown'
      return `Trigger workflow template ${templateId}...`
    }
    case 'list_block_types':
      return 'List available block types'
    case 'suggest_fields': {
      const blockType = typeof input.block_type === 'string' ? input.block_type : 'block'
      return `Suggest fields for ${blockType} type`
    }
    case 'configure_block_type': {
      const slug = typeof input.slug === 'string' ? input.slug : 'unknown'
      return `Configure block type '${slug}'`
    }
    case 'create_block_type': {
      const typeName = typeof input.name === 'string' ? input.name : 'unnamed'
      return `Create a new block type named '${typeName}'`
    }
    case 'create_relationship': {
      const fromId = typeof input.from_block_id === 'string'
        ? input.from_block_id.slice(0, 8)
        : 'unknown'
      const toId = typeof input.to_block_id === 'string'
        ? input.to_block_id.slice(0, 8)
        : 'unknown'
      const edgeType = typeof input.edge_type === 'string' ? input.edge_type : 'link'
      return `Create '${edgeType}' relationship from block ${fromId}... to ${toId}...`
    }
    case 'reassign_step': {
      const stepId = typeof input.step_id === 'string'
        ? input.step_id.slice(0, 8)
        : 'unknown'
      return `Reassign workflow step ${stepId}...`
    }
    case 'extend_deadline': {
      const stepId = typeof input.step_id === 'string'
        ? input.step_id.slice(0, 8)
        : 'unknown'
      return `Extend deadline for workflow step ${stepId}...`
    }
    case 'calculate_delta':
      return 'Calculate workflow delta health score'
    case 'create_portal': {
      const portalName = typeof input.name === 'string' ? input.name : 'unnamed'
      return `Create a new portal named '${portalName}'`
    }
    case 'configure_portal': {
      const configId = typeof input.portal_config_id === 'string'
        ? input.portal_config_id.slice(0, 8)
        : 'unknown'
      return `Update portal configuration ${configId}...`
    }
    default:
      return `Execute ${toolName}`
  }
}

/**
 * Assess the risk level of a tool call based on its operation type.
 *
 * - low: read-only operations (search, list, suggest, calculate)
 * - medium: creates new data (create_block, trigger_workflow, create_relationship, create_portal)
 * - high: modifies or deletes existing data (update_block, configure_block_type, configure_portal)
 */
export function assessRisk(toolName: string): RiskLevel {
  if (READ_ONLY_TOOLS.has(toolName)) return 'low'
  if (HIGH_RISK_TOOLS.has(toolName)) return 'high'
  return 'medium'
}

/**
 * Build an ActionPreview array from Claude's tool_use content blocks.
 * Each block gets a unique UUID, a human-readable description, and a risk level.
 */
export function buildActionPreviews(
  toolUseBlocks: Array<{ name: string; input: unknown }>
): ActionPreview[] {
  return toolUseBlocks.map((block) => {
    const input = (block.input ?? {}) as Record<string, unknown>
    return {
      id: randomUUID(),
      toolName: block.name,
      input,
      description: describeToolCall(block.name, input),
      riskLevel: assessRisk(block.name),
    }
  })
}
