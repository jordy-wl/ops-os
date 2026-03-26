'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ChevronRight, Loader2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChatMode } from './chat-widget-provider'
import type { MentionResolution, MentionState } from '@/lib/chat/mention-engine'
import {
  parseMentionState,
  advanceStage,
  resolveMention,
  getMentionReplaceRange,
  getBreadcrumbs,
  prettifyName,
  INITIAL_MENTION_STATE,
} from '@/lib/chat/mention-engine'
import { MentionPillRow } from './mention-pill'

// ─── Types ──────────────────────────────────────────────────────────────────

interface MentionBlock {
  id: string
  name: string
  type: string
}

/** Results from /api/blocks/mention-search by stage */
interface TypeResult {
  type_name: string
  display_name: string
  icon: string
  block_count: number
}

interface FieldResult {
  field: string
  label: string
  field_type: string
}

interface ValueResult {
  value: string
  count: number
}

type DropdownItem =
  | { kind: 'block'; block: MentionBlock }
  | { kind: 'type'; data: TypeResult }
  | { kind: 'field'; data: FieldResult }
  | { kind: 'value'; data: ValueResult }

export interface ChatInputProps {
  onSend: (message: string, mentions?: MentionResolution[]) => void
  disabled?: boolean
  currentMode: ChatMode
  onModeChange: (mode: ChatMode) => void
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 250

const NEXT_MODE: Record<ChatMode, ChatMode> = {
  discuss: 'plan',
  plan: 'execute',
  execute: 'discuss',
}

const MODE_STYLE: Record<ChatMode, string> = {
  plan: 'text-amber-600 border-amber-400 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-600 dark:hover:bg-amber-950',
  execute: 'text-green-600 border-green-400 hover:bg-green-50 dark:text-green-400 dark:border-green-600 dark:hover:bg-green-950',
  discuss: 'text-blue-600 border-blue-400 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-600 dark:hover:bg-blue-950',
}

const MODE_LABEL: Record<ChatMode, string> = {
  discuss: 'Discuss',
  plan: 'Plan',
  execute: 'Execute',
}

const STAGE_BORDER_COLOR: Record<string, string> = {
  type: 'border-l-blue-500',
  field: 'border-l-amber-500',
  value: 'border-l-green-500',
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ChatInput({ onSend, disabled = false, currentMode, onModeChange }: ChatInputProps) {
  const [value, setValue] = useState('')
  const [resolvedMentions, setResolvedMentions] = useState<MentionResolution[]>([])

  // Mention state machine
  const [mentionState, setMentionState] = useState<MentionState>(INITIAL_MENTION_STATE)
  const [dropdownItems, setDropdownItems] = useState<DropdownItem[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // ── Search (stage-aware) ────────────────────────────────────────────────

  const search = useCallback(async (state: MentionState) => {
    if (abortRef.current) abortRef.current.abort()
    if (!state.active || !state.current) return

    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)

    try {
      const { stage } = state.current

      // Plain block name search (non-hierarchical type stage with query)
      if (stage === 'type' && !state.hierarchical) {
        const query = state.current.query
        if (!query.trim()) {
          // Show type list when @ just typed (empty query)
          await searchTypes('', controller.signal)
          return
        }
        // Search both blocks by name AND types
        await searchBlocksAndTypes(query, controller.signal)
        return
      }

      // Hierarchical search via mention-search API
      const params = new URLSearchParams({ stage })
      if (state.current.query) params.set('q', state.current.query)
      if ('type' in state.current) params.set('type', state.current.type)
      if ('field' in state.current) params.set('field', state.current.field)

      const res = await fetch(`/api/blocks/mention-search?${params}`, {
        signal: controller.signal,
      })

      if (!res.ok) {
        setDropdownItems([])
        return
      }

      const json = await res.json()
      const data = json.data ?? []

      if (stage === 'type') {
        setDropdownItems(data.map((d: TypeResult) => ({ kind: 'type' as const, data: d })))
      } else if (stage === 'field') {
        setDropdownItems(data.map((d: FieldResult) => ({ kind: 'field' as const, data: d })))
      } else if (stage === 'value') {
        setDropdownItems(data.map((d: ValueResult) => ({ kind: 'value' as const, data: d })))
      }
      setActiveIndex(0)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setDropdownItems([])
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  /** Search types only (when @ is first typed) */
  async function searchTypes(query: string, signal: AbortSignal) {
    const params = new URLSearchParams({ stage: 'type' })
    if (query) params.set('q', query)
    try {
      const res = await fetch(`/api/blocks/mention-search?${params}`, { signal })
      if (!res.ok) { setDropdownItems([]); return }
      const json = await res.json()
      setDropdownItems((json.data ?? []).map((d: TypeResult) => ({ kind: 'type' as const, data: d })))
      setActiveIndex(0)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setDropdownItems([])
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }

  /** Search blocks by name AND types (backward compatible plain @query) */
  async function searchBlocksAndTypes(query: string, signal: AbortSignal) {
    try {
      // Fetch blocks and types in parallel
      const [blocksRes, typesRes] = await Promise.all([
        fetch(`/api/blocks?q=${encodeURIComponent(query)}&limit=5`, { signal }),
        fetch(`/api/blocks/mention-search?stage=type&q=${encodeURIComponent(query)}`, { signal }),
      ])

      const items: DropdownItem[] = []

      if (blocksRes.ok) {
        const json = await blocksRes.json()
        const blocks: MentionBlock[] = (json.data ?? []).map(
          (b: { id: string; name: string; type: string }) => ({ id: b.id, name: b.name, type: b.type })
        )
        items.push(...blocks.map((block) => ({ kind: 'block' as const, block })))
      }

      if (typesRes.ok) {
        const json = await typesRes.json()
        const types: TypeResult[] = json.data ?? []
        items.push(...types.map((data) => ({ kind: 'type' as const, data })))
      }

      setDropdownItems(items)
      setActiveIndex(0)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setDropdownItems([])
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }

  const debouncedSearch = useCallback(
    (state: MentionState) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => search(state), DEBOUNCE_MS)
    },
    [search]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  // ── Click outside to close ──────────────────────────────────────────────

  useEffect(() => {
    if (!mentionState.active) return
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        textareaRef.current && !textareaRef.current.contains(target)
      ) {
        closeMention()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [mentionState.active])

  // ── Mention helpers ─────────────────────────────────────────────────────

  function closeMention() {
    setMentionState(INITIAL_MENTION_STATE)
    setDropdownItems([])
    setLoading(false)
    setActiveIndex(0)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (abortRef.current) abortRef.current.abort()
  }

  function selectItem(item: DropdownItem) {
    if (!mentionState.current) return

    if (item.kind === 'block') {
      // Plain block selection — resolve immediately
      const { resolution, displayText } = resolveMention(mentionState, {
        blockId: item.block.id,
        blockName: item.block.name,
        blockType: item.block.type,
      })
      replaceAndResolve(displayText, resolution)
      return
    }

    if (item.kind === 'type') {
      if (mentionState.current.stage === 'type') {
        // Advance to field stage
        const { newMentionText, newStage } = advanceStage(mentionState, item.data.type_name)
        replaceInInput(newMentionText)
        const newState: MentionState = {
          ...mentionState,
          current: newStage,
          hierarchical: true,
        }
        setMentionState(newState)
        setDropdownItems([])
        setLoading(true)
        search(newState)
        return
      }
      // Type selected at type stage as final resolution
      const { resolution, displayText } = resolveMention(
        { ...mentionState, hierarchical: true },
        { type: item.data.type_name, displayName: item.data.display_name }
      )
      replaceAndResolve(displayText, resolution)
      return
    }

    if (item.kind === 'field') {
      // Advance to value stage
      const { newMentionText, newStage } = advanceStage(mentionState, item.data.field)
      replaceInInput(newMentionText)
      const newState: MentionState = {
        ...mentionState,
        current: newStage,
        hierarchical: true,
      }
      setMentionState(newState)
      setDropdownItems([])
      setLoading(true)
      search(newState)
      return
    }

    if (item.kind === 'value') {
      // Final resolution
      const { resolution, displayText } = resolveMention(mentionState, {
        value: item.data.value,
      })
      replaceAndResolve(displayText, resolution)
    }
  }

  function replaceInInput(mentionText: string) {
    const cursorPos = textareaRef.current?.selectionStart ?? value.length
    const { start } = getMentionReplaceRange(mentionState, cursorPos)
    const after = value.slice(cursorPos)
    const newValue = value.slice(0, start) + mentionText + after
    setValue(newValue)

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        const pos = start + mentionText.length
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(pos, pos)
      }
    })
  }

  function replaceAndResolve(displayText: string, resolution: MentionResolution) {
    const cursorPos = textareaRef.current?.selectionStart ?? value.length
    const { start } = getMentionReplaceRange(mentionState, cursorPos)
    const after = value.slice(cursorPos)
    const insertText = displayText + ' '
    const newValue = value.slice(0, start) + insertText + after
    setValue(newValue)

    setResolvedMentions((prev) => [...prev, resolution])
    closeMention()

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        const pos = start + insertText.length
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(pos, pos)
      }
    })
  }

  function handleBack() {
    if (!mentionState.current) return
    const stage = mentionState.current.stage
    if (stage === 'type') { closeMention(); return }

    // Go back one stage
    if (stage === 'field') {
      const text = '@'
      replaceInInput(text)
      const newState: MentionState = {
        ...mentionState,
        current: { stage: 'type', query: '' },
        hierarchical: false,
      }
      setMentionState(newState)
      setDropdownItems([])
      setLoading(true)
      search(newState)
    } else if (stage === 'value' && mentionState.current.stage === 'value') {
      const text = `@${mentionState.current.type}/`
      replaceInInput(text)
      const newState: MentionState = {
        ...mentionState,
        current: { stage: 'field', type: mentionState.current.type, query: '' },
        hierarchical: true,
      }
      setMentionState(newState)
      setDropdownItems([])
      setLoading(true)
      search(newState)
    }
  }

  // ── Submission ──────────────────────────────────────────────────────────

  function handleSubmit() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return

    onSend(trimmed, resolvedMentions.length > 0 ? resolvedMentions : undefined)
    setValue('')
    setResolvedMentions([])
    closeMention()

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  // ── Keyboard ────────────────────────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionState.active && dropdownItems.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((prev) => (prev + 1) % dropdownItems.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((prev) => (prev - 1 + dropdownItems.length) % dropdownItems.length)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        selectItem(dropdownItems[activeIndex])
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        const item = dropdownItems[activeIndex]
        // Tab advances to next stage for types/fields, resolves for blocks/values
        if (item.kind === 'type' || item.kind === 'field') {
          selectItem(item)
        } else {
          selectItem(item)
        }
        return
      }
    }

    if (mentionState.active && e.key === 'Escape') {
      e.preventDefault()
      closeMention()
      return
    }

    // Backspace: if we're at a stage boundary, go back
    if (mentionState.active && mentionState.hierarchical && e.key === 'Backspace') {
      const cursorPos = textareaRef.current?.selectionStart ?? 0
      const charBefore = value[cursorPos - 1]
      if (charBefore === '/') {
        e.preventDefault()
        handleBack()
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // ── Input change ────────────────────────────────────────────────────────

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newValue = e.target.value
    setValue(newValue)

    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`

    const cursorPos = el.selectionStart ?? newValue.length
    const state = parseMentionState(newValue, cursorPos)

    if (state) {
      setMentionState(state)
      debouncedSearch(state)
    } else {
      if (mentionState.active) closeMention()
    }
  }

  // ── Scroll active item into view ────────────────────────────────────────

  useEffect(() => {
    if (!mentionState.active || !dropdownRef.current) return
    const listEl = dropdownRef.current.querySelector('[role="listbox"]')
    if (!listEl) return
    const activeEl = listEl.children[activeIndex] as HTMLElement | undefined
    if (activeEl) activeEl.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, mentionState.active])

  // ── Render ──────────────────────────────────────────────────────────────

  const showDropdown = mentionState.active && (loading || dropdownItems.length > 0)
  const breadcrumbs = mentionState.active ? getBreadcrumbs(mentionState) : []
  const currentStage = mentionState.current?.stage ?? 'type'

  return (
    <div className="relative border-t bg-background px-4 py-3">
      {/* Mention dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className={cn(
            'absolute bottom-full left-4 right-4 mb-1 rounded-lg border border-border bg-background shadow-lg z-10 border-l-2',
            STAGE_BORDER_COLOR[currentStage]
          )}
          role="dialog"
          aria-label="Mention suggestions"
        >
          {/* Breadcrumb header */}
          {breadcrumbs.length > 0 && (
            <div className="flex items-center gap-1 border-b border-border px-3 py-1.5 text-xs text-muted-foreground">
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); handleBack() }}
                className="shrink-0 rounded p-0.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Go back"
              >
                <ArrowLeft className="h-3 w-3" aria-hidden="true" />
              </button>
              <span className="text-muted-foreground">@</span>
              {breadcrumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3 text-muted-foreground/50" aria-hidden="true" />
                  <span className="font-medium text-foreground">{crumb}</span>
                </span>
              ))}
              <ChevronRight className="h-3 w-3 text-muted-foreground/50" aria-hidden="true" />
            </div>
          )}

          {/* Content */}
          {loading && dropdownItems.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground" role="status">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Searching...</span>
            </div>
          ) : dropdownItems.length === 0 ? (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              No results found
            </div>
          ) : (
            <ul role="listbox" aria-label="Suggestions" className="max-h-52 overflow-y-auto py-1">
              {dropdownItems.map((item, index) => (
                <li
                  key={getItemKey(item, index)}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors',
                    index === activeIndex ? 'bg-muted text-foreground' : 'text-foreground hover:bg-muted'
                  )}
                  onMouseDown={(e) => { e.preventDefault(); selectItem(item) }}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  {renderItem(item)}
                </li>
              ))}
              {loading && dropdownItems.length > 0 && (
                <li className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground" role="status">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  <span>Updating...</span>
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      {/* Input area with mention pills */}
      <div className="flex flex-col gap-1 rounded-xl border border-border bg-muted px-3 py-2 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
        <MentionPillRow
          mentions={resolvedMentions}
          onRemove={(index) => setResolvedMentions((prev) => prev.filter((_, i) => i !== index))}
        />
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? 'AI is responding...' : 'Ask about your operations... (@ to mention)'}
            disabled={disabled}
            rows={1}
            aria-label="Chat message"
            aria-haspopup="listbox"
            className={cn(
              'flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground',
              'focus:outline-none max-h-32 leading-relaxed',
              disabled && 'opacity-60 cursor-not-allowed'
            )}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={disabled || !value.trim()}
            aria-label="Send message"
            className={cn(
              'shrink-0 h-8 w-8 rounded-lg flex items-center justify-center transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              disabled || !value.trim()
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:bg-primary/80'
            )}
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M1.5 1.5a.5.5 0 0 1 .5-.5h12a.5.5 0 0 1 .354.854l-6 6a.5.5 0 0 1-.708 0l-6-6A.5.5 0 0 1 1.5 1.5zm.707.5L8 7.793 13.793 2H2.207zM1.5 6a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1H2a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1H2a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1H2a.5.5 0 0 1-.5-.5z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onModeChange(NEXT_MODE[currentMode])}
          aria-label={`Switch to ${MODE_LABEL[NEXT_MODE[currentMode]]} mode`}
          className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full border transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            MODE_STYLE[NEXT_MODE[currentMode]]
          )}
        >
          <span className="inline-flex items-center gap-1">
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
            {MODE_LABEL[NEXT_MODE[currentMode]]} mode
          </span>
        </button>
        <p className="text-xs text-muted-foreground">
          Enter to send · Shift+Enter for newline · @ to mention
        </p>
      </div>
    </div>
  )
}

// ─── Dropdown item rendering ────────────────────────────────────────────────

function renderItem(item: DropdownItem) {
  switch (item.kind) {
    case 'block':
      return (
        <>
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate font-medium">{item.block.name}</span>
          <span className="ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none bg-muted text-foreground">
            {prettifyName(item.block.type)}
          </span>
        </>
      )
    case 'type':
      return (
        <>
          <span className="shrink-0 text-base" aria-hidden="true">{item.data.icon || '📦'}</span>
          <span className="truncate font-medium">{item.data.display_name}</span>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {item.data.block_count} blocks
          </span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
        </>
      )
    case 'field':
      return (
        <>
          <span className="shrink-0 w-4 text-center text-xs text-muted-foreground" aria-hidden="true">
            {fieldTypeIcon(item.data.field_type)}
          </span>
          <span className="truncate font-medium">{item.data.label}</span>
          <span className="ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium leading-none bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            {item.data.field_type}
          </span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
        </>
      )
    case 'value':
      return (
        <>
          <span className="truncate font-medium">{item.data.value}</span>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {item.data.count} {item.data.count === 1 ? 'block' : 'blocks'}
          </span>
        </>
      )
  }
}

function fieldTypeIcon(type: string): string {
  switch (type) {
    case 'string': return 'T'
    case 'number': return '#'
    case 'boolean': return '✓'
    case 'array': return '[]'
    case 'object': return '{}'
    default: return '·'
  }
}

function getItemKey(item: DropdownItem, index: number): string {
  switch (item.kind) {
    case 'block': return `block-${item.block.id}`
    case 'type': return `type-${item.data.type_name}`
    case 'field': return `field-${item.data.field}`
    case 'value': return `value-${item.data.value}-${index}`
  }
}
