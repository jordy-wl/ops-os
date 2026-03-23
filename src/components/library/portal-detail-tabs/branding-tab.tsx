'use client'

import { useState, useCallback } from 'react'
import { Globe } from 'lucide-react'
import type { PortalConfig } from '../portal-detail-view'

interface BrandingTabProps {
  config: PortalConfig
  onUpdate: (updates: Partial<PortalConfig>) => void
}

export function BrandingTab({ config, onUpdate }: BrandingTabProps) {
  const overrides = (config.branding_overrides ?? {}) as Record<
    string,
    unknown
  >
  const [displayName, setDisplayName] = useState(
    (overrides.display_name as string) ?? ''
  )
  const [logoUrl, setLogoUrl] = useState(
    (overrides.logo_url as string) ?? ''
  )
  const [primaryColor, setPrimaryColor] = useState(
    (overrides.primary_color as string) ?? '#2563eb'
  )

  const saveBranding = useCallback(
    (updates: Record<string, unknown>) => {
      const merged = { ...overrides, ...updates }
      onUpdate({ branding_overrides: merged })
    },
    [overrides, onUpdate]
  )

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">
          Portal Branding
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Customize the look of the client-facing portal.
        </p>
      </div>

      {/* Fields */}
      <div className="space-y-4">
        <div>
          <label
            htmlFor="brand-name"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            Display Name
          </label>
          <input
            id="brand-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onBlur={() => saveBranding({ display_name: displayName || undefined })}
            placeholder="Defaults to portal name"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label
            htmlFor="brand-logo"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            Logo URL
          </label>
          <input
            id="brand-logo"
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            onBlur={() => saveBranding({ logo_url: logoUrl || undefined })}
            placeholder="https://example.com/logo.png"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label
            htmlFor="brand-color"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            Primary Color
          </label>
          <div className="flex items-center gap-3">
            <input
              id="brand-color"
              type="color"
              value={primaryColor}
              onChange={(e) => {
                setPrimaryColor(e.target.value)
                saveBranding({ primary_color: e.target.value })
              }}
              className="h-10 w-14 rounded-md border border-input cursor-pointer"
            />
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              onBlur={() => saveBranding({ primary_color: primaryColor })}
              className="w-28 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* Preview */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Preview
        </p>
        <div
          className="rounded-lg border border-border overflow-hidden"
          style={{ '--portal-primary': primaryColor } as React.CSSProperties}
        >
          <div
            className="px-4 py-3 flex items-center gap-3"
            style={{ backgroundColor: primaryColor }}
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo"
                className="h-6 w-auto"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            ) : (
              <Globe className="w-5 h-5 text-white" />
            )}
            <span className="text-sm font-semibold text-white">
              {displayName || config.name}
            </span>
          </div>
          <div className="px-4 py-6 bg-gray-50 text-center">
            <p className="text-xs text-gray-400">Portal content area</p>
          </div>
        </div>
      </div>
    </div>
  )
}
