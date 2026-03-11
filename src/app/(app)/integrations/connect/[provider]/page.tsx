import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import { OnboardingWizard } from '@/components/integrations/onboarding-wizard'

const VALID_PROVIDERS = ['google', 'webhook', 'custom_api'] as const
type Provider = (typeof VALID_PROVIDERS)[number]

export default async function ProviderConnectPage({
  params,
}: {
  params: Promise<{ provider: string }>
}) {
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/org-setup')

  const { provider } = await params
  if (!VALID_PROVIDERS.includes(provider as Provider)) {
    notFound()
  }

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-semibold text-foreground mb-8">Connect Integration</h1>
      <OnboardingWizard initialProvider={provider as Provider} />
    </div>
  )
}
