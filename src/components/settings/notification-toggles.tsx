'use client'

import { useState, useCallback } from 'react'

// ─── Types ──────────────────────────────────────────────────────────────────

export type EventTypeKey =
  | 'delta_alert'
  | 'task_assigned'
  | 'step_overdue'
  | 'workflow_complete'
  | 'mention'

export type Frequency = 'immediate' | 'daily_digest'

export interface ChannelConfig {
  in_app: boolean
  email: boolean
}

export interface NotificationPreferences {
  event_types: Record<EventTypeKey, ChannelConfig>
  frequency: Frequency
}

interface NotificationTogglesProps {
  preferences: NotificationPreferences
  onPreferencesChange: (prefs: NotificationPreferences) => void
}

// ─── Constants ──────────────────────────────────────────────────────────────

const EVENT_TYPE_LABELS: Record<EventTypeKey, string> = {
  delta_alert: 'Delta Alerts',
  task_assigned: 'Task Assigned',
  step_overdue: 'Step Overdue',
  workflow_complete: 'Workflow Complete',
  mention: 'Mentions',
}

const EVENT_TYPE_DESCRIPTIONS: Record<EventTypeKey, string> = {
  delta_alert: 'Alerts when workflow health drops below thresholds',
  task_assigned: 'When a task is assigned to you',
  step_overdue: 'When a workflow step passes its due date',
  workflow_complete: 'When a workflow instance finishes',
  mention: 'When someone mentions you in a comment or chat',
}

const EVENT_TYPE_ORDER: EventTypeKey[] = [
  'delta_alert',
  'task_assigned',
  'step_overdue',
  'workflow_complete',
  'mention',
]

// ─── Component ──────────────────────────────────────────────────────────────

export function NotificationToggles({
  preferences,
  onPreferencesChange,
}: NotificationTogglesProps) {
  const handleEmailToggle = useCallback(
    (eventType: EventTypeKey) => {
      const updated: NotificationPreferences = {
        ...preferences,
        event_types: {
          ...preferences.event_types,
          [eventType]: {
            ...preferences.event_types[eventType],
            email: !preferences.event_types[eventType].email,
          },
        },
      }
      onPreferencesChange(updated)
    },
    [preferences, onPreferencesChange]
  )

  const handleFrequencyChange = useCallback(
    (frequency: Frequency) => {
      onPreferencesChange({
        ...preferences,
        frequency,
      })
    },
    [preferences, onPreferencesChange]
  )

  return (
    <div className="space-y-8">
      {/* Event type toggles grid */}
      <section>
        <h3 className="text-sm font-medium text-foreground mb-4">
          Event Types
        </h3>

        {/* Table header */}
        <div className="hidden sm:grid sm:grid-cols-[1fr_80px_80px] gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <span>Event</span>
          <span className="text-center">In-App</span>
          <span className="text-center">Email</span>
        </div>

        {/* Event type rows */}
        <div className="divide-y divide-border rounded-lg border">
          {EVENT_TYPE_ORDER.map((eventType) => {
            const config = preferences.event_types[eventType]
            return (
              <div
                key={eventType}
                className="grid grid-cols-1 sm:grid-cols-[1fr_80px_80px] gap-2 sm:gap-4 items-center px-4 py-3"
              >
                {/* Label and description */}
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {EVENT_TYPE_LABELS[eventType]}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {EVENT_TYPE_DESCRIPTIONS[eventType]}
                  </p>
                </div>

                {/* Mobile channel labels + toggles row */}
                <div className="flex items-center justify-between sm:justify-center sm:contents">
                  {/* In-App toggle — always enabled, not toggleable */}
                  <div className="flex items-center gap-2 sm:block sm:text-center">
                    <span className="text-xs text-muted-foreground sm:hidden">
                      In-App
                    </span>
                    <div
                      role="switch"
                      aria-checked={config.in_app}
                      aria-label={`In-app notifications for ${EVENT_TYPE_LABELS[eventType]}`}
                      tabIndex={0}
                      className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-not-allowed rounded-full bg-primary opacity-60 transition-colors"
                    >
                      <span className="pointer-events-none inline-block h-4 w-4 translate-x-4 translate-y-0.5 transform rounded-full bg-white shadow transition-transform" />
                    </div>
                  </div>

                  {/* Email toggle — user-toggleable */}
                  <div className="flex items-center gap-2 sm:block sm:text-center">
                    <span className="text-xs text-muted-foreground sm:hidden">
                      Email
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={config.email}
                      aria-label={`Email notifications for ${EVENT_TYPE_LABELS[eventType]}`}
                      onClick={() => handleEmailToggle(eventType)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                        config.email ? 'bg-primary' : 'bg-input'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          config.email ? 'translate-x-4' : 'translate-x-0'
                        } translate-y-0`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Frequency selector */}
      <section>
        <h3 className="text-sm font-medium text-foreground mb-1">
          Email Frequency
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Choose how often email notifications are delivered.
        </p>

        <fieldset>
          <legend className="sr-only">Email notification frequency</legend>
          <div className="space-y-3">
            <label
              className="flex items-start gap-3 cursor-pointer"
              htmlFor="freq-immediate"
            >
              <input
                id="freq-immediate"
                type="radio"
                name="frequency"
                value="immediate"
                checked={preferences.frequency === 'immediate'}
                onChange={() => handleFrequencyChange('immediate')}
                className="mt-0.5 h-4 w-4 border-input text-primary focus:ring-ring"
              />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Immediate
                </p>
                <p className="text-xs text-muted-foreground">
                  Receive emails as soon as events occur.
                </p>
              </div>
            </label>

            <label
              className="flex items-start gap-3 cursor-pointer"
              htmlFor="freq-daily-digest"
            >
              <input
                id="freq-daily-digest"
                type="radio"
                name="frequency"
                value="daily_digest"
                checked={preferences.frequency === 'daily_digest'}
                onChange={() => handleFrequencyChange('daily_digest')}
                className="mt-0.5 h-4 w-4 border-input text-primary focus:ring-ring"
              />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Daily Digest
                </p>
                <p className="text-xs text-muted-foreground">
                  Receive a single daily email summarising all events.
                </p>
              </div>
            </label>
          </div>
        </fieldset>
      </section>
    </div>
  )
}
