'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

interface MentionBlock {
  id: string
  name: string
  type: string
}

interface ChatInputProps {
  onSend: (message: string, mentionedBlockIds?: string[]) => void
  disabled?: boolean
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 300
const MENTION_TRIGGER = '@'
const MAX_RESULTS = 5

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Find the @mention query at the current cursor position.
 * Returns the query string (text after @) and the start index of the @,
 * or null if the cursor is not inside an @mention.
 */
function getMentionQuery(text: string, cursorPos: number): { query: string; startIndex: number } | null {
  // Walk backwards from cursor to find the nearest unescaped @
  const before = text.slice(0, cursorPos)
  const atIndex = before.lastIndexOf(MENTION_TRIGGER)
  if (atIndex === -1) return null

  // The @ must be at the start of input or preceded by a space/newline
  if (atIndex > 0 && !/\s/.test(before[atIndex - 1])) return null

  const query = before.slice(atIndex + 1)

  // If the query contains a space it means the mention was already completed or abandoned
  // Allow spaces in block names during search (user might type "Thornfield Cap")
  // But if there are two consecutive spaces, the mention is abandoned
  if (/\s{2,}/.test(query)) return null

  return { query, startIndex: atIndex }
}

/**
 * Maps a block type key to a short display label for the badge.
 */
function blockTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    client: 'Client',
    deal: 'Deal',
    project: 'Project',
    contact: 'Contact',
    contract: 'Contract',
    workflow_template: 'Template',
    workflow_instance: 'Instance',
    task_queue_item: 'Task',
  }
  return labels[type] ?? type
}

/**
 * Maps a block type key to a Tailwind badge color class.
 */
