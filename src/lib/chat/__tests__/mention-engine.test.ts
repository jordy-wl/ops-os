import { describe, it, expect } from 'vitest'
import {
  parseMentionState,
  advanceStage,
  retreatStage,
  resolveMention,
  getMentionReplaceRange,
  prettifyName,
  getBreadcrumbs,
  isHierarchical,
  INITIAL_MENTION_STATE,
} from '../mention-engine'

// ─── parseMentionState ──────────────────────────────────────────────────────

describe('parseMentionState', () => {
  it('returns null when no @ is present', () => {
    expect(parseMentionState('hello world', 11)).toBeNull()
  })

  it('returns null when @ is not preceded by whitespace', () => {
    expect(parseMentionState('email@test', 10)).toBeNull()
  })

  it('returns null when double spaces appear after @', () => {
    expect(parseMentionState('@hello  world', 13)).toBeNull()
  })

  it('detects stage=type with empty query when @ just typed', () => {
    const result = parseMentionState('@', 1)
    expect(result).toEqual({
      active: true,
      current: { stage: 'type', query: '' },
      atIndex: 0,
      hierarchical: false,
    })
  })

  it('detects stage=type with query', () => {
    const result = parseMentionState('hello @cli', 10)
    expect(result).toEqual({
      active: true,
      current: { stage: 'type', query: 'cli' },
      atIndex: 6,
      hierarchical: false,
    })
  })

  it('detects stage=type when @ is at start of input', () => {
    const result = parseMentionState('@client', 7)
    expect(result).toEqual({
      active: true,
      current: { stage: 'type', query: 'client' },
      atIndex: 0,
      hierarchical: false,
    })
  })

  it('detects stage=field with type and empty query', () => {
    const result = parseMentionState('@client/', 8)
    expect(result).toEqual({
      active: true,
      current: { stage: 'field', type: 'client', query: '' },
      atIndex: 0,
      hierarchical: true,
    })
  })

  it('detects stage=field with type and query', () => {
    const result = parseMentionState('@client/juris', 13)
    expect(result).toEqual({
      active: true,
      current: { stage: 'field', type: 'client', query: 'juris' },
      atIndex: 0,
      hierarchical: true,
    })
  })

  it('detects stage=value with type, field, and empty query', () => {
    const result = parseMentionState('@client/jurisdiction/', 21)
    expect(result).toEqual({
      active: true,
      current: { stage: 'value', type: 'client', field: 'jurisdiction', query: '' },
      atIndex: 0,
      hierarchical: true,
    })
  })

  it('detects stage=value with type, field, and query', () => {
    const result = parseMentionState('@client/jurisdiction/aus', 24)
    expect(result).toEqual({
      active: true,
      current: { stage: 'value', type: 'client', field: 'jurisdiction', query: 'aus' },
      atIndex: 0,
      hierarchical: true,
    })
  })

  it('handles @ after a newline', () => {
    const result = parseMentionState('line one\n@deal', 14)
    expect(result).toEqual({
      active: true,
      current: { stage: 'type', query: 'deal' },
      atIndex: 9,
      hierarchical: false,
    })
  })

  it('handles cursor in the middle of text (not at end)', () => {
    const result = parseMentionState('@client/jurisdiction/ more text', 21)
    expect(result).toEqual({
      active: true,
      current: { stage: 'value', type: 'client', field: 'jurisdiction', query: '' },
      atIndex: 0,
      hierarchical: true,
    })
  })

  it('handles value query with slashes in it', () => {
    const result = parseMentionState('@type/field/some/path', 21)
    expect(result).toEqual({
      active: true,
      current: { stage: 'value', type: 'type', field: 'field', query: 'some/path' },
      atIndex: 0,
      hierarchical: true,
    })
  })

  it('uses the last @ when multiple are present', () => {
    const result = parseMentionState('cc @alice and @bob', 18)
    expect(result).toEqual({
      active: true,
      current: { stage: 'type', query: 'bob' },
      atIndex: 14,
      hierarchical: false,
    })
  })
})

// ─── advanceStage ───────────────────────────────────────────────────────────

