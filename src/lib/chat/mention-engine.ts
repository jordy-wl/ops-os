/**
 * mention-engine.ts — Three-stage @mention state machine for hierarchical
 * block data references in chat input.
 *
 * Stages:
 *   1. Type:  @       → Shows block types (client, deal, project...)
 *   2. Field: @client/ → Shows fields for that type (jurisdiction, entity_type...)
 *   3. Value: @client/jurisdiction/ → Shows distinct values for that field
 *
 * The `/` character advances to the next stage.
 * Backspace past `/` returns to the previous stage.
 * Selecting at any stage resolves the mention.
 * Plain `@text` (no slash) still searches all blocks by name (backward compatible).
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type MentionStage =
  | { stage: 'type'; query: string }
  | { stage: 'field'; type: string; query: string }
  | { stage: 'value'; type: string; field: string; query: string }

export type MentionResolution =
  | { kind: 'block'; blockId: string; blockName: string; blockType: string }
  | { kind: 'type_query'; type: string; displayName: string }
  | { kind: 'field_query'; type: string; field: string; displayName: string }
  | { kind: 'value_query'; type: string; field: string; value: string; displayName: string }

export interface MentionState {
  /** Whether an @mention is active */
  active: boolean
  /** Current navigation stage (null when inactive) */
  current: MentionStage | null
  /** Position of the @ character in the input text */
  atIndex: number
  /** Whether we're in hierarchical mode (has a slash) vs plain block name search */
  hierarchical: boolean
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MENTION_TRIGGER = '@'
const STAGE_SEPARATOR = '/'

// ─── Initial state ──────────────────────────────────────────────────────────

export const INITIAL_MENTION_STATE: MentionState = {
  active: false,
  current: null,
  atIndex: -1,
  hierarchical: false,
}

// ─── Core parsing ───────────────────────────────────────────────────────────

/**
 * Parse the text before the cursor to determine the current mention state.
 * This is the core of the state machine — called on every input change.
 *
 * Returns null if no @mention is active at the cursor position.
 */
export function parseMentionState(text: string, cursorPos: number): MentionState | null {
  const before = text.slice(0, cursorPos)
  const atIndex = findMentionTrigger(before)
  if (atIndex === -1) return null

  const raw = before.slice(atIndex + 1)

  // If double spaces appear, the mention is abandoned
  if (/\s{2,}/.test(raw)) return null

  // Split on `/` to determine stage
  const parts = raw.split(STAGE_SEPARATOR)

  if (parts.length === 1) {
    // Stage 1: just @query (type search OR plain block name search)
    return {
      active: true,
      current: { stage: 'type', query: parts[0] },
      atIndex,
      hierarchical: false,
    }
  }

  if (parts.length === 2) {
    // Stage 2: @type/query (field search)
    return {
      active: true,
      current: { stage: 'field', type: parts[0], query: parts[1] },
      atIndex,
      hierarchical: true,
    }
  }

  if (parts.length >= 3) {
    // Stage 3: @type/field/query (value search)
    return {
      active: true,
      current: {
        stage: 'value',
        type: parts[0],
        field: parts[1],
        query: parts.slice(2).join(STAGE_SEPARATOR),
      },
      atIndex,
      hierarchical: true,
    }
  }

  return null
}

/**
 * Find the nearest unescaped @ trigger before the cursor.
 * The @ must be at the start of input or preceded by whitespace.
 */
function findMentionTrigger(before: string): number {
  const atIndex = before.lastIndexOf(MENTION_TRIGGER)
  if (atIndex === -1) return -1

  // @ must be at start or preceded by whitespace
  if (atIndex > 0 && !/\s/.test(before[atIndex - 1])) return -1

  return atIndex
}

// ─── Stage transitions ──────────────────────────────────────────────────────

/**
 * Advance to the next stage by appending a type or field selection.
 * Returns the new text to replace in the input.
 */
