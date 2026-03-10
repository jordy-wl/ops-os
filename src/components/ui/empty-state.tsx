import Link from 'next/link'

interface EmptyStateProps {
  icon: React.ElementType
  title: string
  description: string
  action?: { label: string; href: string }
}

/**
 * EmptyState — centered placeholder shown when a list or section has no data.
 * Provides a clear message, optional icon, and a call-to-action link.
 */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="h-12 w-12 text-gray-300 mb-4" aria-hidden="true" />
      <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 mb-4 max-w-sm">{description}</p>
      {action && (
        <Link
          href={action.href}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors"
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}