describe('advanceStage', () => {
  it('advances type → field', () => {
    const state = {
      active: true,
      current: { stage: 'type' as const, query: 'client' },
      atIndex: 0,
      hierarchical: false,
    }
    const result = advanceStage(state, 'client')
    expect(result).toEqual({
      newMentionText: '@client/',
      newStage: { stage: 'field', type: 'client', query: '' },
    })
  })

  it('advances field → value', () => {
    const state = {
      active: true,
      current: { stage: 'field' as const, type: 'client', query: 'jurisdiction' },
      atIndex: 0,
      hierarchical: true,
    }
    const result = advanceStage(state, 'jurisdiction')
    expect(result).toEqual({
      newMentionText: '@client/jurisdiction/',
      newStage: { stage: 'value', type: 'client', field: 'jurisdiction', query: '' },
    })
  })

  it('throws when trying to advance past value', () => {
    const state = {
      active: true,
      current: { stage: 'value' as const, type: 'client', field: 'jurisdiction', query: 'AU' },
      atIndex: 0,
      hierarchical: true,
    }
    expect(() => advanceStage(state, 'AU')).toThrow('Cannot advance past value stage')
  })

  it('throws when no active state', () => {
    const state = { ...INITIAL_MENTION_STATE }
    expect(() => advanceStage(state, 'test')).toThrow('Cannot advance: no active mention state')
  })
})

// ─── retreatStage ───────────────────────────────────────────────────────────

describe('retreatStage', () => {
  it('returns null when at type stage (cannot retreat further)', () => {
    const state = {
      active: true,
      current: { stage: 'type' as const, query: 'cli' },
      atIndex: 0,
      hierarchical: false,
    }
    expect(retreatStage(state)).toBeNull()
  })

  it('retreats field → type', () => {
    const state = {
      active: true,
      current: { stage: 'field' as const, type: 'client', query: '' },
      atIndex: 0,
      hierarchical: true,
    }
    const result = retreatStage(state)
    expect(result).toEqual({
      newMentionText: '@',
      newStage: { stage: 'type', query: '' },
    })
  })

  it('retreats value → field', () => {
    const state = {
      active: true,
      current: { stage: 'value' as const, type: 'client', field: 'jurisdiction', query: '' },
      atIndex: 0,
      hierarchical: true,
    }
    const result = retreatStage(state)
    expect(result).toEqual({
      newMentionText: '@client/',
      newStage: { stage: 'field', type: 'client', query: '' },
    })
  })

  it('returns null when state is inactive', () => {
    expect(retreatStage(INITIAL_MENTION_STATE)).toBeNull()
  })
})

// ─── resolveMention ─────────────────────────────────────────────────────────

describe('resolveMention', () => {
  it('resolves a plain block mention (no slash)', () => {
    const state = {
      active: true,
      current: { stage: 'type' as const, query: 'thornfield' },
      atIndex: 0,
      hierarchical: false,
    }
    const result = resolveMention(state, {
      blockId: 'uuid-1',
      blockName: 'Thornfield Capital',
      blockType: 'client',
    })
    expect(result).toEqual({
      resolution: {
        kind: 'block',
        blockId: 'uuid-1',
        blockName: 'Thornfield Capital',
        blockType: 'client',
      },
      displayText: '@Thornfield Capital',
    })
  })

  it('resolves a type-level selection', () => {
    const state = {
      active: true,
      current: { stage: 'type' as const, query: 'client' },
      atIndex: 0,
      hierarchical: true,
    }
    const result = resolveMention(state, { type: 'client', displayName: 'Client' })
    expect(result).toEqual({
      resolution: { kind: 'type_query', type: 'client', displayName: 'Client' },
      displayText: '@Client',
    })
  })

  it('resolves a field-level selection', () => {
    const state = {
      active: true,
      current: { stage: 'field' as const, type: 'client', query: 'jurisdiction' },
      atIndex: 0,
      hierarchical: true,
    }
    const result = resolveMention(state, { field: 'jurisdiction', displayName: 'Jurisdiction' })
    expect(result).toEqual({
      resolution: {
        kind: 'field_query',
        type: 'client',
        field: 'jurisdiction',
        displayName: 'Client/Jurisdiction',
      },
      displayText: '@Client/Jurisdiction',
    })
  })

  it('resolves a value-level selection', () => {
    const state = {
      active: true,
      current: { stage: 'value' as const, type: 'client', field: 'jurisdiction', query: 'AU' },
      atIndex: 0,
      hierarchical: true,
    }
    const result = resolveMention(state, { value: 'Australia' })
    expect(result).toEqual({
      resolution: {
        kind: 'value_query',
        type: 'client',
        field: 'jurisdiction',
        value: 'Australia',
        displayName: 'Client/Jurisdiction/Australia',
      },
      displayText: '@Client/Jurisdiction/Australia',
    })
  })

  it('throws when no active state', () => {
    expect(() => resolveMention(INITIAL_MENTION_STATE, {})).toThrow(
      'Cannot resolve: no active mention state'
    )
  })

  it('resolves type with prettified name when no displayName given', () => {
    const state = {
      active: true,
      current: { stage: 'type' as const, query: 'team_member' },
      atIndex: 0,
      hierarchical: true,
    }
    const result = resolveMention(state, { type: 'team_member' })
    expect(result.resolution).toEqual({
      kind: 'type_query',
      type: 'team_member',
      displayName: 'Team Member',
    })
  })
})

