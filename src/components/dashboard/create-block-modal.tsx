'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

const BLOCK_TYPES = ['client', 'deal', 'project', 'contract', 'contact'] as const
type BlockType = (typeof BLOCK_TYPES)[number]

interface CreateBlockModalProps {
  onClose: () => void
  onCreated: () => void
}

/**
 * CreateBlockModal — modal form for creating a new block.
 * Calls POST /api/blocks with type + name.
 * On success: closes modal and calls onCreated so the dashboard refreshes.
 *
 * @param onClose   - Called when the modal should close (cancel or backdrop click)
 * @param onCreated - Called after a block is successfully created
 */
export function CreateBlockModal({ onClose, onCreated }: CreateBlockModalProps) {
  const [type, setType] = useState<BlockType>('client')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  // Focus the name input on open
  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, name: trimmed }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json?.error?.message ?? 'Failed to create block')
        return
      }

      onCreated()
      onClose()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-block-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div className="relative w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
        <h2 id="create-block-title" className="text-lg font-semibold text-gray-900 mb-4">
          Create Block
        </h2>

        <form onSubmit={handleSubmit} noValidate>
          {/* Block type */}
          <label
            htmlFor="block-type"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Type
          </label>
          <select
            id="block-type"
            value={type}
            onChange={(e) => setType(e.target.value as BlockType)}
            className="mb-4 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 capitalize"
          >
            {BLOCK_TYPES.map((t) => (
              <option key={t} value={t} className="capitalize">
                {t}
              </option>
            ))}
          </select>

          {/* Block name */}
          <label
            htmlFor="block-name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Name
          </label>
          <input
            ref={nameRef}
            id="block-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Thornfield Capital Partners"
            maxLength={255}
            required
            className="mb-4 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />

          {/* Error */}
          {error && (
            <p role="alert" className="mb-4 text-xs text-red-600">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium border border-gray-200 text-gray-700',
                'hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900'
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium bg-gray-900 text-white',
                'hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {submitting ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
