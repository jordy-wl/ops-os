import { describe, it, expect } from 'vitest'
import {
  describeToolCall,
  assessRisk,
  buildActionPreviews,
  type ActionPreview,
  type RiskLevel,
} from '../action-preview'

// ─── describeToolCall ────────────────────────────────────────────────────────

describe('describeToolCall', () => {
  it('describes create_block with type and name', () => {
    const desc = describeToolCall('create_block', { name: 'Acme Corp', type: 'client' })
    expect(desc).toBe("Create a new client block named 'Acme Corp'")
  })

  it('describes create_block with missing fields', () => {
    const desc = describeToolCall('create_block', {})
    expect(desc).toBe("Create a new block block named 'unnamed'")
  })

  it('describes update_block with metadata fields', () => {
    const desc = describeToolCall('update_block', {
      block_id: '12345678-abcd-1234-abcd-123456789abc',
      metadata: { status: 'active', revenue: 50000 },
    })
    expect(desc).toContain('Update status, revenue on block 12345678')
  })

  it('describes update_block with no metadata', () => {
    const desc = describeToolCall('update_block', { block_id: 'abcdefgh-1234' })
    expect(desc).toContain('Update fields on block abcdefgh')
  })

  it('describes search_blocks with query', () => {
    const desc = describeToolCall('search_blocks', { query: 'Acme' })
    expect(desc).toBe("Search for blocks matching 'Acme'")
  })

  it('describes trigger_workflow with template_id', () => {
    const desc = describeToolCall('trigger_workflow', {
      template_id: 'deadbeef-1234-5678-9abc-def012345678',
    })
    expect(desc).toContain('Trigger workflow template deadbeef')
  })

  it('describes list_block_types', () => {
    expect(describeToolCall('list_block_types', {})).toBe('List available block types')
  })

  it('describes suggest_fields with block_type', () => {
    const desc = describeToolCall('suggest_fields', { block_type: 'deal' })
    expect(desc).toBe('Suggest fields for deal type')
  })

  it('describes configure_block_type with slug', () => {
    const desc = describeToolCall('configure_block_type', { slug: 'project' })
    expect(desc).toBe("Configure block type 'project'")
  })

  it('describes create_block_type with name', () => {
    const desc = describeToolCall('create_block_type', { name: 'Invoice' })
    expect(desc).toBe("Create a new block type named 'Invoice'")
  })

  it('describes create_relationship with edge details', () => {
    const desc = describeToolCall('create_relationship', {
      from_block_id: 'aaaaaaaa-0000-0000-0000-000000000001',
      to_block_id: 'bbbbbbbb-0000-0000-0000-000000000002',
      edge_type: 'owns',
    })
    expect(desc).toContain("'owns' relationship")
    expect(desc).toContain('aaaaaaaa')
    expect(desc).toContain('bbbbbbbb')
  })

  it('describes reassign_step', () => {
    const desc = describeToolCall('reassign_step', {
      step_id: 'cccccccc-0000-0000-0000-000000000003',
    })
    expect(desc).toContain('Reassign workflow step cccccccc')
  })

  it('describes extend_deadline', () => {
    const desc = describeToolCall('extend_deadline', {
      step_id: 'dddddddd-0000-0000-0000-000000000004',
    })
    expect(desc).toContain('Extend deadline for workflow step dddddddd')
  })

  it('describes calculate_delta', () => {
    expect(describeToolCall('calculate_delta', {})).toBe('Calculate workflow delta health score')
  })

  it('describes create_portal with name', () => {
    const desc = describeToolCall('create_portal', { name: 'Client Portal' })
    expect(desc).toBe("Create a new portal named 'Client Portal'")
  })

  it('describes configure_portal with config id', () => {
    const desc = describeToolCall('configure_portal', {
      portal_config_id: 'eeeeeeee-0000-0000-0000-000000000005',
    })
    expect(desc).toContain('Update portal configuration eeeeeeee')
  })

  it('falls back for unknown tool names', () => {
    expect(describeToolCall('some_future_tool', {})).toBe('Execute some_future_tool')
  })
})

// ─── assessRisk ──────────────────────────────────────────────────────────────

describe('assessRisk', () => {
  it('returns low for read-only tools', () => {
    const readOnlyTools = ['search_blocks', 'list_block_types', 'suggest_fields', 'calculate_delta']
    for (const tool of readOnlyTools) {
      expect(assessRisk(tool)).toBe('low' as RiskLevel)
    }
  })

  it('returns high for update_block', () => {
    expect(assessRisk('update_block')).toBe('high' as RiskLevel)
  })

  it('returns medium for create operations', () => {
    const createTools = [
      'create_block',
      'trigger_workflow',
      'create_block_type',
      'create_relationship',
      'create_portal',
      'configure_portal',
      'configure_block_type',
      'reassign_step',
      'extend_deadline',
    ]
    for (const tool of createTools) {
      expect(assessRisk(tool)).toBe('medium' as RiskLevel)
    }
  })

  it('returns medium for unknown tools (safe default)', () => {
    expect(assessRisk('unknown_tool')).toBe('medium' as RiskLevel)
  })
})

// ─── buildActionPreviews ─────────────────────────────────────────────────────

describe('buildActionPreviews', () => {
  it('builds previews from tool_use blocks', () => {
    const toolBlocks = [
      { name: 'create_block', input: { name: 'Acme Corp', type: 'client' } },
      { name: 'search_blocks', input: { query: 'Acme' } },
    ]

    const previews: ActionPreview[] = buildActionPreviews(toolBlocks)

    expect(previews).toHaveLength(2)

    // First preview: create_block
    expect(previews[0].toolName).toBe('create_block')
    expect(previews[0].input).toEqual({ name: 'Acme Corp', type: 'client' })
    expect(previews[0].description).toBe("Create a new client block named 'Acme Corp'")
    expect(previews[0].riskLevel).toBe('medium')
    expect(previews[0].id).toBeTruthy()
    // UUID format check
    expect(previews[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )

    // Second preview: search_blocks
    expect(previews[1].toolName).toBe('search_blocks')
    expect(previews[1].riskLevel).toBe('low')
  })

  it('generates unique IDs for each preview', () => {
    const toolBlocks = [
      { name: 'create_block', input: { name: 'A', type: 'client' } },
      { name: 'create_block', input: { name: 'B', type: 'client' } },
      { name: 'create_block', input: { name: 'C', type: 'client' } },
    ]

    const previews = buildActionPreviews(toolBlocks)
    const ids = previews.map((p) => p.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(3)
  })

  it('returns empty array when no tool blocks', () => {
    expect(buildActionPreviews([])).toEqual([])
  })

  it('handles null input gracefully', () => {
    const toolBlocks = [{ name: 'list_block_types', input: null }]
    const previews = buildActionPreviews(toolBlocks as Array<{ name: string; input: unknown }>)
    expect(previews).toHaveLength(1)
    expect(previews[0].input).toEqual({})
    expect(previews[0].description).toBe('List available block types')
  })
})
