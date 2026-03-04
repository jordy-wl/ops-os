'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface StartOnboardingButtonProps {
  clientName: string
  jurisdiction?: string | null
}

/**
 * StartOnboardingButton — triggers the onboarding workflow for a client block.
 *
 * Calls POST /api/actions/onboarding.start, shows loading state,
 * and redirects to /workflows on success.
 *
 * Only rendered on client-type blocks (parent page decides visibility).
 */
export function StartOnboardingButton({
  clientName,
  jurisdiction,
}: StartOnboardingButtonProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleClick() {
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/actions/onboarding.start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName,
          jurisdiction: jurisdiction ?? undefined,
        }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json?.error?.message ?? 'Failed to start onboarding')
        return
      }

      setSuccess(true)
      // Brief delay so user sees the success message before redirect
      setTimeout(() => router.push('/workflows'), 800)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={submitting || success}
        aria-disabled={submitting || success}
        className={cn(
          'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
          'bg-gray-900 text-white hover:bg-gray-700',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {submitting && (
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
            aria-hidden="true"
          />
        )}
        {submitting
          ? 'Starting…'
          : success
            ? 'Onboarding started'
            : 'Start Client Onboarding'}
      </button>

      {success && (
        <p role="status" className="text-sm text-green-700">
          Onboarding workflow started — redirecting to workflows…
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
