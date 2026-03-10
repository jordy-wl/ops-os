'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  Mail,
  CalendarPlus,
  FileText,
  Play,
  ChevronDown,
  X,
  Loader2,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ActionDefinition {
  key: string
  label: string
  icon: React.ReactNode
  fields: FieldDef[]
  requiresGoogle?: boolean
}

interface FieldDef {
  name: string
  label: string
  type: 'text' | 'email' | 'textarea' | 'datetime-local'
  required?: boolean
  placeholder?: string
}

interface ActionMenuProps {
  blockId: string
  blockName: string
  blockType: string
  googleConnectorId: string | null
}

// ─── Action Definitions ─────────────────────────────────────────────────────

const ACTIONS: ActionDefinition[] = [
  {
    key: 'email.send',
    label: 'Send Email',
    icon: <Mail className="h-4 w-4" aria-hidden="true" />,
    requiresGoogle: true,
    fields: [
      { name: 'to', label: 'To', type: 'email', required: true, placeholder: 'recipient@example.com' },
      { name: 'subject', label: 'Subject', type: 'text', required: true, placeholder: 'Email subject' },
      { name: 'body', label: 'Body', type: 'textarea', required: true, placeholder: 'Email body (HTML supported)' },
    ],
  },
  {
    key: 'meeting.book',
    label: 'Book Meeting',
    icon: <CalendarPlus className="h-4 w-4" aria-hidden="true" />,
    requiresGoogle: true,
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Meeting title' },
      { name: 'start', label: 'Start', type: 'datetime-local', required: true },
      { name: 'end', label: 'End', type: 'datetime-local', required: true },
      { name: 'attendees', label: 'Attendees', type: 'text', placeholder: 'Comma-separated emails' },
      { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Meeting description' },
    ],
  },
  {
    key: 'document.generate',
    label: 'Generate Document',
    icon: <FileText className="h-4 w-4" aria-hidden="true" />,
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Document title' },
      { name: 'prompt', label: 'Instructions', type: 'textarea', required: true, placeholder: 'Describe the document to generate...' },
    ],
  },
]

// ─── Component ──────────────────────────────────────────────────────────────

export function ActionMenu({ blockId, blockName, blockType, googleConnectorId }: ActionMenuProps) {
  const [open, setOpen] = useState(false)
  const [activeAction, setActiveAction] = useState<ActionDefinition | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (activeAction) {
          setActiveAction(null)
          setFormData({})
          setResult(null)
        } else {
          setOpen(false)
        }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [activeAction])

  const handleSelectAction = useCallback((action: ActionDefinition) => {
    if (action.requiresGoogle && !googleConnectorId) {
      setResult({ ok: false, message: 'Connect Google first in Settings > Integrations' })
      return
    }
    setActiveAction(action)
    setFormData({})
    setResult(null)
    setOpen(false)
  }, [googleConnectorId])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeAction) return

    setSubmitting(true)
    setResult(null)

    try {
      // Build the payload based on action type
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: Record<string, any> = { ...formData, block_id: blockId }

      if (activeAction.requiresGoogle && googleConnectorId) {
        payload.connector_id = googleConnectorId
      }

      // Handle attendees as array
      if (payload.attendees && typeof payload.attendees === 'string') {
        payload.attendees = payload.attendees.split(',').map((e: string) => e.trim()).filter(Boolean)
      }

      const res = await fetch(`/api/actions/${activeAction.key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()

      if (!res.ok) {
        setResult({ ok: false, message: json?.error?.message ?? 'Action failed' })
      } else {
        setResult({ ok: true, message: `${activeAction.label} completed successfully` })
        setTimeout(() => {
          setActiveAction(null)
          setFormData({})
          setResult(null)
        }, 2000)
      }
    } catch {
      setResult({ ok: false, message: 'Network error — please try again' })
    } finally {
      setSubmitting(false)
    }
  }, [activeAction, formData, blockId, googleConnectorId])

  const availableActions = ACTIONS.filter((a) => {
    // Document generation is available for Sprint 9 — show but note it's coming
    if (a.key === 'document.generate') return true
    return true
  })

  return (
    <div ref={menuRef} className="relative inline-block">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium',
          'bg-gray-900 text-white hover:bg-gray-700',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900'
        )}
      >
        <Play className="h-4 w-4" aria-hidden="true" />
        Actions
        <ChevronDown className="h-3 w-3" aria-hidden="true" />
      </button>

      {/* Dropdown menu */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border bg-white py-1 shadow-lg"
        >
          {availableActions.map((action) => {
            const disabled = action.requiresGoogle && !googleConnectorId
            return (
              <button
                key={action.key}
                role="menuitem"
                disabled={disabled}
                onClick={() => handleSelectAction(action)}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm',
                  disabled
                    ? 'cursor-not-allowed text-gray-400'
                    : 'text-gray-700 hover:bg-gray-50'
                )}
              >
                {action.icon}
                <span>{action.label}</span>
                {disabled && (
                  <span className="ml-auto text-xs text-gray-400">No Google</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Action modal */}
      {activeAction && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="action-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => { setActiveAction(null); setFormData({}); setResult(null) }}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 id="action-modal-title" className="text-lg font-semibold text-gray-900">
                {activeAction.label}
              </h2>
              <button
                type="button"
                onClick={() => { setActiveAction(null); setFormData({}); setResult(null) }}
                aria-label="Close"
                className="rounded-md p-1 text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-4">
              For <strong>{blockName}</strong> ({blockType})
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {activeAction.fields.map((field) => (
                <div key={field.name}>
                  <label htmlFor={`action-${field.name}`} className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      id={`action-${field.name}`}
                      value={formData[field.name] ?? ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, [field.name]: e.target.value }))}
                      placeholder={field.placeholder}
                      required={field.required}
                      rows={3}
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  ) : (
                    <input
                      id={`action-${field.name}`}
                      type={field.type}
                      value={formData[field.name] ?? ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, [field.name]: e.target.value }))}
                      placeholder={field.placeholder}
                      required={field.required}
                      className="w-full h-9 rounded-md border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  )}
                </div>
              ))}

              {result && (
                <p role="alert" className={cn('text-sm', result.ok ? 'text-green-600' : 'text-red-600')}>
                  {result.message}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className={cn(
                  'w-full rounded-md px-4 py-2 text-sm font-medium',
                  'bg-gray-900 text-white hover:bg-gray-700',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Running...
                  </span>
                ) : (
                  activeAction.label
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
