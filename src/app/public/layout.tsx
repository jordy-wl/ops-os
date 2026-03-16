/**
 * Public layout — minimal chrome for unauthenticated shared link pages.
 * No sidebar, no Clerk auth, no app navigation.
 * Org branding loaded per-token in child pages.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  )
}
