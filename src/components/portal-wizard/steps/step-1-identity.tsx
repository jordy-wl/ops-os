'use client'

import { Globe } from 'lucide-react'
import { PORTAL_FEATURE_FLAGS } from '@/lib/portal-constants'
import { AiSuggestBar } from '../ai-assist/ai-suggest-bar'

interface Step1IdentityProps {
  name: string
  onNameChange: (v: string) => void
  displayName: string
  onDisplayNameChange: (v: string) => void
  logoUrl: string
  onLogoUrlChange: (v: string) => void
  primaryColor: string
  onPrimaryColorChange: (v: string) => void
  featureState: Record<string, boolean>
  onFeatureToggle: (key: string, enabled: boolean) => void
}

export function Step1Identity({
  name,
  onNameChange,
  displayName,
  onDisplayNameChange,
  logoUrl,
  onLogoUrlChange,
  primaryColor,
  onPrimaryColorChange,
  featureState,
  onFeatureToggle,
}: Step1IdentityProps) {
  return (
    <div className="space-y-6">
      {/* Portal Name */}
      <div>
        <label
          htmlFor="portal-name"
          className="block text-sm font-medium text-foreground mb-1.5"
        >
          Portal Name <span className="text-destructive">*</span>
        </label>
        <input
          id="portal-name"
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. Standard Client Portal"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          autoFocus
        />
      </div>

      <AiSuggestBar
        stepId="identity"
        suggestions={[]}
        disabled
        placeholderText="AI will suggest features based on client type"
      />

      {/* Feature Toggles */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">Features</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Choose which sections are available in the portal.
        </p>
        <div className="space-y-3">
          {PORTAL_FEATURE_FLAGS.map((flag) => {
            const enabled = featureState[flag.key] ?? true
            return (
              <div
                key={flag.key}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{flag.label}</p>
                  <p className="text-xs text-muted-foreground">{flag.description}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={`Toggle ${flag.label}`}
                  onClick={() => onFeatureToggle(flag.key, !enabled)}
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

      {/* Branding */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">Branding</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Customize the look of the client-facing portal.
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="brand-display-name" className="block text-sm font-medium text-foreground mb-1.5">
              Display Name
            </label>
            <input
              id="brand-display-name"
              type="text"
              value={displayName}
              onChange={(e) => onDisplayNameChange(e.target.value)}
              placeholder="Defaults to portal name"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label htmlFor="brand-logo-url" className="block text-sm font-medium text-foreground mb-1.5">
              Logo URL
            </label>
            <input
              id="brand-logo-url"
              type="url"
              value={logoUrl}
              onChange={(e) => onLogoUrlChange(e.target.value)}
              placeholder="https://example.com/logo.png"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label htmlFor="brand-primary-color" className="block text-sm font-medium text-foreground mb-1.5">
              Primary Color
            </label>
            <div className="flex items-center gap-3">
              <input
                id="brand-primary-color"
                type="color"
                value={primaryColor}
                onChange={(e) => onPrimaryColorChange(e.target.value)}
                className="h-10 w-14 rounded-md border border-input cursor-pointer"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => onPrimaryColorChange(e.target.value)}
                className="w-28 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Branding preview */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Preview</p>
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-3" style={{ backgroundColor: primaryColor }}>
                {logoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="h-6 w-auto"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                ) : (
                  <Globe className="w-5 h-5 text-white" />
                )}
                <span className="text-sm font-semibold text-white">
                  {displayName || name || 'Portal'}
                </span>
              </div>
              <div className="px-4 py-6 bg-gray-50 dark:bg-muted/20 text-center">
                <p className="text-xs text-gray-400">Portal content area</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
