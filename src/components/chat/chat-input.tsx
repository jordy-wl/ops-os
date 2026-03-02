'use client'

import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}

/**
 * ChatInput — textarea + send button for composing chat messages.
 * Enter submits (Shift+Enter adds a newline). Disabled while streaming.
 * Auto-resizes up to 5 lines to show longer messages before scrolling.
 *
 * @param onSend   - Called with the trimmed message string when submitted
 * @param disabled - True while a streaming response is in progress
 */
export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleSubmit() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value)
    // Auto-resize: reset then set to scrollHeight (capped at ~5 lines via CSS max-h)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  return (
    <div className="border-t bg-white px-4 py-3">
      <div className="flex items-end gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus-within:border-gray-400 focus-within:ring-1 focus-within:ring-gray-400">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'AI is responding…' : 'Ask about your operations…'}
          disabled={disabled}
          rows={1}
          aria-label="Chat message"
          className={cn(
            'flex-1 resize-none bg-transparent text-sm text-gray-900 placeholder:text-gray-400',
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
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900',
            disabled || !value.trim()
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-gray-900 text-white hover:bg-gray-700'
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
      <p className="mt-1.5 text-center text-xs text-gray-400">
        Enter to send · Shift+Enter for newline
      </p>
    </div>
  )
}
