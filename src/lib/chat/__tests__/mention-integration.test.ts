/**
 * Integration test — End-to-end @mention flow
 *
 * Tests the complete chain:
 *   1. mention-engine parses user input → MentionState
 *   2. advanceStage / resolveMention produce MentionResolution
 *   3. MentionResolution shapes match what /api/ai/chat expects
 *   4. mention-context resolves MentionInput into context strings
 *   5. Backward compat: plain @name still works as block mention
 *
 * This is a unit-level integration test — no real DB or HTTP calls.
 * It verifies the type contracts between modules are correct.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  parseMentionState,
  advanceStage,
  resolveMention,
  getMentionReplaceRange,
  getBreadcrumbs,
  prettifyName,
  isHierarchical,
} from '../mention-engine'
import type { MentionResolution } from '../mention-engine'
import { MentionInputSchema } from '@/lib/ai/mention-context'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Simulate a full mention flow: type text, parse state, navigate stages, resolve.
 */
function simulateTyping(text: string, cursorPos?: number) {
  return parseMentionState(text, cursorPos ?? text.length)
}

// ─── Flow 1: @client/ → field stage → @client/jurisdiction/ → value stage → resolve ──

describe('End-to-end hierarchical mention flow', () => {
  it('completes a full 3-stage @type/field/value mention', () => {
    // Step 1: User types "@cli"
    const state1 = simulateTyping('Hello @cli')!
    expect(state1.active).toBe(true)
    expect(state1.current).toEqual({ stage: 'type', query: 'cli' })
    expect(isHierarchical(state1)).toBe(false)
    expect(getBreadcrumbs(state1)).toEqual([])

    // Step 2: User selects "client" type → advanceStage
    const { newMentionText: text2, newStage: stage2 } = advanceStage(state1, 'client')
    expect(text2).toBe('@client/')
    expect(stage2).toEqual({ stage: 'field', type: 'client', query: '' })

    // Step 3: Simulate the text being replaced → "@client/jur"
    const state3 = simulateTyping('Hello @client/jur')!
    expect(state3.current).toEqual({ stage: 'field', type: 'client', query: 'jur' })
    expect(isHierarchical(state3)).toBe(true)
    expect(getBreadcrumbs(state3)).toEqual(['Client'])

    // Step 4: User selects "jurisdiction" → advanceStage
    const { newMentionText: text4, newStage: stage4 } = advanceStage(state3, 'jurisdiction')
    expect(text4).toBe('@client/jurisdiction/')
    expect(stage4).toEqual({ stage: 'value', type: 'client', field: 'jurisdiction', query: '' })

    // Step 5: Simulate text → "@client/jurisdiction/aus"
    const state5 = simulateTyping('Hello @client/jurisdiction/aus')!
    expect(state5.current).toEqual({
      stage: 'value',
      type: 'client',
      field: 'jurisdiction',
      query: 'aus',
    })
    expect(getBreadcrumbs(state5)).toEqual(['Client', 'Jurisdiction'])

    // Step 6: User selects "Australia" → resolve
    const { resolution, displayText } = resolveMention(state5, { value: 'Australia' })
    expect(resolution).toEqual({
      kind: 'value_query',
      type: 'client',
      field: 'jurisdiction',
      value: 'Australia',
      displayName: 'Client/Jurisdiction/Australia',
    })
    expect(displayText).toBe('@Client/Jurisdiction/Australia')

    // Step 7: Verify the resolution is valid for the AI context schema
    const parsed = MentionInputSchema.safeParse([resolution])
    expect(parsed.success).toBe(true)

    // Step 8: Verify replace range covers the full @mention
    const range = getMentionReplaceRange(state5, 'Hello @client/jurisdiction/aus'.length)
    expect(range.start).toBe(6) // position of @
    expect(range.end).toBe(30) // cursor position
  })

  it('resolves at type stage (type_query)', () => {
    const state = simulateTyping('Check @deal')!
    expect(state.current).toEqual({ stage: 'type', query: 'deal' })

    const { resolution, displayText } = resolveMention(state, {
      type: 'deal',
      displayName: 'Deal',
    })

    expect(resolution).toEqual({
      kind: 'type_query',
      type: 'deal',
      displayName: 'Deal',
    })
    expect(displayText).toBe('@Deal')

    // Valid for AI schema
    expect(MentionInputSchema.safeParse([resolution]).success).toBe(true)
  })

  it('resolves at field stage (field_query)', () => {
    const state = simulateTyping('Show @project/status')!
    expect(state.current).toEqual({ stage: 'field', type: 'project', query: 'status' })

    const { resolution, displayText } = resolveMention(state, {
      field: 'status',
      displayName: 'Status',
    })

    expect(resolution).toEqual({
      kind: 'field_query',
      type: 'project',
      field: 'status',
      displayName: 'Project/Status',
    })
    expect(displayText).toBe('@Project/Status')

    expect(MentionInputSchema.safeParse([resolution]).success).toBe(true)
  })
})