export function advanceStage(
  state: MentionState,
  selection: string
): { newMentionText: string; newStage: MentionStage } {
  if (!state.current) {
    throw new Error('Cannot advance: no active mention state')
  }

  switch (state.current.stage) {
    case 'type':
      return {
        newMentionText: `${MENTION_TRIGGER}${selection}${STAGE_SEPARATOR}`,
        newStage: { stage: 'field', type: selection, query: '' },
      }
    case 'field':
      return {
        newMentionText: `${MENTION_TRIGGER}${state.current.type}${STAGE_SEPARATOR}${selection}${STAGE_SEPARATOR}`,
        newStage: { stage: 'value', type: state.current.type, field: selection, query: '' },
      }
    case 'value':
      // Value stage doesn't advance further — selecting resolves
      throw new Error('Cannot advance past value stage')
  }
}

/**
 * Go back one stage (e.g., when user backspaces past a `/`).
 * Returns the new mention text to replace in the input, or null if
 * we're already at the first stage.
 */
export function retreatStage(
  state: MentionState
): { newMentionText: string; newStage: MentionStage } | null {
  if (!state.current) return null

  switch (state.current.stage) {
    case 'type':
      // Can't retreat past type — close the mention
      return null
    case 'field':
      return {
        newMentionText: `${MENTION_TRIGGER}`,
        newStage: { stage: 'type', query: '' },
      }
    case 'value':
      return {
        newMentionText: `${MENTION_TRIGGER}${state.current.type}${STAGE_SEPARATOR}`,
        newStage: { stage: 'field', type: state.current.type, query: '' },
      }
  }
}

// ─── Resolution ─────────────────────────────────────────────────────────────

/**
 * Resolve a mention selection at the current stage.
 * Returns the structured mention token and the display text for the input.
 */
export function resolveMention(
  state: MentionState,
  selection: {
    blockId?: string
    blockName?: string
    blockType?: string
    type?: string
    displayName?: string
    field?: string
    value?: string
  }
): { resolution: MentionResolution; displayText: string } {
  if (!state.current) {
    throw new Error('Cannot resolve: no active mention state')
  }

  // Plain block name search (no slash) — resolve as specific block
  if (!state.hierarchical && selection.blockId) {
    return {
      resolution: {
        kind: 'block',
        blockId: selection.blockId,
        blockName: selection.blockName ?? '',
        blockType: selection.blockType ?? '',
      },
      displayText: `@${selection.blockName}`,
    }
  }

  switch (state.current.stage) {
    case 'type': {
      const typeName = selection.type ?? state.current.query
      const displayName = selection.displayName ?? prettifyName(typeName)
      return {
        resolution: {
          kind: 'type_query',
          type: typeName,
          displayName,
        },
        displayText: `@${displayName}`,
      }
    }
    case 'field': {
      const fieldName = selection.field ?? ''
      const displayName = selection.displayName ?? prettifyName(fieldName)
      return {
        resolution: {
          kind: 'field_query',
          type: state.current.type,
          field: fieldName,
          displayName: `${prettifyName(state.current.type)}/${displayName}`,
        },
        displayText: `@${prettifyName(state.current.type)}/${displayName}`,
      }
    }
    case 'value': {
      const value = selection.value ?? ''
      return {
        resolution: {
          kind: 'value_query',
          type: state.current.type,
          field: state.current.field,
          value,
          displayName: `${prettifyName(state.current.type)}/${prettifyName(state.current.field)}/${value}`,
        },
        displayText: `@${prettifyName(state.current.type)}/${prettifyName(state.current.field)}/${value}`,
      }
    }
  }
}

/**
 * Get the raw mention text (everything from @ to cursor) from the current state.
 * Used to know what portion of the input to replace when resolving.
 */
export function getMentionReplaceRange(state: MentionState, cursorPos: number): { start: number; end: number } {
  return {
    start: state.atIndex,
    end: cursorPos,
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Convert a snake_case or camelCase name to Title Case with spaces.
 */
export function prettifyName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

/**
 * Check if a mention state indicates the user is in hierarchical mode
 * (has typed at least one /).
 */
export function isHierarchical(state: MentionState | null): boolean {
  return state?.hierarchical ?? false
}

/**
 * Get the current breadcrumb path for display above the dropdown.
 * E.g., "@client/" → ["Client"], "@client/jurisdiction/" → ["Client", "Jurisdiction"]
 */
export function getBreadcrumbs(state: MentionState): string[] {
  if (!state.current) return []

  switch (state.current.stage) {
    case 'type':
      return []
    case 'field':
      return [prettifyName(state.current.type)]
    case 'value':
      return [prettifyName(state.current.type), prettifyName(state.current.field)]
  }
}
