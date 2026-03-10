'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Chrome, CheckCircle, AlertCircle, Loader2, Unplug } from 'lucide-react'

interface GoogleConnectProps {
  connectorId: string | null
  connectorStatus: 'active' | 'paused' | 'error' | null
  connectedBy: string | null
  connectedAt: string | null
}

export function GoogleConnect({ connectorId, connectorStatus, connectedBy, connectedAt }: GoogleConnectProps) {
  const [loading, setLoading] = useState(false)

  const handleConnect = useCallback(async () => {
    setLoading(true)
    try {
      // Redirect to the Google OAuth initiation endpoint
      window.location.href = '/api/auth/google'
    } catch {
      setLoading(false)
    }
  }, [])

  const isConnected = connectorId && connectorStatus === 'active'

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <div className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
          isConnected ? 'bg-green-50' : 'bg-gray-100'
        )}>
          <Chrome className={cn('h-5 w-5', isConnected ? 'text-green-600' : 'text-gray-500')} aria-hidden="true" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">Google Workspace</h3>
            {isConnected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                <CheckCircle className="h-3 w-3" aria-hidden="true" />
                Connected
              </span>
            )}
            {connectorStatus === 'error' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                <AlertCircle className="h-3 w-3" aria-hidden="true" />
                Error
              </span>
            )}
          </div>

          <p className="mt-1 text-xs text-gray-500">
            {isConnected
              ? 'Gmail, Calendar, and Drive are connected.'
              : 'Connect to send emails, book meetings, and store documents.'}
          </p>

          {isConnected && connectedAt && (
            <p className="mt-1 text-xs text-gray-400">
              Connected <time dateTime={connectedAt}>{new Date(connectedAt).toLocaleDateString()}</time>
              {connectedBy && ` by ${connectedBy}`}
            </p>
          )}

          <div className="mt-3 flex items-center gap-2">
            {isConnected ? (
              <>
                <span className="text-xs text-gray-500">Scopes: Gmail, Calendar, Drive</span>
                <button
                  type="button"
                  onClick={handleConnect}
                  className={cn(
                    'ml-auto inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium',
                    'border border-gray-200 text-gray-600 hover:bg-gray-50',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900'
                  )}
                >
                  <Unplug className="h-3 w-3" aria-hidden="true" />
                  Reconnect
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleConnect}
                disabled={loading}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium',
                  'bg-gray-900 text-white hover:bg-gray-700',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Chrome className="h-4 w-4" aria-hidden="true" />
                    Connect Google
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
