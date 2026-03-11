'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

const PROVIDERS = [
  { value: 'webhook', label: 'Webhook' },
  { value: 'custom_api', label: 'Custom API' },
  { value: 'salesforce', label: 'Salesforce' },
  { value: 'xero', label: 'Xero' },
]

const DIRECTIONS = [
  { value: 'inbound', label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
  { value: 'bidirectional', label: 'Bidirectional' },
]

interface Props {
  onClose: () => void
  onCreated: () => void
}

export function CreateIntegrationModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [provider, setProvider] = useState('webhook')
  const [direction, setDirection] = useState('inbound')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), provider, direction }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json?.error?.message ?? 'Failed to create connector')
        return
      }

      // Show webhook URL before closing for inbound connectors
      if (json.data?.webhook_url) {
        setWebhookUrl(`${window.location.origin}${json.data.webhook_url}`)
      } else {
        onCreated()
        onClose()
      }
    } catch {
      setError('Network error - please try again')
    } finally {
      setSubmitting(false)
    }
  }

  function handleDone() {
    onCreated()
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-connector-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/40" onClick={webhookUrl ? handleDone : onClose} aria-hidden="true" />

      <div className="relative w-full max-w-sm rounded-lg bg-background p-6 shadow-lg max-h-[85vh] overflow-y-auto">
        <h2 id="create-connector-title" className="text-lg font-semibold text-foreground mb-4">
          {webhookUrl ? 'Connector Created' : 'New Connector'}
        </h2>

        {/* Success state — show webhook URL */}
        {webhookUrl && (
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Your webhook URL is ready. Copy it and configure your external system to send POST requests here.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-1">Webhook URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="flex-1 rounded-md border border-border px-3 py-2 text-xs font-mono bg-muted"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={() => navigator.clipboard.writeText(webhookUrl)}
                  className="shrink-0 px-3 py-2 rounded-md text-sm font-medium border border-border text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Copy
                </button>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleDone}
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground',
                  'hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                )}
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Create form */}
        {!webhookUrl && (
          <form onSubmit={handleSubmit} noValidate>
            <label htmlFor="connector-name" className="block text-sm font-medium text-foreground mb-1">
              Name
            </label>
            <input
              ref={nameRef}
              id="connector-name"
              type="text"
              required
              maxLength={255}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. CRM Webhook"
              className="mb-4 w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />

            <label htmlFor="connector-provider" className="block text-sm font-medium text-foreground mb-1">
              Provider
            </label>
            <select
              id="connector-provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="mb-4 w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>

            <label htmlFor="connector-direction" className="block text-sm font-medium text-foreground mb-1">
              Direction
            </label>
            <select
              id="connector-direction"
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              className="mb-4 w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
            >
              {DIRECTIONS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>

            {error && (
              <p role="alert" className="mb-4 text-xs text-red-600">{error}</p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium border border-border text-foreground',
                  'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                )}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !name.trim()}
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground',
                  'hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {submitting ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
