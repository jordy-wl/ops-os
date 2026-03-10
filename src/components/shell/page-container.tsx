import { cn } from '@/lib/utils'

interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
}

const maxWidthClasses = {
  sm: 'max-w-3xl',
  md: 'max-w-4xl',
  lg: 'max-w-5xl',
  xl: 'max-w-6xl',
  '2xl': 'max-w-7xl',
  full: 'max-w-full',
}

/**
 * PageContainer — standard page wrapper with consistent padding,
 * max-width, and entrance animation.
 */
export function PageContainer({
  children,
  className,
  maxWidth = 'xl',
  ...props
}: PageContainerProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-6 py-6',
        maxWidthClasses[maxWidth],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
