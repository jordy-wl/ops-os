'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const MESSAGES: Record<string, { text: string; variant: 'success' | 'error' | 'warning' }> = {
  connected: { text: 'Google Workspace connected successfully.', variant: 'success' },
  denied: { text: 'Google authorization was denied. Please try again if you want to connect.', variant: 'warning' },
  no_refresh: {
    text: 'Google did not return a refresh token. Try disconnecting the app in your Google Account permissions, then reconnect.',
    variant: 'error',
  },
  error: { text: 'Something went wrong connecting Google. Please try again.', variant: 'error' },
}

const VARIANT_STYLES: Record<string, string> = {
  success: 'bg-success/10 border-success/30 text-success',
  error: 'bg-destructive/10 border-destructive/30 text-destructive',
  warning: 'bg-warning/10 border-warning/30 text-warning',
}

interface Props {
  result: string
}

export function OAuthResultBanner({ result }: Props) {
  const [visible, setVisible] = useState(true)
  const router = useRouter()
  const message = MESSAGES[result]

  // Auto-dismiss after 8 seconds and clean the URL
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      router.replace('/integrations', { scroll: false })
    }, 8000)
    return () => clearTimeout(timer)
  }, [router])

  if (!visible || !message) return null

  return (
    <div
      role="alert"
      className={cn(
        'mb-4 flex items-center justify-between rounded-md border px-4 py-3 text-sm font-medium',
        VARIANT_STYLES[message.variant]
      )}
    >
      <span>{message.text}</span>
      <button
        onClick={() => {
          setVisible(false)
          router.replace('/integrations', { scroll: false })
        }}
        className="ml-4 shrink-0 text-current opacity-60 hover:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        aria-label="Dismiss"
      >
        &times;
      </button>
    </div>
  )
}