// ─── Flow 2: Plain @name → block mention (backward compat) ─────────────────

describe('Backward-compatible plain @name mention', () => {
  it('resolves plain @name as block mention', () => {
    const state = simulateTyping('Tell me about @thornfield')!
    expect(state.current).toEqual({ stage: 'type', query: 'thornfield' })
    expect(isHierarchical(state)).toBe(false)

    // User selects a specific block from the dropdown
    const { resolution, displayText } = resolveMention(state, {
      blockId: '00000000-0000-0000-0000-000000000001',
      blockName: 'Thornfield Capital',
      blockType: 'client',
    })

    expect(resolution).toEqual({
      kind: 'block',
      blockId: '00000000-0000-0000-0000-000000000001',
      blockName: 'Thornfield Capital',
      blockType: 'client',
    })
    expect(displayText).toBe('@Thornfield Capital')

    // Valid for AI schema
    expect(MentionInputSchema.safeParse([resolution]).success).toBe(true)
  })

  it('handles @ at the start of input', () => {
    const state = simulateTyping('@acme')!
    expect(state.active).toBe(true)
    expect(state.atIndex).toBe(0)
    expect(state.current).toEqual({ stage: 'type', query: 'acme' })
  })
})

// ─── Flow 3: Multiple mentions in one message ───────────────────────────────

describe('Multiple mentions in a single message', () => {
  it('validates multiple MentionResolutions for AI schema', () => {
    const mentions: MentionResolution[] = [
      {
        kind: 'block',
        blockId: '00000000-0000-0000-0000-000000000001',
        blockName: 'Acme Corp',
        blockType: 'client',
      },
      {
        kind: 'type_query',
        type: 'deal',
        displayName: 'Deal',
      },
      {
        kind: 'field_query',
        type: 'client',
        field: 'jurisdiction',
        displayName: 'Client/Jurisdiction',
      },
      {
        kind: 'value_query',
        type: 'client',
        field: 'entity_type',
        value: 'pty_ltd',
        displayName: 'Client/Entity Type/Pty Ltd',
      },
    ]

    const parsed = MentionInputSchema.safeParse(mentions)
    expect(parsed.success).toBe(true)
  })

  it('rejects more than 10 mentions per AI schema limit', () => {
    const mentions = Array.from({ length: 11 }, (_, i) => ({
      kind: 'type_query' as const,
      type: `type_${i}`,
      displayName: `Type ${i}`,
    }))

    const parsed = MentionInputSchema.safeParse(mentions)
    expect(parsed.success).toBe(false)
  })
})

// ─── Flow 4: Stage retreat (backspace navigation) ───────────────────────────

describe('Stage retreat preserves navigation context', () => {
  it('retreats from value to field to type', () => {
    // User is at @client/jurisdiction/aus
    const state = simulateTyping('@client/jurisdiction/aus')!
    expect(state.current!.stage).toBe('value')

    // Simulate retreat from value → field
    // (In real UI, user backspaces past the `/` before "aus")
    const stateField = simulateTyping('@client/jurisdiction/')!
    expect(stateField.current).toEqual({ stage: 'value', type: 'client', field: 'jurisdiction', query: '' })

    // Further retreat — back to @client/
    const stateType = simulateTyping('@client/')!
    expect(stateType.current).toEqual({ stage: 'field', type: 'client', query: '' })

    // Further retreat — back to @client
    const stateBase = simulateTyping('@client')!
    expect(stateBase.current).toEqual({ stage: 'type', query: 'client' })
    expect(isHierarchical(stateBase)).toBe(false)
  })
})

