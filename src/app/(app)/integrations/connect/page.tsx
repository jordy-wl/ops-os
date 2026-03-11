import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { OnboardingWizard } from '@/components/integrations/onboarding-wizard'

export default async function ConnectIntegrationPage() {
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/org-setup')

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-8">Connect Integration</h1>
      <OnboardingWizard />
    </div>
  )
}
