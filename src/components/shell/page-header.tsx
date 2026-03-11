import Link from 'next/link'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  breadcrumbs?: BreadcrumbItem[]
}

/**
 * PageHeader — consistent page header used on every page.
 *
 * Renders a title row with optional action buttons aligned right,
 * an optional subtitle, and optional breadcrumb navigation.
 * Server component — no hooks, no 'use client'.
 */
export function PageHeader({ title, subtitle, actions, breadcrumbs }: PageHeaderProps) {
  return (
    <div className="border-b pb-4 mb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mt-2">
          <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {breadcrumbs.map((crumb, index) => (
              <li key={crumb.label} className="flex items-center gap-1.5">
                {index > 0 && (
                  <span className="text-muted-foreground" aria-hidden="true">
                    /
                  </span>
                )}
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-foreground transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-foreground">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
    </div>
  )
}
