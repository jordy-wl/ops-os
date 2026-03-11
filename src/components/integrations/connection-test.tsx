'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface ConnectionTestProps {
  connectorId: string
  onSuccess?: () => void
}

export function ConnectionTest({ connectorId, onSuccess }: ConnectionTestProps) {
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleTest() {
    setStatus('testing')
    setError(null)

    try {
      const res = await fetch(`/api/integrations/${connectorId}/test`, { method: 'POST' })
      if (res.ok) {
        setStatus('success')
        onSuccess?.()
      } else {
        const json = await res.json().catch(() => ({}))
        setStatus('error')
        setError(json?.error?.message ?? 'Connection test failed')
      }
    } catch {
      setStatus('error')
      setError('Network error')
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleTest}
        disabled={status === 'testing'}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium',
          'border border-border text-foreground hover:bg-muted',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {status === 'testing' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : null}
        Test Connection
      </button>

      {status === 'success' && (
        <span className="inline-flex items-center gap-1 text-sm text-green-700" role="status">
          <CheckCircle className="h-4 w-4" aria-hidden="true" />
          Connected
        </span>
      )}
      {status === 'error' && (
        <span className="inline-flex items-center gap-1 text-sm text-red-700" role="alert">
          <XCircle className="h-4 w-4" aria-hidden="true" />
          {error ?? 'Failed'}
        </span>
      )}
    </div>
  )
}