// ─── getMentionReplaceRange ─────────────────────────────────────────────────

describe('getMentionReplaceRange', () => {
  it('returns the correct range for replacement', () => {
    const state = {
      active: true,
      current: { stage: 'type' as const, query: 'cli' },
      atIndex: 5,
      hierarchical: false,
    }
    expect(getMentionReplaceRange(state, 9)).toEqual({ start: 5, end: 9 })
  })

  it('handles @mention at the start of input', () => {
    const state = {
      active: true,
      current: { stage: 'field' as const, type: 'client', query: 'juri' },
      atIndex: 0,
      hierarchical: true,
    }
    expect(getMentionReplaceRange(state, 12)).toEqual({ start: 0, end: 12 })
  })
})

// ─── prettifyName ───────────────────────────────────────────────────────────

describe('prettifyName', () => {
  it('converts snake_case to Title Case', () => {
    expect(prettifyName('team_member')).toBe('Team Member')
  })

  it('converts camelCase to Title Case', () => {
    expect(prettifyName('teamMember')).toBe('Team Member')
  })

  it('handles single word', () => {
    expect(prettifyName('client')).toBe('Client')
  })

  it('handles empty string', () => {
    expect(prettifyName('')).toBe('')
  })

  it('handles already capitalized names', () => {
    expect(prettifyName('AU')).toBe('AU')
  })

  it('handles multiple underscores', () => {
    expect(prettifyName('task_queue_item')).toBe('Task Queue Item')
  })
})

// ─── isHierarchical ─────────────────────────────────────────────────────────

describe('isHierarchical', () => {
  it('returns false for null state', () => {
    expect(isHierarchical(null)).toBe(false)
  })

  it('returns false for non-hierarchical state', () => {
    const state = {
      active: true,
      current: { stage: 'type' as const, query: 'cli' },
      atIndex: 0,
      hierarchical: false,
    }
    expect(isHierarchical(state)).toBe(false)
  })

  it('returns true for hierarchical state', () => {
    const state = {
      active: true,
      current: { stage: 'field' as const, type: 'client', query: '' },
      atIndex: 0,
      hierarchical: true,
    }
    expect(isHierarchical(state)).toBe(true)
  })
})

// ─── getBreadcrumbs ─────────────────────────────────────────────────────────

describe('getBreadcrumbs', () => {
  it('returns empty for type stage', () => {
    const state = {
      active: true,
      current: { stage: 'type' as const, query: '' },
      atIndex: 0,
      hierarchical: false,
    }
    expect(getBreadcrumbs(state)).toEqual([])
  })

  it('returns type name for field stage', () => {
    const state = {
      active: true,
      current: { stage: 'field' as const, type: 'client', query: '' },
      atIndex: 0,
      hierarchical: true,
    }
    expect(getBreadcrumbs(state)).toEqual(['Client'])
  })

  it('returns type and field for value stage', () => {
    const state = {
      active: true,
      current: { stage: 'value' as const, type: 'client', field: 'jurisdiction', query: '' },
      atIndex: 0,
      hierarchical: true,
    }
    expect(getBreadcrumbs(state)).toEqual(['Client', 'Jurisdiction'])
  })

  it('returns empty for inactive state', () => {
    expect(getBreadcrumbs(INITIAL_MENTION_STATE)).toEqual([])
  })
})

// ─── INITIAL_MENTION_STATE ──────────────────────────────────────────────────

describe('INITIAL_MENTION_STATE', () => {
  it('is inactive with null current', () => {
    expect(INITIAL_MENTION_STATE).toEqual({
      active: false,
      current: null,
      atIndex: -1,
      hierarchical: false,
    })
  })
})
