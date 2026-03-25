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
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc] px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#f1f5f9] flex items-center justify-center">
            <svg
              className="w-8 h-8 text-[#94a3b8]"
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
          <h1 className="text-xl font-semibold text-[#0f172a] mb-2">
            Portal Unavailable
          </h1>
          <p className="text-sm text-[#475569] mb-1">
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
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            :root {
              --portal-bg: #f8fafc;
              --portal-card-bg: #ffffff;
              --portal-card-border: #e2e8f0;
              --portal-card-border-hover: #cbd5e1;
              --portal-text-primary: #0f172a;
              --portal-text-secondary: #475569;
              --portal-text-muted: #94a3b8;
              --portal-success: #059669;
              --portal-warning: #d97706;
              --portal-error: #dc2626;
              --portal-radius: 0.5rem;
              --portal-radius-sm: 0.375rem;
              --portal-shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
              --portal-shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05);
              --portal-transition: 150ms cubic-bezier(0.4, 0, 0.2, 1);
            }
            @keyframes shimmer {
              0% { background-position: -200% 0; }
              100% { background-position: 200% 0; }
            }
            .portal-shimmer {
              background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
              background-size: 200% 100%;
              animation: shimmer 1.5s ease-in-out infinite;
            }
          `,
        }}
      />
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
    </>
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