function blockTypeBadgeClass(type: string): string {
  const colors: Record<string, string> = {
    client: 'bg-blue-100 text-blue-700',
    deal: 'bg-green-100 text-green-700',
    project: 'bg-purple-100 text-purple-700',
    contact: 'bg-amber-100 text-amber-700',
    contract: 'bg-rose-100 text-rose-700',
    workflow_template: 'bg-indigo-100 text-indigo-700',
    workflow_instance: 'bg-cyan-100 text-cyan-700',
    task_queue_item: 'bg-orange-100 text-orange-700',
  }
  return colors[type] ?? 'bg-gray-100 text-gray-700'
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * ChatInput -- textarea + send button for composing chat messages with
 * @mention block autocomplete support.
 *
 * When the user types `@`, a dropdown appears above the input showing
 * matching blocks from `GET /api/blocks?q=<query>&limit=5`. Keyboard
 * navigation (ArrowUp/ArrowDown/Enter/Escape) and click selection are
 * both supported. Selected blocks are tracked by ID and passed to onSend.
 *
 * @param onSend   - Called with the trimmed message and optional array of mentioned block IDs
 * @param disabled - True while a streaming response is in progress
 */
export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [value, setValue] = useState('')
  const [mentionedBlocks, setMentionedBlocks] = useState<MentionBlock[]>([])

  // Mention dropdown state
  const [showMention, setShowMention] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStartIndex, setMentionStartIndex] = useState(0)
  const [mentionResults, setMentionResults] = useState<MentionBlock[]>([])
  const [mentionLoading, setMentionLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLUListElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // ── Debounced block search ────────────────────────────────────────────

  const searchBlocks = useCallback(async (query: string) => {
    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort()
    }

    if (!query.trim()) {
      setMentionResults([])
      setMentionLoading(false)
      return
    }

    setMentionLoading(true)
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const params = new URLSearchParams({ q: query, limit: String(MAX_RESULTS) })
      const res = await fetch(`/api/blocks?${params.toString()}`, {
        signal: controller.signal,
      })

      if (!res.ok) {
        setMentionResults([])
        return
      }

      const json = await res.json()
      const blocks: MentionBlock[] = (json.data ?? []).map(
        (b: { id: string; name: string; type: string }) => ({
          id: b.id,
          name: b.name,
          type: b.type,
        })
      )

      setMentionResults(blocks)
      setActiveIndex(0)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setMentionResults([])
    } finally {
      if (!controller.signal.aborted) {
        setMentionLoading(false)
      }
    }
  }, [])

  const debouncedSearch = useCallback(
    (query: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      debounceRef.current = setTimeout(() => {
        searchBlocks(query)
      }, DEBOUNCE_MS)
    },
    [searchBlocks]
  )

  // Cleanup debounce and abort on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  // ── Click outside to close dropdown ───────────────────────────────────

  useEffect(() => {
    if (!showMention) return

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        textareaRef.current &&
        !textareaRef.current.contains(target)
      ) {
        closeMention()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMention])

  // ── Mention helpers ───────────────────────────────────────────────────

  function closeMention() {
    setShowMention(false)
    setMentionQuery('')
    setMentionResults([])
    setMentionLoading(false)
    setActiveIndex(0)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (abortRef.current) abortRef.current.abort()
  }

  function selectBlock(block: MentionBlock) {
    // Replace the @query text with @BlockName
    const before = value.slice(0, mentionStartIndex)
    const after = value.slice(mentionStartIndex + 1 + mentionQuery.length)
    const insertText = `@${block.name} `
    const newValue = before + insertText + after

    setValue(newValue)

    // Track the mentioned block (avoid duplicates)
    setMentionedBlocks((prev) => {
      if (prev.some((b) => b.id === block.id)) return prev
      return [...prev, block]
    })

    closeMention()

    // Restore focus and set cursor position after the inserted mention
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        const newCursorPos = before.length + insertText.length
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
      }
    })
  }

  // ── Submission ────────────────────────────────────────────────────────

  function handleSubmit() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return

    const blockIds = mentionedBlocks.length > 0
      ? mentionedBlocks.map((b) => b.id)
      : undefined

    onSend(trimmed, blockIds)
    setValue('')
    setMentionedBlocks([])
    closeMention()

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  // ── Keyboard handling ─────────────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // When mention dropdown is open, intercept navigation keys
    if (showMention && mentionResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((prev) => (prev + 1) % mentionResults.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((prev) => (prev - 1 + mentionResults.length) % mentionResults.length)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        selectBlock(mentionResults[activeIndex])
        return
      }
    }

    if (showMention && e.key === 'Escape') {
      e.preventDefault()
      closeMention()
      return
    }

    // Normal Enter = submit (Shift+Enter = newline)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // ── Input change + mention detection ──────────────────────────────────

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newValue = e.target.value
    setValue(newValue)

    // Auto-resize: reset then set to scrollHeight (capped at ~5 lines via CSS max-h)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`

    // Detect @mention
    const cursorPos = el.selectionStart ?? newValue.length
    const mention = getMentionQuery(newValue, cursorPos)

    if (mention) {
      setShowMention(true)
      setMentionQuery(mention.query)
      setMentionStartIndex(mention.startIndex)
      debouncedSearch(mention.query)
    } else {
      if (showMention) closeMention()
    }
  }

  // ── Scroll active item into view ──────────────────────────────────────

  useEffect(() => {
    if (!showMention || !dropdownRef.current) return
    const activeEl = dropdownRef.current.children[activeIndex] as HTMLElement | undefined
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex, showMention])

  // ── Render ────────────────────────────────────────────────────────────

  const showDropdown = showMention && (mentionLoading || mentionResults.length > 0 || mentionQuery.trim().length > 0)

  return (
    <div className="relative border-t bg-background px-4 py-3">
      {/* Mention autocomplete dropdown — positioned above the input */}
      {showDropdown && (
        <div
          className="absolute bottom-full left-4 right-4 mb-1 rounded-lg border border-border bg-background shadow-lg z-10"
          role="dialog"
          aria-label="Block mention suggestions"
        >
          {mentionLoading && mentionResults.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground" role="status" aria-label="Searching blocks">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Searching blocks...</span>
            </div>
          ) : mentionResults.length === 0 && mentionQuery.trim().length > 0 && !mentionLoading ? (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              No blocks found
            </div>
          ) : (
            <ul
              ref={dropdownRef}
              role="listbox"
              aria-label="Block suggestions"
              className="max-h-48 overflow-y-auto py-1"
            >
              {mentionResults.map((block, index) => (
                <li
                  key={block.id}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors',
                    index === activeIndex
                      ? 'bg-muted text-foreground'
                      : 'text-foreground hover:bg-muted'
                  )}
                  onMouseDown={(e) => {
                    // Use mousedown (not click) to fire before blur
                    e.preventDefault()
                    selectBlock(block)
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="truncate font-medium">{block.name}</span>
                  <span
                    className={cn(
                      'ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none',
                      blockTypeBadgeClass(block.type)
                    )}
                  >
                    {blockTypeLabel(block.type)}
                  </span>
                </li>
              ))}
              {mentionLoading && mentionResults.length > 0 && (
                <li className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground" role="status" aria-label="Updating results">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  <span>Updating...</span>
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      <div className="flex items-end gap-2 rounded-xl border border-border bg-muted px-3 py-2 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'AI is responding...' : 'Ask about your operations... (@ to mention a block)'}
          disabled={disabled}
          rows={1}
          aria-label="Chat message"
          aria-expanded={showDropdown}
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
          {/* Send arrow icon */}
          <svg
            viewBox="0 0 16 16"
            fill="currentColor"
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <path d="M1.5 1.5a.5.5 0 0 1 .5-.5h12a.5.5 0 0 1 .354.854l-6 6a.5.5 0 0 1-.708 0l-6-6A.5.5 0 0 1 1.5 1.5zm.707.5L8 7.793 13.793 2H2.207zM1.5 6a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1H2a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1H2a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1H2a.5.5 0 0 1-.5-.5z" />
          </svg>
        </button>
      </div>
      <p className="mt-1.5 text-center text-xs text-muted-foreground">
        Enter to send · Shift+Enter for newline · @ to mention a block
      </p>
    </div>
  )
}