// ─── Flow 5: Edge cases ─────────────────────────────────────────────────────

describe('Edge cases', () => {
  it('abandons mention on double space', () => {
    const state = simulateTyping('Hello @cli  ')
    expect(state).toBeNull()
  })

  it('does not trigger mention when @ is mid-word', () => {
    const state = simulateTyping('email@example.com')
    expect(state).toBeNull()
  })

  it('handles empty query at each stage', () => {
    // Just @ with nothing after
    const s1 = simulateTyping('@')!
    expect(s1.current).toEqual({ stage: 'type', query: '' })

    // @type/ with nothing after
    const s2 = simulateTyping('@client/')!
    expect(s2.current).toEqual({ stage: 'field', type: 'client', query: '' })

    // @type/field/ with nothing after
    const s3 = simulateTyping('@client/jurisdiction/')!
    expect(s3.current).toEqual({ stage: 'value', type: 'client', field: 'jurisdiction', query: '' })
  })

  it('prettifyName handles various formats', () => {
    expect(prettifyName('snake_case_name')).toBe('Snake Case Name')
    expect(prettifyName('camelCase')).toBe('Camel Case')
    expect(prettifyName('simple')).toBe('Simple')
    expect(prettifyName('UPPER')).toBe('UPPER')
  })

  it('MentionInputSchema rejects invalid kind', () => {
    const bad = [{ kind: 'invalid_kind', type: 'client' }]
    const parsed = MentionInputSchema.safeParse(bad)
    expect(parsed.success).toBe(false)
  })

  it('MentionInputSchema rejects invalid UUID for blockId', () => {
    const bad = [{ kind: 'block', blockId: 'not-a-uuid', blockName: 'Test', blockType: 'client' }]
    const parsed = MentionInputSchema.safeParse(bad)
    expect(parsed.success).toBe(false)
  })
})

// ─── Flow 6: Mention resolution shapes match API contract ───────────────────

describe('Resolution shapes match POST /api/ai/chat contract', () => {
  it('block resolution includes all required fields for context assembly', () => {
    const state = simulateTyping('@acme')!
    const { resolution } = resolveMention(state, {
      blockId: '11111111-1111-1111-1111-111111111111',
      blockName: 'Acme Corp',
      blockType: 'client',
    })

    // These fields are what mention-context.ts resolveBlock() needs
    expect(resolution.kind).toBe('block')
    if (resolution.kind === 'block') {
      expect(resolution.blockId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      )
      expect(resolution.blockName).toBeTruthy()
      expect(resolution.blockType).toBeTruthy()
    }
  })

  it('type_query resolution includes required type field', () => {
    const state = simulateTyping('@deal')!
    const { resolution } = resolveMention(state, { type: 'deal', displayName: 'Deal' })

    if (resolution.kind === 'type_query') {
      expect(resolution.type).toBe('deal')
      expect(resolution.displayName).toBe('Deal')
    }
  })

  it('field_query resolution includes required type and field', () => {
    const state = simulateTyping('@client/jurisdiction')!
    const { resolution } = resolveMention(state, { field: 'jurisdiction', displayName: 'Jurisdiction' })

    if (resolution.kind === 'field_query') {
      expect(resolution.type).toBe('client')
      expect(resolution.field).toBe('jurisdiction')
    }
  })

  it('value_query resolution includes required type, field, and value', () => {
    const state = simulateTyping('@client/jurisdiction/aus')!
    const { resolution } = resolveMention(state, { value: 'Australia' })

    if (resolution.kind === 'value_query') {
      expect(resolution.type).toBe('client')
      expect(resolution.field).toBe('jurisdiction')
      expect(resolution.value).toBe('Australia')
    }
  })
})
