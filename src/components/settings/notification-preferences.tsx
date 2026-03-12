'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  NotificationToggles,
  type NotificationPreferences as Prefs,
} from './notification-toggles'

// ─── Constants ──────────────────────────────────────────────────────────────

const API_URL = '/api/settings/notifications'

const DEFAULT_PREFERENCES: Prefs = {
  event_types: {
    delta_alert: { in_app: true, email: false },
    task_assigned: { in_app: true, email: true },
    step_overdue: { in_app: true, email: true },
    workflow_complete: { in_app: true, email: false },
    mention: { in_app: true, email: true },
  },
  frequency: 'immediate',
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * NotificationPreferencesPanel -- client component that fetches, displays,
 * and saves notification preferences. Handles loading, error, and saved states.
 */
export function NotificationPreferencesPanel() {
  const [preferences, setPreferences] = useState<Prefs>(DEFAULT_PREFERENCES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [serverPrefs, setServerPrefs] = useState<Prefs>(DEFAULT_PREFERENCES)

  // Fetch preferences on mount
  const fetchPreferences = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(API_URL)
      if (!res.ok) {
        throw new Error('Failed to load preferences')
      }
      const json = await res.json()
      const prefs = json.data ?? DEFAULT_PREFERENCES
      setPreferences(prefs)
      setServerPrefs(prefs)
      setDirty(false)
    } catch {
      setError('Failed to load notification preferences.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPreferences()
  }, [fetchPreferences])

  // Handle preference changes from toggles
  const handleChange = useCallback(
    (updated: Prefs) => {
      setPreferences(updated)
      setSaved(false)
      // Check if different from server state
      setDirty(JSON.stringify(updated) !== JSON.stringify(serverPrefs))
    },
    [serverPrefs]
  )

  // Save preferences
  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch(API_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      })
      if (!res.ok) {
        throw new Error('Failed to save preferences')
      }
      const json = await res.json()
      const savedPrefs = json.data ?? preferences
      setServerPrefs(savedPrefs)
      setPreferences(savedPrefs)
      setDirty(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError('Failed to save notification preferences. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [preferences])

  // ─── Loading State ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div role="status" aria-label="Loading notification preferences">
        <div className="space-y-8 animate-pulse">
          {/* Skeleton for section heading */}
          <div>
            <div className="h-4 w-24 bg-muted rounded mb-4" />
            <div className="rounded-lg border divide-y divide-border">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-4 py-3 flex items-center justify-between">
                  <div className="space-y-1.5">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-3 w-56 bg-muted rounded" />
                  </div>
                  <div className="flex gap-6">
                    <div className="h-5 w-9 bg-muted rounded-full" />
                    <div className="h-5 w-9 bg-muted rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Skeleton for frequency */}
          <div>
            <div className="h-4 w-32 bg-muted rounded mb-4" />
            <div className="space-y-3">
              <div className="h-10 w-48 bg-muted rounded" />
              <div className="h-10 w-48 bg-muted rounded" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Error State ────────────────────────────────────────────────────────

  if (error && !preferences) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
        <p className="text-sm text-destructive mb-3">{error}</p>
        <button
          onClick={fetchPreferences}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Retry
        </button>
      </div>
    )
  }

  // ─── Loaded State ───────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl">
      <NotificationToggles
        preferences={preferences}
        onPreferencesChange={handleChange}
      />

      {/* Save area */}
      <div className="mt-8 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>

        {saved && (
          <span role="status" className="text-sm text-green-600 dark:text-green-400">
            Preferences saved
          </span>
        )}

        {error && !loading && (
          <span role="alert" className="text-sm text-destructive">
            {error}
          </span>
        )}
      </div>
    </div>
  )
}
