'use client'

import { useCallback } from 'react'
import { PORTAL_FEATURE_FLAGS, type PortalFeatureKey } from '@/lib/portal-constants'
import type { PortalConfig } from '../portal-detail-view'

interface FeaturesTabProps {
  config: PortalConfig
  onUpdate: (updates: Partial<PortalConfig>) => void
}

export function FeaturesTab({ config, onUpdate }: FeaturesTabProps) {
  const handleToggle = useCallback(
    (key: PortalFeatureKey, value: boolean) => {
      onUpdate({ [key]: value })
    },
    [onUpdate]
  )

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">
          Portal Features
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Toggle which sections are available in the client portal.
        </p>
      </div>

      <div className="space-y-3">
        {PORTAL_FEATURE_FLAGS.map((flag) => {
          const enabled = config[flag.key as keyof PortalConfig] as boolean
          return (
            <div
              key={flag.key}
              className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {flag.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {flag.description}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label={`Toggle ${flag.label}`}
                onClick={() => handleToggle(flag.key, !enabled)}
                className={`
                  relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full
                  border-2 border-transparent shadow-sm transition-colors
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                  ${enabled ? 'bg-primary' : 'bg-input'}
                `}
              >
                <span
                  className={`
                    pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform
                    ${enabled ? 'translate-x-5' : 'translate-x-0'}
                  `}
                />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
