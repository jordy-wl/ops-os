import { validatePortalToken } from '@/lib/portal'
import { PortalProvider } from '@/components/portal/portal-context'
import { PortalShell } from '@/components/portal/portal-shell'
import type { PortalClientBlock } from '@/components/portal/portal-context'

interface Props {
  params: Promise<{ token: string }>
  children: React.ReactNode
}

/**
 * Portal Layout — Server Component
 *
 * Validates the portal token server-side. If invalid, renders an error page.
 * If valid, sets CSS custom properties for branding and wraps children in the
 * portal shell via a client-side context provider.
 *
 * Light theme only — no dark mode.
 */
export default async function PortalLayout({ params, children }: Props) {
  const { token } = await params

  const result = await validatePortalToken(token)

  if (!result.valid) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Portal Unavailable
          </h1>
          <p className="text-sm text-gray-500 mb-1">
            {result.reason === 'Token expired'
              ? 'This portal link has expired. Please contact your account manager for a new link.'
              : result.reason === 'Not a portal link'
                ? 'This link is not a valid portal link.'
                : 'This portal is no longer available. Please contact your account manager for assistance.'}
          </p>
        </div>
      </div>
    )
  }

  const { portalConfig, clientBlock, branding } = result

  // Calculate contrast color for primary
  const primaryColor = branding?.primary_color || '#2563eb'
  const primaryForeground = getContrastColor(primaryColor)
  const fontFamily = (portalConfig.branding_overrides?.font_family as string) || 'Inter, system-ui, sans-serif'

  return (
    <div
      style={
        {
          '--portal-primary': primaryColor,
          '--portal-primary-foreground': primaryForeground,
          '--portal-font': fontFamily,
        } as React.CSSProperties
      }
      className="font-[var(--portal-font)]"
    >
      <PortalProvider
        portalConfig={portalConfig}
        clientBlock={clientBlock as unknown as PortalClientBlock}
        branding={branding}
        token={token}
      >
        <PortalShell>{children}</PortalShell>
      </PortalProvider>
    </div>
  )
}

/**
 * Calculate whether white or black text has better contrast against a given
 * background color. Returns '#ffffff' or '#000000'.
 */
function getContrastColor(hex: string): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)

  // Relative luminance per WCAG 2.0
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  return luminance > 0.5 ? '#000000' : '#ffffff'
}
